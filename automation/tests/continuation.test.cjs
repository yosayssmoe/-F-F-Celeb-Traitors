const {test}=require('node:test'),assert=require('node:assert/strict');
const {clone,stable,T,E,D}=require('../shared.cjs'),{parseWikipedia}=require('../wikipedia.cjs'),{merge}=require('../merge.cjs');
const config=require('../config.json'),facts=require('../fixtures/episode9-facts.json'),base=require('../fixtures/published-episode8.json');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function snapshot(f=clone(facts),offset=0){
 if(offset)for(const c of f.tables[1][0])if(/^\d+$/.test(c.text))c.text=String(Number(c.text)+offset);
 let html=f.tables.map(rows=>'<table class="wikitable">'+rows.map(row=>'<tr>'+row.map(c=>`<td colspan="${c.colspan}" rowspan="${c.rowspan}">${esc(c.text)}${c.notes.map(id=>`<sup><a href="#${id}">note</a></sup>`).join('')}</td>`).join('')+'</tr>').join('')+'</table>').join('');
 html+='<ul>'+f.notes.map(n=>`<li id="${n.id}">${esc(n.text)}</li>`).join('')+'</ul>';
 // Paraphrased fixture prose, not a copy of an article.
 for(let ep=1;ep<=10;ep++)html+=`<table><tr class="vevent"><td class="summary">Episode ${ep}</td></tr><tr class="expand-child"><td>${ep===8?'The dagger represented a double vote at the Round Table. Voting results in a tie between Sharon and Joanne.':'Verified episode results.'}</td></tr></table>`;
 if(offset)html=html.replace(/Episode (\d+)/g,(_,n)=>'Episode '+(+n+offset)).replace(/episode (\d+)/g,(_,n)=>'episode '+(+n+offset));
 return {html,revision:f.source.revision,timestamp:f.source.timestamp,retrievedAt:'2026-10-30T13:00:00Z'};
}
function run(d=base,s=snapshot()){return merge(clone(d),parseWikipedia(s,d,config),config,'2026-10-30T13:00:00Z');}
test('Pinned continuation resolves one table in Episode 9, then Sharon murder and James banishment',()=>{
 const r=run(),events=r.data.events.filter(e=>e.ep===9),table=events[0];
 assert.deepEqual(events.map(e=>e.banished||e.victim),['Joanne McNally','Sharon Rooney','James Acaster']);
 assert.equal(table.id,base.events.at(-1).id);assert.equal(table.tableId,'ep8-table-1');assert.equal(table.outcome.startedEpisode,8);
 assert.equal(table.votingComplete,true);assert.equal(Object.keys(table.votes).length,10);assert.equal(Object.keys(table.revotes[0]).length,8);
 assert.deepEqual(table.extraBallots,[{round:0,voter:'King Kenny',target:'Sharon Rooney'},{round:1,voter:'King Kenny',target:'Joanne McNally'}]);
 assert.equal(events[2].votingComplete,false);assert.equal(events[2].votes['James Acaster'],undefined);assert.deepEqual(events[2].absent,[]);
 assert.deepEqual(r.report.afterTotals,{Talia:44,Joe:89,Alex:83,Apala:92,Reuben:44,Julian:81,Ava:70});
 assert.equal(r.report.latestEpisodeFullyScored,8);assert.deepEqual(r.report.partiallyScoredEpisodes,[9]);
 assert(r.report.pendingEvents.some(p=>p.episode===10&&p.status==='not-published'));
 assert(r.report.missingIndividualVotes.some(p=>p.episode===9&&p.voters.includes('James Acaster')));
 assert.deepEqual(r.data.events.filter(e=>e.ep<8),base.events.filter(e=>e.ep<8));assert.deepEqual(r.data.celebs,base.celebs);
 assert.equal(T.compute(r.data).contestants['Miranda Hart'].contributed,50);D.validate(r.data);
 const repeat=run(r.data);assert.equal(repeat.changed,false);assert.equal(stable(repeat.data),stable(r.data));
});
test('Missing/mislinked carry footnote, wrong weighted tally or missing tie procedure cannot resolve a cliffhanger',()=>{
 for(const change of [
  f=>f.notes.find(n=>/ended before/.test(n.text)).text='Adjacent episode, unspecified relationship.',
  f=>f.notes.find(n=>/ended before/.test(n.text)).text='Not '+f.notes.find(n=>/ended before/.test(n.text)).text,
  f=>f.notes.find(n=>/ended before/.test(n.text)).text=f.notes.find(n=>/ended before/.test(n.text)).text.replace('episode 9','episode 10'),
  f=>{const row=f.tables[1].find(r=>r[0].text==='Vote');row.find(c=>c.text==='5–4').text='6–3';},
  f=>f.notes.find(n=>/first round/.test(n.text)).text='Voting procedure unknown.'
 ]){const f=clone(facts);change(f);const r=run(base,snapshot(f));assert(!r.data.events.some(e=>e.ep===9));assert.equal(r.data.events.at(-1).banished,null);}
});
test('Continuation adapter uses source episode numbers rather than Episode 8/9 branches',()=>{
 const p=parseWikipedia(snapshot(clone(facts),4),base,config),ep=p.episodes.find(e=>e.episode===13);
 assert(p.relocations.some(r=>r.from===12&&r.to===13));assert.equal(ep.candidates[0].event.tableId,'ep12-table-1');assert.equal(ep.safePrefix,3);
});
test('Changed published initial ballot, manual lock or dependent later history prevents migration',()=>{
 const changed=clone(base);changed.events.at(-1).votes['James Blunt']='Joanne McNally';
 const locked=clone(base);locked.events.at(-1).automation.locked=true;
 const later=clone(base);later.events.push({ep:9,type:'murder',victim:'Michael Sheen'});
 for(const d of [changed,locked,later]){const r=run(d);assert.equal(r.data.events.find(e=>e.tableId==='ep8-table-1').ep,8);assert.equal(r.data.events.find(e=>e.tableId==='ep8-table-1').banished,null);}
});
test('Incomplete James table earns known +2 votes but no zero-vote bonuses',()=>{
 const r=run(),d=clone(r.data),event=d.events.at(-1),before=T.compute({...d,events:d.events.slice(0,-1)}).contestants,after=T.compute(d).contestants;
 assert.equal(event.banished,'James Acaster');
 for(const name of Object.keys(event.votes))assert.equal((after[name].cats.traitorVote||0)-(before[name].cats.traitorVote||0),before[name].role==='Faithful'?2:0);
 for(const name of Object.keys(after))assert.equal(after[name].cats.zeroVote||0,before[name].cats.zeroVote||0);
});
test('Missing James ballot can backfill without duplicate elimination or correct-vote awards',()=>{
 const first=run(),f=clone(facts),row=f.tables[1].find(r=>r.slice(0,3).some(c=>c.text==='James A.')&&r.some(c=>/No\s*vote/i.test(c.text)));
 // Synthetic correction, not a real broadcast claim: James votes for Maya.
 row.find(c=>/^No\s*vote$/i.test(c.text)).text='Maya';
 f.tables[1].find(r=>r[0].text==='Vote').find(c=>c.text==='7–0').text='7–1';
 const second=run(first.data,snapshot(f));assert.equal(second.data.events.length,first.data.events.length);assert.equal(second.data.events.at(-1).votingComplete,true);
 assert.equal(run(second.data,snapshot(f)).changed,false);assert.equal(second.report.afterTotals.Ava,70);
});
