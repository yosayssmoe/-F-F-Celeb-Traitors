const {test}=require('node:test'),assert=require('node:assert/strict');
const {selectRevision,facts}=require('../select-revision.cjs'),{matureWikipedia}=require('../retrieve.cjs');
const {merge}=require('../merge.cjs'),{clone,stable,T,hash}=require('../shared.cjs');
const data=require('../fixtures/published-episode6.json'),ep7=require('../fixtures/episode7-facts.json'),config=require('../config.json');
const now=Date.parse('2026-10-23T09:25:26.189Z');
// Normalized verified table facts, not full articles. Synthetic mutations below
// exercise future corrections and cosmetic edits; they are not broadcast claims.
function html({victim='Ross Kemp',banished='Jerry Hall',changeVote=false,changeActiveRole=false}={}){
 const state=T.compute(data).contestants,round=ep7.candidates.find(c=>c.kind==='table').rounds[0];
 const cast=data.celebs.map(c=>{
  const s=state[c.name];let finish=s.status==='active'?'Participating':`${s.status==='murdered'?'Murdered':'Banished'} (Episode ${s.exitEp})`;
  if(c.name===victim)finish='Murdered (Episode 7)';if(c.name===banished)finish='Banished (Episode 7)';
  return `<tr><th>${c.name}</th><td>${changeActiveRole&&c.name==='Miranda Hart'?'Traitor':s.role}</td><td>${finish}</td></tr>`;
 }).join('');
 const rows=data.celebs.map(c=>`<tr><th>${c.name}</th><td>${changeVote&&c.name==='Miranda Hart'?'Maya Jama':round.raw[c.name]}</td></tr>`).join('');
 return `<table class="wikitable"><tr><th>Contestant</th><th>Affiliation</th><th>Finish</th></tr>${cast}</table><table class="wikitable"><tr><th>Episode</th><th>7</th></tr><tr><th rowspan="2">Traitors' Decision</th><td>${victim}</td></tr><tr><td>Murder</td></tr><tr><th>Banishment</th><td>${banished}</td></tr><tr><th>Vote</th><td>${round.tally}</td></tr>${rows}</table>`;
}
const latest=(h=html())=>({revision:1381559156,timestamp:'2026-10-23T09:21:31Z',html:h,retrievedAt:'2026-10-23T09:25:26Z'});
const mature=(h=html())=>({revision:1381501791,timestamp:'2026-10-22T23:13:57Z',html:h,retrievedAt:'2026-10-23T09:25:26Z'});
const choose=(a=latest(),b=mature())=>selectRevision(a,clone(data),config,{now,getMature:async()=>b});

test('23 October age-starvation reproduction: mature Episode 7 facts survive an unrelated recent edit',async()=>{
 const r=await choose(latest(html()+'<p>Cosmetic display-only edit.</p>'));
 assert.equal(r.selection.strategy,'mature-with-latest-agreement');assert.equal(r.snapshot.revision,1381501791);
 assert.equal(r.selection.latestAge.deferred,true);assert.equal(r.timing.deferred,false);assert(r.timing.ageSeconds>=1800);
 assert.equal(r.selection.matureFactsHash,r.selection.latestFactsHash);
 const scored=merge(clone(data),r.parsed,config,'2026-10-23T09:25:26Z');
 assert.deepEqual(scored.report.accepted.map(e=>e.event),['murder:Ross Kemp','roundtable:Jerry Hall']);
 assert.equal(scored.data.events.at(-1).votingComplete,true);assert.equal(Object.keys(scored.data.events.at(-1).votes).length,12);
 assert.deepEqual(scored.report.afterTotals,{Talia:44,Joe:71,Alex:65,Apala:74,Reuben:44,Julian:65,Ava:69});
 assert.deepEqual(scored.data.events.filter(e=>e.ep<=6),data.events);
 assert.deepEqual(scored.data.celebs,data.celebs);assert.equal(scored.data.celebs.find(c=>c.name==='Miranda Hart').multiplier,2);
 assert.equal(merge(scored.data,r.parsed,config).changed,false);
});

test('Mature latest revision takes the normal path without a history query',async()=>{
 const r=await selectRevision(mature(),data,config,{now,getMature:()=>{throw Error('must not fetch history');}});
 assert.equal(r.selection.strategy,'latest-mature');assert(r.parsed);assert.equal(r.timing.deferred,false);
});

test('Fresh result, changed vote, removed result or conflicting identity cannot revive stale facts',async()=>{
 for(const changed of [html({victim:'Sharon Rooney'}),html({changeVote:true}),html({banished:'Miranda Hart'}),html({victim:'None',banished:'None'})]){
  const r=await choose(latest(changed));assert.equal(r.parsed,null);assert.equal(r.selection.strategy,'deferred');
  assert.deepEqual(r.selection.differingEpisodes,[7]);assert.match(r.selection.reason,/differ/);
 }
});

