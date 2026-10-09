const H=require('./html.cjs');
const {stable}=require('./shared.cjs');
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const empty=s=>!s||/^(none|no vote|no murder|tbc|tbd|pending|—|–|-)$/i.test(s);
function parseWikipedia(snapshot,data,config){
 const doc=H.parse(snapshot.html),names=data.celebs.map(c=>c.name),resolve=H.aliases(names);
 const source={title:'Wikipedia: Celebrity Traitors UK Series 2',url:`https://en.wikipedia.org/w/index.php?oldid=${snapshot.revision}`,retrievedAt:snapshot.retrievedAt,revision:snapshot.revision,revisionTimestamp:snapshot.timestamp};
 const tables=H.all(doc,n=>n.tagName==='table'&&H.attr(n,'class').split(/\s+/).includes('wikitable'));
 const grids=tables.map(H.grid),cast=grids.find(g=>g[0]?.some(c=>c.text==='Contestant')&&g[0]?.some(c=>c.text==='Finish'));
 if(!cast)throw Error('Wikipedia contestant table not recognised; no update performed.');
 const castHeader=cast[0].map(c=>c.text),finishes=new Map();
 for(const row of cast.slice(1)){const who=resolve(row[castHeader.indexOf('Contestant')]?.text);if(who)finishes.set(who,{text:row[castHeader.indexOf('Finish')]?.text||'',role:row[castHeader.indexOf('Affiliation')]?.text||''});}
 if(finishes.size!==21)throw Error('Wikipedia cast does not match the 21 known contestants.');
 const histories=grids.filter(g=>g[0]?.some(c=>c.text==='Episode')&&g.some(r=>r.some(c=>c.text==='Banishment'))&&g.some(r=>r.some(c=>/Traitors.*Decision/.test(c.text))));
 if(histories.length!==1)throw Error('Expected one unambiguous elimination-history table.');
 const g=histories[0],header=g[0],first=header.findIndex(c=>/^\d+$/.test(c.text));
 const dIndex=g.findIndex(r=>r.slice(0,first).some(c=>/Traitors.*Decision/.test(c.text)));
 const bRow=g.find(r=>r.slice(0,first).some(c=>c.text==='Banishment'));
 const tallyRow=g.find(r=>r.slice(0,first).some(c=>c.text==='Vote'));
 const voterRows=g.filter(r=>r.slice(0,first).some(c=>resolve(c.text)));
 const voterNames=voterRows.map(r=>r.slice(0,first).map(c=>resolve(c.text)).find(Boolean));
 if(new Set(voterNames).size!==21||voterRows.length!==21)throw Error('Voting table roster is incomplete or duplicated.');
 const notes=H.all(doc,n=>n.tagName==='li').map(H.text);
 const episodes=new Map(),recaps=[];
 // Episode descriptions are used only for narrow, explicit chronology assertions.
 const descriptions=new Map(),dates=new Map();
 for(const row of H.all(doc,n=>n.tagName==='tr'&&H.attr(n,'class').includes('vevent'))){
  const summary=H.all(row,n=>H.attr(n,'class').split(' ').includes('summary'))[0];const ep=Number(H.text(summary).match(/Episode (\d+)/)?.[1]);if(!ep)continue;
  const date=H.all(row,n=>H.attr(n,'class').split(' ').some(c=>['bday','dtstart'].includes(c)))[0];dates.set(ep,H.text(date).match(/\d{4}-\d{2}-\d{2}/)?.[0]||'');
  const siblings=row.parentNode.childNodes,index=siblings.indexOf(row);let desc;
  for(let i=index+1;i<siblings.length;i++){if(siblings[i].tagName==='tr'){if(H.attr(siblings[i],'class').includes('expand-child'))desc=siblings[i];break;}}
  if(desc){descriptions.set(ep,H.text(desc));
   for(const link of H.all(desc,n=>n.tagName==='a'&&H.attr(n,'href').startsWith('#cite_note-'))){const target=H.all(doc,n=>H.attr(n,'id')===H.attr(link,'href').slice(1))[0];
    if(target)for(const external of H.all(target,n=>n.tagName==='a'&&/^https:\/\//.test(H.attr(n,'href')))){const url=H.attr(external,'href');try{if(config.recapHosts.includes(new URL(url).hostname))recaps.push({episode:ep,url});}catch{}}
   }
  }
 }
 for(const ep of [...new Set(header.slice(first).map(c=>Number(c.text)))].filter(n=>Number.isInteger(n)&&n>0&&n<=config.maxEpisode)){
  const columns=header.flatMap((c,i)=>i>=first&&Number(c.text)===ep?[i]:[]);
  const result={episode:ep,date:dates.get(ep)||'',candidates:[],issues:[],source,description:descriptions.get(ep)||'',noEvents:false};episodes.set(ep,result);
  const seen=new Set();
  for(const col of columns){const cell=g[dIndex]?.[col],kind=g[dIndex+1]?.[col]?.text||'';if(!cell||seen.has(cell.id))continue;seen.add(cell.id);
   if(empty(cell.text)||/^(shortlist|shield|none)$/i.test(kind))continue;
   const who=resolve(cell.text);let event,secondary=false;
   if(!who){result.issues.push({status:'ambiguous',detail:`Unknown decision identity: ${cell.text} / ${kind}`});continue;}
   if(/^murder$/i.test(kind)){event={ep,type:'murder',victim:who};secondary=new RegExp('^Murdered\\s*\\(Episode '+ep+'\\)$','i').test(finishes.get(who)?.text);}
   else if(/^(recruit|seduce)$/i.test(kind)){
    event={ep,type:'recruit',who,accepted:true};secondary=notes.some(s=>new RegExp('(?:^|\\s)'+escape(cell.text)+' (?:was|is) recruited as a Traitor in Episode '+ep+'\\.','i').test(s));
   } else if(/^(shield save|murder blocked by shield)$/i.test(kind)){
    event={ep,type:'murder',shielded:who};secondary=new RegExp(escape(cell.text)+' (?:was|is) saved from murder by (?:a |their |his |her )?[Ss]hield').test(result.description);
   } else {result.issues.push({status:'unsupported',detail:`Decision ${kind} for ${who} requires manual evidence.`});continue;}
   result.candidates.push({event,key:`${event.type}:${who}`,column:col,kind:'decision',verified:secondary,evidence:[`${kind}: ${cell.text}`,secondary?'Second structured section agrees':'Second structured assertion missing']});
   if(!secondary)result.issues.push({status:'incomplete',detail:`Decision for ${who} is not supported by a second explicit section.`});
  }
  const groups=new Map();
  for(const col of columns){const b=bRow?.[col];if(!b||empty(b.text))continue;const who=resolve(b.text);if(!who){result.issues.push({status:'ambiguous',detail:'Unrecognised banishment: '+b.text});continue;}
   if(!groups.has(b.id))groups.set(b.id,{who,columns:[],cell:b});groups.get(b.id).columns.push(col);
  }
  for(const {who,columns:cols} of groups.values()){
   const rounds=[],identities=new Set();
   for(const col of cols){const marker=voterRows.map(r=>r[col]?.id||0).join(',');if(identities.has(marker))continue;identities.add(marker);
    const votes={},raw={};for(let i=0;i<voterRows.length;i++){const value=voterRows[i][col]?.text||'';raw[voterNames[i]]=value;const target=resolve(value);if(target)votes[voterNames[i]]=target;}
    rounds.push({votes,raw,tally:tallyRow?.[col]?.text||''});
   }
   const verified=new RegExp('^Banished\\s*\\(Episode '+ep+'\\)$','i').test(finishes.get(who)?.text);
   result.candidates.push({event:{ep,type:'roundtable',votes:{},revotes:[],absent:[],banished:who,votingComplete:false},key:'roundtable:'+who,column:cols[0],kind:'table',verified,rounds,evidence:['Banishment: '+who,verified?'Contestant finish agrees':'Contestant finish does not agree']});
   if(!verified)result.issues.push({status:'conflicting',detail:'Banishment and contestant finish disagree for '+who});
  }
  // Unsupported exits/winners must be visible in the report and block later scoring.
  for(const [who,finish] of finishes){if(new RegExp('\\(Episode '+ep+'\\)').test(finish.text)&&!result.candidates.some(c=>(c.event.victim||c.event.banished)===who)){
    if(/^(Left|Withdrawn|Disqualified|Winner)/i.test(finish.text))result.issues.push({status:'unsupported',detail:`${finish.text}: ${who}. No unambiguous chronological event adapter.`});
  }}
  result.candidates.sort((a,b)=>a.column-b.column||(a.kind==='decision'?-1:1));
  if(result.candidates.length>1){
   // Existing canonical ordering is authoritative when all observations already exist.
   const old=data.events.filter(e=>e.ep===ep);
   const match=c=>old.findIndex(e=>e.type===c.event.type && (e.who||e.victim||e.shielded||e.banished)===(c.event.who||c.event.victim||c.event.shielded||c.event.banished));
   if(result.candidates.every(c=>match(c)>=0))result.candidates.sort((a,b)=>match(a)-match(b));
   else {
    // Distinct banishment columns order tables; interleaved decisions need explicit
    // declarative recap chronology. No assumption that all decisions precede tables.
    const onlyTables=result.candidates.every(c=>c.kind==='table');
    if(!onlyTables){
     const mentions=result.candidates.map(c=>{
      const who=c.event.who||c.event.victim||c.event.shielded||c.event.banished;
      const variants=[who,...voterRows.map((r,i)=>voterNames[i]===who?r.slice(0,first).find(v=>resolve(v.text)===who)?.text:null).filter(Boolean)];
      const verb=c.event.type==='roundtable'?'banished':c.event.type==='recruit'?'recruited as a [Tt]raitor':c.event.shielded?'saved from murder by (?:a |their |his |her )?[Ss]hield':'murdered';
      const pattern=new RegExp('(?:^|[.!?]\\s+)('+variants.map(escape).join('|')+') (?:is|was) '+verb+'(?=[ .,!])','g');
      const hits=[...result.description.matchAll(pattern)];
      if(c.event.type==='recruit'){
       const accepted=new RegExp('(?:^|[.!?]\\s+)(?:Instead of murdering, )?[Tt]he Traitors (?:decide|choose) to (?:seduce|recruit) ('+variants.map(escape).join('|')+') and (?:he|she|they) accepts? their offer(?=[ ,.])','g');
       hits.push(...result.description.matchAll(accepted));
      }
      return hits.length===1?hits[0].index:-1;
     });
     if(mentions.every(n=>n>=0)&&new Set(mentions).size===mentions.length)result.candidates=result.candidates.map((c,i)=>({...c,order:mentions[i]})).sort((a,b)=>a.order-b.order);
     else result.issues.push({status:'ambiguous',detail:'Order of recruitment/murder and Round Tables is not explicitly established. Episode and later additions deferred.'});
    }
   }
  }
  result.noEvents=!result.candidates.length&&!result.issues.length&&columns.every(c=>/^(None|No vote)$/i.test(bRow?.[c]?.text||''))&&!!result.description;
 }
 return {episodes:[...episodes.values()],source,recaps:recaps.filter((r,i,a)=>a.findIndex(x=>x.url===r.url)===i)};
}
function verifyVotes(candidate,step){
 const event=JSON.parse(JSON.stringify(candidate.event));if(event.type!=='roundtable')return event;
 const rounds=candidate.rounds||[];if(!rounds.length)return event;
 const absent=step.active.filter(n=>/^(Absent|Ineligible|Not eligible)$/i.test(rounds[0].raw[n]||''));const eligible=step.active.filter(n=>!absent.includes(n));event.absent=absent;
 const valid=r=>Object.fromEntries(Object.entries(r.votes).filter(([v,t])=>eligible.includes(v)&&eligible.includes(t)&&v!==t));
 event.votes=valid(rounds[0]);event.revotes=rounds.slice(1).map(valid);
 let complete=eligible.every(n=>!!event.votes[n]);let expected=eligible;
 for(let i=0;i<rounds.length;i++){
  const r=i?event.revotes[i-1]:event.votes;
  if(!expected.every(n=>!!r[n])||Object.keys(r).some(n=>!expected.includes(n)))complete=false;
  const counts=Object.values(r).reduce((a,n)=>(a[n]=(a[n]||0)+1,a),{}),values=Object.values(counts).sort((a,b)=>b-a);
  const published=rounds[i].tally.trim();
  if(!/^\d+(?:\s*[–—-]\s*\d+)*$/.test(published)||stable(values)!==stable(published.split(/[–—-]/).map(Number).sort((a,b)=>b-a)))complete=false;
  const tied=Object.keys(counts).filter(n=>counts[n]===Math.max(...values));
  if(i<rounds.length-1){if(tied.length<2)complete=false;const next=valid(rounds[i+1]);if(Object.values(next).some(n=>!tied.includes(n)))complete=false;expected=eligible.filter(n=>!tied.includes(n));}
  else if(candidate.event.banished&&(!tied.includes(candidate.event.banished)||tied.length>1))complete=false;
 }
 event.votingComplete=complete;return event;
}
module.exports={parseWikipedia,verifyVotes};
