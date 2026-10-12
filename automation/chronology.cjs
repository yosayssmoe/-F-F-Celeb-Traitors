// Only narrow declarative assertions in an episode recap establish chronology.
// Unmatched events remain barriers: never infer a usual episode structure.
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function position(candidate,description){
 const e=candidate.event,who=e.who||e.victim||e.shielded||e.banished;
 const names=[...new Set([who,...(candidate.aliases||[])])].filter(Boolean).map(escape).join('|');
 const passive=e.type==='roundtable'?'banished':e.type==='recruit'?'recruited as a [Tt]raitor':e.shielded?'saved from murder by (?:a |their |his |her )?[Ss]hield':'murdered';
 const patterns=[new RegExp('(?:^|[.!?]\\s+)(?:Despite [^.!?]+, )?(?:'+names+') (?:is|was|has been) '+passive+'(?=[ .,!])','g')];
 if(e.victim)patterns.push(new RegExp('(?:^|[.!?]\\s+)[Tt]he Traitors (?:choose|chose|decide|decided) to murder (?:'+names+')(?=[ .,!])','g'));
 if(e.type==='recruit')patterns.push(new RegExp('(?:^|[.!?]\\s+)(?:Instead of murdering, )?[Tt]he Traitors (?:decide|choose) to (?:seduce|recruit) (?:'+names+') and (?:he|she|they) accepts? their offer(?=[ ,.])','g'));
 const hits=patterns.flatMap(p=>[...description.matchAll(p)]);
 return hits.length===1?hits[0].index:null;
}
function resolveChronology(ep,old=[]){
 const identity=e=>e.type+':'+(e.who||e.victim||e.shielded||e.banished||'');
 ep.issues=ep.issues.filter(x=>x.scope!=='chronology');
 const candidates=ep.candidates,match=c=>old.findIndex(e=>identity(e)===identity(c.event));
 if(candidates.length<2){ep.safePrefix=candidates.length;return;}
 const positions=candidates.map(c=>position(c,ep.description||''));
 if(positions.every(p=>p!==null)&&new Set(positions).size===positions.length){
  candidates.forEach((c,i)=>c.order=positions[i]);candidates.sort((a,b)=>a.order-b.order);ep.safePrefix=candidates.length;return;
 }
 if(candidates.every(c=>match(c)>=0)){candidates.sort((a,b)=>match(a)-match(b));ep.safePrefix=candidates.length;return;}
 if(candidates.every(c=>c.kind==='table')){ep.safePrefix=candidates.length;return;}
 // A victim explicitly marked murdered in every voting round was already out.
 // This also works when recaps are delayed, without using prose mention order.
 const precedes=(a,b)=>a.event.victim&&b.kind==='table'&&b.rounds?.length&&b.rounds.every(r=>new RegExp('^Murdered\\s*\\(Episode '+ep.episode+'\\)$','i').test(r.raw[a.event.victim]||''));
 const remaining=[...candidates],ordered=[];
 while(remaining.length){
  const first=remaining.filter(a=>remaining.every(b=>a===b||precedes(a,b)));
  if(first.length!==1)break;
  ordered.push(first[0]);remaining.splice(remaining.indexOf(first[0]),1);
 }
 ep.candidates=[...ordered,...remaining];ep.safePrefix=ordered.length;
 if(remaining.length)ep.issues.push({scope:'chronology',status:'ambiguous',detail:'Order of recruitment/murder and Round Tables is not explicitly established. Dependent events remain pending.'});
}
module.exports={position,resolveChronology};
