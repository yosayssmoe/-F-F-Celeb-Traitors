const {test}=require('node:test'),assert=require('node:assert/strict');
const {clone,stable,T,E}=require('../shared.cjs'),{merge}=require('../merge.cjs');
const {parseWikipedia}=require('../wikipedia.cjs'),{resolveChronology,position}=require('../chronology.cjs');
const data=require('../fixtures/published-episode3.json'),facts=require('../fixtures/episode4-facts.json'),config=require('../config.json');
const source=facts.source;
const ep4=()=>({...clone(facts),issues:[],description:'The Traitors choose to murder Bella. Despite support from Romesh and Hannah, Julie is banished.'});
const candidate=event=>({event,verified:true,key:event.type+':'+(event.who||event.victim||event.banished),evidence:['Synthetic fixture']});
const episode=(episode,events)=>({episode,source,issues:[],candidates:events.map(candidate)});
const parsed=episodes=>({source,episodes,recaps:[]});
const run=(episodes,d=data)=>merge(clone(d),parsed(episodes),config,'2026-10-12T12:00:00Z');

test('Episode 4 actual facts: chronology, complete votes, all seven totals and earlier scores',()=>{
 const ep=ep4();resolveChronology(ep,data.events.filter(e=>e.ep===4));assert.equal(ep.safePrefix,2);
 assert.deepEqual(ep.candidates.map(c=>c.key),['murder:Bella Ramsey','roundtable:Julie Hesmondhalgh']);
 const r=run([ep]);assert.equal(r.report.accepted.length,2);assert.equal(r.report.latestEpisodeFullyScored,4);
 assert.equal(r.data.events.at(-1).votingComplete,true);assert.equal(Object.keys(r.data.events.at(-1).votes).length,17);
 assert.deepEqual(r.report.afterTotals,{Talia:27,Joe:38,Alex:43,Apala:39,Reuben:37,Julian:41,Ava:37});
 assert.deepEqual(r.data.events.filter(e=>e.ep<=3),data.events);
 const before=T.compute(data).contestants,after=T.compute(r.data).contestants;
 for(const name of Object.keys(before))assert.equal(stable(before[name].log),stable(after[name].log.filter(x=>x.ep<=3)),name);
 for(const name of ['Maya Jama','James Acaster','Hannah Fry'])assert.equal(after[name].cats.murder-before[name].cats.murder||after[name].cats.murder,1);
 assert.equal(after['Bella Ramsey'].position,4);assert.equal(after['Julie Hesmondhalgh'].position,5);
 assert.equal(r.report.afterTotals.Ava,after['Joanne McNally'].celebScore+2*after['Miranda Hart'].celebScore);
 assert.equal(run([ep],r.data).changed,false);
});