test('Every role, attendance, vote completeness and chronology constraint participates in agreement',async()=>{
 const r=await choose(),original=facts(r.parsed);
 const mutations=[p=>p.episodes[0].candidates[0].verified=false,p=>p.episodes[0].candidates[0].observedRole='Traitor',p=>p.episodes[0].candidates[1].rounds[0].raw['Miranda Hart']='Absent',p=>p.episodes[0].candidates[1].rounds[0].tally='1',p=>p.episodes[0].timeline.edges=[],p=>p.episodes[0].issues.push({status:'unsupported',detail:'Unverified role change'})];
 for(const mutate of mutations){const p=clone(r.parsed);mutate(p);assert.notEqual(hash(facts(p)),hash(original));}
});

test('A recent active-cast role correction also blocks fallback even without a parsed recruitment',async()=>{
 const r=await choose(latest(html({changeActiveRole:true})));assert.equal(r.parsed,null);assert.equal(r.selection.castChanged,true);
});

test('Unavailable/empty mature history safely defers; an ineligible historical revision cannot score',async()=>{
 assert.equal((await choose(latest(),null)).parsed,null);
 const r=await selectRevision(latest(),data,config,{now,getMature:async()=>{throw Error('HTTP 503');}});assert.equal(r.parsed,null);assert.match(r.selection.reason,/retrieval failed/);
 await assert.rejects(choose(latest(),{...mature(),timestamp:'2026-10-23T09:21:30Z'}),/minimum age/);
 await assert.rejects(choose(latest(),{...mature(),timestamp:'2026-10-23T09:26:00Z'}),/future/);
});

test('An unrecognised latest source never falls back to potentially superseded old results',async()=>{
 await assert.rejects(choose(latest('<p>Unsupported layout</p>')),/table not recognised/);
});

test('Historical API query selects newest revision at/before the age cutoff and pins its HTML',async()=>{
 const previous=global.fetch,requests=[],log=[];
 try{
  global.fetch=async raw=>{
   const url=new URL(raw);requests.push(url);const result=url.searchParams.get('action')==='query'?{query:{pages:[{revisions:[{revid:1381501791,timestamp:mature().timestamp}]}]}}:{parse:{revid:1381501791,text:{'*':html()}}};
   return {ok:true,text:async()=>JSON.stringify(result)};
  };
  const result=await matureWikipedia(config,log,now);assert.equal(result.revision,1381501791);
  assert.equal(requests[0].searchParams.get('rvstart'),'2026-10-23T08:55:26.189Z');assert.equal(requests[0].searchParams.get('rvdir'),'older');assert.equal(requests[0].searchParams.get('rvlimit'),'1');
  assert.equal(requests[1].searchParams.get('oldid'),'1381501791');assert(log.every(r=>r.status==='retrieved'));
 }finally{global.fetch=previous;}
});

test('Historical retrieval rejects a mismatched pinned parse and handles empty history',async()=>{
 const previous=global.fetch;
 try{
  global.fetch=async raw=>({ok:true,text:async()=>JSON.stringify(new URL(raw).searchParams.get('action')==='query'?{query:{pages:[{revisions:[{revid:1,timestamp:mature().timestamp}]}]}}:{parse:{revid:2,text:{'*':html()}}})});
  await assert.rejects(matureWikipedia(config,[],now),/revision changed or parse failed/);
  global.fetch=async()=>({ok:true,text:async()=>JSON.stringify({query:{pages:[{}]}})});assert.equal(await matureWikipedia(config,[],now),null);
 }finally{global.fetch=previous;}
});

test('Complete updater path writes mature agreed results, but a recent correction leaves data untouched',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {serialize,load}=require('../shared.cjs'),{main}=require('../update.cjs');
 const previousFetch=global.fetch,previousCode=process.exitCode;
 const savedEnv={GITHUB_OUTPUT:process.env.GITHUB_OUTPUT,GITHUB_STEP_SUMMARY:process.env.GITHUB_STEP_SUMMARY};
 delete process.env.GITHUB_OUTPUT;delete process.env.GITHUB_STEP_SUMMARY;
 try{for(const correction of [false,true]){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ff-selection-')),file=path.join(dir,'data.js'),original=serialize(data);fs.writeFileSync(file,original);
  global.fetch=async raw=>{
   const q=new URL(raw).searchParams,old=q.get('action')==='query'?q.has('rvstart'):q.get('oldid')==='1381501791';
   const snapshot=old?mature():latest(correction?html({changeVote:true}):html()+'<p>Unrelated edit</p>');
   const body=q.get('action')==='query'?{query:{pages:[{revisions:[{revid:snapshot.revision,timestamp:snapshot.timestamp}]}]}}:{parse:{revid:snapshot.revision,text:{'*':snapshot.html}}};
   return {ok:true,text:async()=>JSON.stringify(body)};
  };
  const r=await main(['--write'],{dataFile:file,outputDirectory:path.join(dir,'reports'),now});
  assert.equal(process.exitCode,previousCode);
  if(correction){assert.equal(r.outcome,'deferred');assert.equal(r.accepted.length,0);assert.equal(fs.readFileSync(file,'utf8'),original);}
  else {assert.equal(r.outcome,'verified-changes');assert.equal(r.revisionSelection.strategy,'mature-with-latest-agreement');assert.equal(r.sourceRevision,1381501791);assert.equal(load(file).events.filter(e=>e.ep===7).length,2);}
 }}finally{
  global.fetch=previousFetch;process.exitCode=previousCode;
  for(const [k,v] of Object.entries(savedEnv))if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
});
