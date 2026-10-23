// Narrow adapters for explicit weighted-vote footnotes and tied ballot columns.
// Other powers remain unsupported; a second column is never an extra ballot.
const H=require('./html.cjs');
const {T,stable}=require('./shared.cjs');
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function referencedNotes(node,doc){
 return H.all(node,n=>n.tagName==='a'&&H.attr(n,'href').startsWith('#cite_note-')).map(a=>{
  const id=H.attr(a,'href').slice(1),target=H.all(doc,n=>H.attr(n,'id')===id)[0];return {id,text:H.text(target)};
 });
}
function dagger(kindCell,holder,aliases,doc,description){
 const names=aliases.map(escape).join('|');
 const uncertain=/\b(not|never|could|might|may|if|reportedly)\b/i;
 const note=referencedNotes(kindCell.node,doc).find(n=>!uncertain.test(n.text)&&
  /(?:vote count twice|double(?:d)? vote)/i.test(n.text)&&new RegExp('(?:Dagger was (?:granted|given) to|Dagger to) (?:'+names+')(?=[ .,;])','i').test(n.text));
 const phrase=description.match(/dagger[^.!?]{0,100}(?:double vote|cast 2 votes)[^.!?]{0,60}round table/i)?.[0];
 const explained=phrase&&!uncertain.test(phrase);
 if(!note||!explained)return null;
 return {kind:'double-vote',holder,noteId:note.id,evidence:['Referenced Dagger footnote explicitly doubles the holder’s vote.', 'Episode description independently explains the double vote at the Round Table.']};
}
function counts(round,powers){
 const out={};for(const [v,t] of Object.entries(round.votes))out[t]=(out[t]||0)+1+(powers.some(p=>p.holder===v&&p.kind==='double-vote')?1:0);return out;
}
const matches=(counts,tally)=>/^\d+(?:\s*[–—-]\s*\d+)*$/.test(tally)&&stable(Object.values(counts).sort((a,b)=>b-a))===stable(tally.split(/[–—-]/).map(Number).sort((a,b)=>b-a));
function tables({ep,columns,bRow,tallyRow,voterRows,voterNames,resolve,finishes,power,description,doc}){
 const groups=[],issues=[];let current;
 for(const col of columns){
  const cell=bRow?.[col],label=cell?.text||'',who=resolve(label),tie=/^tie$/i.test(label);
  if(label&&!who&&!tie){issues.push({status:'unsupported',detail:'Unrecognised voting outcome: '+label+'. Its chronology and effect require verification.'});}
  if(!current){if(!tie&&!who)continue;current={columns:[],outcome:null,firstTie:tie};groups.push(current);}
  else if(who&&current.outcome&&cell.id!==current.cellId){current={columns:[],outcome:null,firstTie:false};groups.push(current);}
  else if(tie&&current.outcome){current={columns:[],outcome:null,firstTie:true};groups.push(current);}
  current.columns.push(col);if(who){current.outcome=who;current.cellId=cell.id;}
 }
 const candidates=[];
 groups.forEach((group,index)=>{
  const rounds=[],seen=new Set();
  for(const col of group.columns){
   const marker=voterRows.map(r=>r[col]?.id||0).join(',');if(seen.has(marker))continue;seen.add(marker);
   const votes={},raw={};voterRows.forEach((r,i)=>{const text=r[col]?.text||'';raw[voterNames[i]]=text;const target=resolve(text);if(target)votes[voterNames[i]]=target;});
   rounds.push({votes,raw,tally:tallyRow?.[col]?.text||''});
  }
  if(!rounds.length)return;
  const powers=[];
  if(power){
   const holderRow=voterRows[voterNames.indexOf(power.holder)];
   if(group.columns.some(col=>referencedNotes(holderRow?.[col]?.node,doc).some(n=>n.id===power.noteId)))powers.push({kind:power.kind,holder:power.holder});
   else issues.push({status:'unsupported',detail:'The verified Dagger grant is not linked to a specific voting table.'});
  }
  const tally=counts(rounds[0],powers),max=Math.max(0,...Object.values(tally)),tied=Object.keys(tally).filter(n=>tally[n]===max).sort();
  const tiedNote=group.columns.some(col=>voterRows.some(r=>referencedNotes(r[col]?.node,doc).some(n=>/first round[^.]*tie/i.test(n.text)&&/second vote/i.test(n.text)&&/would not vote/i.test(n.text))));
  const tieVerified=group.firstTie&&tied.length>=2&&matches(tally,rounds[0].tally)&&tiedNote;
  const banished=group.outcome||null;
  const verified=banished ? new RegExp('^Banished\\s*\\(Episode '+ep+'\\)$','i').test(finishes.get(banished)?.text) : tieVerified;
  const tableId=`ep${ep}-table-${index+1}`;
  const event={ep,type:'roundtable',tableId,votes:{},revotes:[],absent:[],banished,votingComplete:false,
   ...(powers.length?{ballotPowers:powers,extraBallots:[]}:{}),
   outcome:{status:banished?'banished':'pending',...(tied.length>=2?{tied}:{} )}};
  const evidence=[banished?'Banishment and contestant finish agree.':'The first tally and referenced tie procedure establish an unfinished Round Table.',...(power?.evidence||[])];
  const candidate={event,key:'roundtable:'+tableId,column:group.columns[0],kind:'table',verified,rounds,evidence};
  candidates.push(candidate);
  if(!verified)issues.push({eventKey:candidate.key,status:'incomplete',detail:'Voting power/tie outcome lacks consistent structured supporting evidence.'});
 });
 return {candidates,issues};
}
function verify(candidate,step){
 const event=JSON.parse(JSON.stringify(candidate.event)),rounds=candidate.rounds||[],powers=event.ballotPowers||[];
 if(!rounds.length)return event;
 const absent=step.active.filter(n=>/^(Absent|Ineligible|Not eligible)$/i.test(rounds[0].raw[n]||''));
 const voters=step.active.filter(n=>!absent.includes(n));event.absent=absent;
 let expected=voters.slice(),complete=true;const validRounds=[],extras=[];
 for(let i=0;i<rounds.length;i++){
  const r=rounds[i],votes={};for(const [v,t] of Object.entries(r.votes))if(expected.includes(v)&&voters.includes(t)&&v!==t)votes[v]=t;
  if(Object.keys(votes).length!==Object.keys(r.votes).length)throw Error('A powered voting column contains an ineligible ballot.');
  if(!expected.every(v=>!!votes[v]))complete=false;
  for(const p of powers)if(votes[p.holder])extras.push({round:i,voter:p.holder,target:votes[p.holder]});
  const tally=counts({votes},powers);if(!matches(tally,r.tally))complete=false;
  validRounds.push(votes);
  const max=Math.max(0,...Object.values(tally)),tied=Object.keys(tally).filter(n=>tally[n]===max);
  if(i<rounds.length-1){
   if(!complete||tied.length<2)throw Error('A re-vote needs a complete, matching tied preceding tally, including extra ballots.');
   expected=voters.filter(n=>!tied.includes(n));
   if(Object.values(rounds[i+1].votes).some(t=>!tied.includes(t)))throw Error('Re-vote targets conflict with the verified tie.');
  }else if(event.banished&&(tied.length!==1||tied[0]!==event.banished))complete=false;
 }
 event.votes=validRounds[0];event.revotes=validRounds.slice(1);
 if(powers.length)event.extraBallots=extras;
 event.votingComplete=complete&&event.outcome.status!=='pending';
 const view=T.ballotView(event,voters);if(view.errors.length)throw Error(view.errors.join(' '));
 if(event.votingComplete&&!view.complete)throw Error('A required extra ballot is missing.');
 return event;
}
module.exports={dagger,tables,verify};