function htmlFixture(){
 const state=T.compute(data).contestants,round=facts.candidates[1].rounds[0];
 const cast=data.celebs.map(c=>`<tr><th>${c.name}</th><td>${state[c.name].role}</td><td>${c.name==='Bella Ramsey'?'Murdered (Episode 4)':c.name==='Julie Hesmondhalgh'?'Banished (Episode 4)':'Participating'}</td></tr>`).join('');
 const rows=data.celebs.map(c=>`<tr><th>${c.name}</th><td>${round.raw[c.name]}</td></tr>`).join('');
 return `<table class="wikitable"><tr><th>Contestant</th><th>Affiliation</th><th>Finish</th></tr>${cast}</table><table class="wikitable"><tr><th>Episode</th><th>4</th></tr><tr><th rowspan="2">Traitors' Decision</th><td>Bella</td></tr><tr><td>Murder</td></tr><tr><th>Banishment</th><td>Julie</td></tr><tr><th>Vote</th><td>9–6–1–1</td></tr>${rows}</table>`;
}
test('Structured absence establishes Episode 4 chronology even before recap appears',()=>{
 const p=parseWikipedia({html:htmlFixture(),revision:source.revision},data,config);
 assert.equal(p.episodes[0].safePrefix,2);assert.equal(p.episodes[0].issues.length,0);
 assert.equal(merge(clone(data),p,config).report.afterTotals.Alex,43);
});
test('Speculation, negation, multiple mentions and incomplete recruitment do not establish chronology',()=>{
 const c=ep4().candidates[0];
 for(const text of ['Bella might be murdered.','Bella was not murdered.','The Traitors could choose to murder Bella.','Bella is murdered. Bella was murdered.'])assert.equal(position(c,text),null);
 const recruit=candidate({ep:4,type:'recruit',who:'Miranda Hart',accepted:true});assert.equal(position(recruit,'The Traitors choose to recruit Miranda Hart.'),null);
});
test('Recruitment before and after murder changes only prospective eligibility',()=>{
 const m={ep:4,type:'murder',victim:'Bella Ramsey'},r={ep:4,type:'recruit',who:'Miranda Hart',accepted:true};
 const before=run([episode(4,[r,m])]),after=run([episode(4,[m,r])]);
 assert.equal(T.compute(before.data).contestants['Miranda Hart'].cats.murder,1);
 assert.equal(T.compute(after.data).contestants['Miranda Hart'].cats.murder,undefined);
 assert.equal(before.report.afterTotals.Ava-after.report.afterTotals.Ava,2);
});
test('Verified prefix imports while an unverified banishment and subsequent episode stay pending',()=>{
 const ep=ep4();resolveChronology(ep);ep.candidates[1].verified=false;
 ep.issues.push({eventKey:'roundtable:Julie Hesmondhalgh',status:'incomplete',detail:'Second assertion missing'});
 const later=episode(5,[{ep:5,type:'murder',victim:'Ross Kemp'}]);
 const r=run([ep,later]);assert.equal(r.report.accepted.length,1);assert.equal(r.data.events.at(-1).victim,'Bella Ramsey');
 assert.equal(r.data.episodeRecords[4].status,'partial');assert.deepEqual(r.report.partiallyScoredEpisodes,[4]);
 assert(r.data.automation.pendingEvents.some(x=>x.event==='roundtable:Julie Hesmondhalgh'));
 assert.equal(run([ep,later],r.data).changed,false);
 const backfill=run([ep4(),later],r.data);assert.equal(backfill.report.accepted.length,2);assert.equal(backfill.data.events.filter(e=>e.ep===4).length,2);
});
test('Unresolved recruitment chronology never creates an incorrect role history',()=>{
 const ep=ep4();ep.description='';ep.candidates.push(candidate({ep:4,type:'recruit',who:'Miranda Hart',accepted:true}));resolveChronology(ep);
 const r=run([ep]);assert.equal(r.report.accepted.length,0);assert.equal(stable(r.data.events),stable(data.events));assert.equal(r.report.scoresChanged,false);
});
test('Historical missing votes backfill after Episode 5 with stable IDs and no duplicates',()=>{
 const partial=ep4(),round=partial.candidates[1];round.rounds[0].votes={'Jerry Hall':'Hannah Fry'};round.rounds[0].raw={};
 const later=episode(5,[{ep:5,type:'murder',victim:'Ross Kemp'}]);
 const initial=run([partial,later]);assert.equal(initial.data.events.at(-1).ep,5);
 assert(initial.data.automation.pendingEvents.some(x=>x.status==='missing-votes'));
 const corrected=run([ep4(),later],initial.data);assert.equal(corrected.report.accepted.length,1);assert.equal(corrected.report.accepted[0].action,'backfilled');
 assert.equal(corrected.data.events.at(-1).id,initial.data.events.at(-1).id);assert.equal(corrected.data.events.length,initial.data.events.length);
 assert.equal(corrected.data.episodeRecords[4].status,'complete');assert.equal(corrected.data.automation.pendingEvents.length,0);
 assert.equal(run([ep4(),later],corrected.data).changed,false);
 assert.equal(corrected.report.afterTotals.Ava,E.totals(corrected.data).Ava);
});
test('Conflicting historical vote is retained as pending without blocking independent later results',()=>{
 const initial=run([ep4()]),conflict=ep4();conflict.candidates[1].rounds[0].votes['Jerry Hall']='Julie Hesmondhalgh';
 const later=episode(5,[{ep:5,type:'murder',victim:'Ross Kemp'}]);const r=run([conflict,later],initial.data);
 assert.equal(r.data.events.find(e=>e.ep===4&&e.type==='roundtable').votes['Jerry Hall'],'Hannah Fry');
 assert.equal(r.report.sourceConflicts.length,1);assert.equal(r.data.events.at(-1).ep,5);
 const resolved=run([ep4(),later],r.data);assert.equal(resolved.report.sourceConflicts.length,0);assert.equal(resolved.data.episodeRecords[4].status,'complete');
});
test('Multiple Round Tables stay separate; partial votes never award zero-vote points',()=>{
 const table=who=>({ep:4,type:'roundtable',banished:who,votes:{},revotes:[],absent:[],votingComplete:false});
 const r=run([episode(4,[table('Julie Hesmondhalgh'),table('Ross Kemp')])]);
 assert.equal(r.report.accepted.length,2);assert.equal(new Set(r.data.events.filter(e=>e.ep===4).map(e=>e.id)).size,2);
 assert.equal(T.compute(r.data).contestants['Maya Jama'].cats.faithfulBanished-T.compute(data).contestants['Maya Jama'].cats.faithfulBanished,4);
 assert.equal(T.compute(r.data).contestants['Miranda Hart'].cats.zeroVote,T.compute(data).contestants['Miranda Hart'].cats.zeroVote);
});
test('Source role disagreement blocks that event and preserves the safe prefix',()=>{
 const ep=ep4();ep.candidates[1].observedRole='Traitor';const r=run([ep]);assert.equal(r.report.accepted.length,1);assert.equal(r.data.events.at(-1).victim,'Bella Ramsey');
 assert(r.report.pendingEvents.some(x=>/Source role conflicts/.test(x.reason)));
});
