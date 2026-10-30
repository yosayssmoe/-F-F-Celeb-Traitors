const {test}=require('node:test'),assert=require('node:assert/strict');
const {clone,stable,T,D,E}=require('../shared.cjs'),{merge}=require('../merge.cjs');
const {build}=require('../../scoreboard-model.js').ScoreboardModel;
const baseline=require('../fixtures/published-episode9.json'),pack=require('../../examples/episode-10-verified.json'),config=require('../config.json');
function reviewed(){
 const first=E.prepare(clone(baseline),{schemaVersion:1,series:E.SERIES,episode:1,date:'2026-10-01',status:'complete',notes:'Verified starting roles only; no completed scoring events.',sources:pack.sources.slice(-1),events:[]}).data;
 const next=E.prepare(first,clone(pack)).data;
 next.episodeRecords[2]={status:'complete',date:'2026-10-02',sources:pack.sources.slice(-1),notes:'Verified murder and recruitment only.'};
 next.automation.pendingEvents=next.automation.pendingEvents.filter(p=>p.episode!==10);
 next.automation.partiallyScoredEpisodes=[9];return next;
}
test('Verified finale chronology, winners, survival, all categories and seven contributions reconcile',()=>{
 const d=reviewed(),s=T.compute(d).contestants;
 assert.deepEqual(clone(d.events.filter(e=>e.ep===10).map(e=>e.victim||e.banished||e.winners.join('|'))),['Michael Sheen','Maya Jama','Leigh-Anne Pinnock','King Kenny','James Blunt','Romesh Ranganathan|Sebastian Croft']);
 assert.equal(stable(E.totals(d)),stable({Talia:44,Joe:99,Alex:116,Apala:97,Reuben:44,Julian:103,Ava:70}));
 const expected={'Romesh Ranganathan':53,'Sebastian Croft':55,'James Blunt':43,'King Kenny':51,'Maya Jama':40,'Leigh-Anne Pinnock':38,'Michael Sheen':32,'James Acaster':38};
 for(const [n,points] of Object.entries(expected))assert.equal(s[n].celebScore,points);
 for(const n of ['Romesh Ranganathan','Sebastian Croft']){assert.equal(s[n].cats.winner,5);assert.equal(s[n].survival,20);assert.equal(s[n].status,'winner');}
 assert.equal(s['James Blunt'].cats.winner,undefined);assert.equal(s['Michael Sheen'].cats.murder,undefined);
 const model=build(d,T);
 for(const c of Object.values(s)){assert.equal(Object.values(c.cats).reduce((a,b)=>a+b,0),c.celebScore);assert.equal(c.log.reduce((a,b)=>a+b.pts,0),c.celebScore);assert.equal(c.celebScore*c.multiplier,c.contributed);assert.equal(model.contestants[c.name].history.reduce((a,b)=>a+b.pts,0),c.celebScore);}
 for(const p of model.participants)assert.equal(p.total,p.celebs.reduce((a,c)=>a+c.contributed,0));
 assert.equal(s['Miranda Hart'].celebScore,25);assert.equal(s['Miranda Hart'].contributed,50);assert.equal(stable(d.celebs),stable(baseline.celebs));assert.equal(stable(d.events.filter(e=>e.ep<10)),stable(baseline.events));
 assert.equal(E.prepare(d,clone(pack)).changed,false);D.validate(d);
});
test('Kenny tie and two eligible re-votes are one table, separate banishments score separately',()=>{
 const d=reviewed(),events=d.events.filter(e=>e.ep===10),kenny=events[3],voters=Object.keys(kenny.votes);
 const view=T.ballotView(kenny,voters);assert.equal(view.complete,true);assert.deepEqual(clone(view.tallies),[{'James Blunt':2,'King Kenny':2},{'King Kenny':2}]);
 const before=T.compute({...d,events:d.events.slice(0,-3)}).contestants,after=T.compute({...d,events:d.events.slice(0,-2)}).contestants;
 for(const n of ['James Blunt','Sebastian Croft','Romesh Ranganathan'])assert.equal((after[n].cats.traitorVote||0)-(before[n].cats.traitorVote||0),2);
 assert.equal(T.compute(d).contestants['Sebastian Croft'].cats.traitorVote-T.compute(baseline).contestants['Sebastian Croft'].cats.traitorVote,4);
 const invalid=clone(d);invalid.events.find(e=>e.id===kenny.id).revotes[0]['King Kenny']='James Blunt';assert.throws(()=>D.validate(invalid),/eligible/);
});
test('An end/continue decision cannot be imported as a scoring event or named-contestant ballot',()=>{
 const invalid=clone(pack);invalid.events.splice(1,0,{ep:10,type:'continue',votes:{'King Kenny':'end'}});assert.throws(()=>E.prepare(baseline,invalid),/Unknown event type/);
 const bad=clone(pack);bad.events[1].votes['King Kenny']='continue';assert.throws(()=>E.prepare(baseline,bad),/Votes must be between/);
 assert.equal(pack.events.filter(e=>e.type==='roundtable').length,4);
});
test('Earlier unknown ballot withholds zero-vote bonuses and forces PROVISIONAL despite a complete finale',()=>{
 const d=reviewed(),m=build(d,T);assert.equal(d.episodeRecords[10].status,'complete');assert.equal(m.seriesStatus,'PROVISIONAL');assert.equal(m.partial,true);
 const james=d.events.find(e=>e.banished==='James Acaster');assert.equal(james.votingComplete,false);assert.equal(james.votes['James Acaster'],undefined);assert.equal(james.absent.length,0);
 const partial=clone(d),index=partial.events.findIndex(e=>e.banished==='James Acaster'),before=T.compute({...partial,events:partial.events.slice(0,index)}).contestants,after=T.compute({...partial,events:partial.events.slice(0,index+1)}).contestants;
 for(const n of Object.keys(after))assert.equal(after[n].cats.zeroVote||0,before[n].cats.zeroVote||0);
 // Synthetic complete-series coverage, not a claim that James's ballot is known.
 const complete=clone(d);complete.events.find(e=>e.banished==='James Acaster').votingComplete=true;complete.episodeRecords[9].status='complete';complete.automation.pendingEvents=[];complete.automation.partiallyScoredEpisodes=[];
 assert.equal(build(complete,T).seriesStatus,'PROVISIONAL','A completeness flag alone does not verify an unknown ballot');
 complete.events.find(e=>e.banished==='James Acaster').votes['James Acaster']='Maya Jama';
 assert.equal(build(complete,T).seriesStatus,'FINAL');delete complete.episodeRecords[4];assert.equal(build(complete,T).seriesStatus,'PROVISIONAL');
});
test('Workflow retains reviewed finale; protection is not itself an unresolved scoring event',()=>{
 const d=reviewed(),source={title:'Synthetic incomplete source layout',url:'https://example.org/test'},episodes=Array.from({length:10},(_,i)=>({episode:i+1,source,description:'Fixture',candidates:[],issues:[],noEvents:i===0}));
 const r=merge(d,{episodes,source,recaps:[]},config);
 assert.equal(stable(r.data.events.filter(e=>e.ep===10)),stable(d.events.filter(e=>e.ep===10)));
 assert(r.report.deferred.some(p=>p.episode===10&&p.status==='manual-protected'));assert(!r.report.pendingEvents.some(p=>p.status==='manual-protected'));
 assert(r.report.missingIndividualVotes.some(p=>p.episode===9&&p.voters.includes('James Acaster')));
});
test('Final requires all earlier non-winners eliminated, and prevents duplicate awards or later events',()=>{
 const d=reviewed(),missing=clone(d);missing.events=missing.events.filter(e=>e.banished!=='James Blunt');assert.throws(()=>D.validate(missing),/remaining non-winners/);
 const later=clone(d);later.events.push(clone(d.events.at(-1)));assert.throws(()=>D.validate(later),/IDs must be unique|No events may follow/);
 assert.equal(T.compute(d).contestants['Romesh Ranganathan'].cats.winner,5);
});
