// A partial order, not the order names happen to occur in an article.
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const identity=e=>e.type+':'+(e.who||e.victim||e.shielded||e.banished||(e.winners||[]).join('|')||'');
const names=c=>[...new Set([c.event.who,c.event.victim,c.event.shielded,c.event.banished,...(c.aliases||[])])].filter(Boolean).map(escape).sort((a,b)=>b.length-a.length).join('|');
const negative=/\b(not|never|could|would|might|may|if|predicted|rumour|rumor)\b/i;
function assertion(c){
 const n='(?:'+names(c)+')',e=c.event;
 if(e.type==='exit')return n+' (?:left|withdrew|was withdrawn|was disqualified)';
 if(e.type==='roundtable')return n+' (?:is|was|has been) banished';
 if(e.type==='recruit')return '(?:'+n+' (?:is|was|has been) recruited as a [Tt]raitor|[Tt]he Traitors (?:decide|choose|decided|chose) to (?:seduce|recruit) '+n+' and (?:he|she|they) accepts? their offer)';
 if(e.shielded)return n+' (?:is|was|has been) saved from murder by (?:a |their |his |her )?[Ss]hield';
 return '(?:'+n+' (?:is|was|has been) murdered|[Tt]he Traitors (?:choose to murder|chose to murder|murder|murdered) '+n+')';
}
function position(c,text){
 const hits=[...text.matchAll(new RegExp('(?:^|[.!?]\\s+)(?:Despite [^.!?]+, )?'+assertion(c)+'(?=[ .,!?])','g'))];
 return hits.length===1&&!negative.test(hits[0][0])?hits[0].index:null;
}
// Conservative read/write dependencies of the unchanged scoring engine.
// Eliminations affect every survivor; Round Tables also read every current role.
function dependent(a,b){
 if(!a||!b)return true; // unknown event/format is an opaque state barrier
 const local=e=>e.type==='recruit'||(e.type==='murder'&&!e.victim&&e.shielded);
 if(local(a)&&local(b))return (a.who||a.shielded)===(b.who||b.shielded);
 if(a.type==='murder'&&a.shielded&&b.type==='murder'&&b.victim)return a.shielded===b.victim;
 if(b.type==='murder'&&b.shielded&&a.type==='murder'&&a.victim)return b.shielded===a.victim;
 return true;
}
function resolveChronology(ep,old=[]){
 ep.issues=ep.issues.filter(x=>x.scope!=='chronology');
 const cs=ep.candidates,edges=[],key=c=>c.key||identity(c.event);
 const add=(a,b,reason,evidence)=>{if(a!==b&&!edges.some(e=>e.before===key(a)&&e.after===key(b)&&e.reason===reason))edges.push({before:key(a),after:key(b),reason,evidence,source:ep.source});};
 const text=ep.description||'';
 for(const a of cs)for(const b of cs){if(a===b)continue;
  const target=a.event.victim||a.event.banished|| (a.event.type==='exit'&&a.event.who);
  if(target&&b.kind==='table'&&b.rounds?.length&&b.rounds.every(r=>new RegExp('^(?:Murdered|Banished|Left|Withdrawn)\\s*\\(Episode '+ep.episode+'\\)$','i').test(r.raw[target]||'')))add(a,b,'eliminated-before-voting',target+' explicitly out in every voting round');
  if(a.kind==='table'&&b.kind==='table'&&Number.isInteger(a.column)&&Number.isInteger(b.column)&&a.column<b.column)add(a,b,'voting-round-columns','Separate banishments in ordered episode voting columns');
  // Same-sentence explicit temporal relationships; bare prose order never counts.
  for(const sentence of text.split(/(?<=[.!?])\s+/)){
   if(negative.test(sentence))continue;
   if(new RegExp(assertion(a)+'[^.!?]*\\bbefore\\b[^.!?]*'+assertion(b),'i').test(sentence)||new RegExp('(?:After|Following) '+assertion(a)+'[^.!?]*[,;]\\s*'+assertion(b),'i').test(sentence))add(a,b,'explicit-temporal-clause',sentence);
  }
 }
 // A narrowly scoped recap discourse adapter: completed named banishment at
 // an explicit Round Table, followed by Afterwards and That night, then an
 // explicit recruitment choice AND acceptance. No pronoun-only event creation.
 for(const r of cs.filter(c=>c.event.type==='recruit'&&c.event.accepted))for(const b of cs.filter(c=>c.kind==='table')){
  const n=names(b),rn=names(r);
  const completed='(?:suspicions (?:predominantly |primarily )?fell on (?:'+n+')(?: \\([^)]*\\))?[.!?]\\s*(?:He|She|They) (?:was|were) banished|(?:'+n+') (?:was|is) banished)';
  const pattern=new RegExp('At the Round Table, '+completed+'[^.]*\\.[\\s\\S]{0,200}?Afterwards,[\\s\\S]{0,450}?That night, [Tt]he Traitors (?:decided|chose) to recruit[^.]*\\. They chose (?:'+rn+') and (?:he|she|they) accepted the offer\\.','i');
  const match=text.match(pattern);
  if(match)add(b,r,'recap-explicit-subsequent-night',match[0]);
 }
 // Published local chronology remains authoritative; new nodes may be inserted.
 const existing=old.map(e=>cs.find(c=>identity(c.event)===identity(e))).filter(Boolean);
 for(let i=1;i<existing.length;i++)add(existing[i-1],existing[i],'published-history','Previously validated local event order');
 // Corroborating sources contribute constraints, never overwrite source order.
 for(const edge of ep.externalEdges||[])if(cs.some(c=>key(c)===edge.before)&&cs.some(c=>key(c)===edge.after))edges.push(edge);
 const reaches=(a,b,seen=new Set())=>{if(seen.has(a))return false;seen.add(a);return edges.some(e=>e.before===a&&(e.after===b||reaches(e.after,b,seen)));};
 const cycle=cs.some(c=>reaches(key(c),key(c)));
 const remaining=[...cs],safe=[];
 if(!cycle)while(remaining.length){
  const ready=remaining.find(a=>remaining.every(b=>a===b||(!reaches(key(b),key(a))&&(reaches(key(a),key(b))||!dependent(a.event,b.event)))));
  if(!ready)break;safe.push(ready);remaining.splice(remaining.indexOf(ready),1);
 }
 ep.candidates=[...safe,...remaining];ep.safePrefix=safe.length;
 ep.timeline={version:1,status:cycle?'conflicting':remaining.length?'partial':'resolved',edges,nodes:cs.map(c=>({id:key(c),type:c.event.type,verified:c.verified})),pending:remaining.map(c=>({event:key(c),dependencies:remaining.filter(b=>b!==c&&(reaches(key(b),key(c))||(!reaches(key(c),key(b))&&dependent(b.event,c.event)))).map(key),reason:cycle?'Contradictory chronology constraints form a cycle.':'No verified order relative to scoring-dependent events.'}))};
 if(remaining.length)ep.issues.push({scope:'chronology',status:cycle?'conflicting':'ambiguous',detail:cycle?'Conflicting verified chronology constraints; dependent events remain pending.':'Chronology is partially ordered; only events with resolved scoring dependencies can be imported.'});
 return ep.timeline;
}
module.exports={position,resolveChronology,dependent,identity};
