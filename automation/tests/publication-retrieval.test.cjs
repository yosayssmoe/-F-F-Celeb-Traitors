const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),yaml=require('yaml');
const {deploymentNeeded}=require('../deployment-needed.cjs'),{get,corroborate}=require('../retrieve.cjs'),{verifyVotes}=require('../wikipedia.cjs');
const config=require('../config.json');
test('Pages retry publishes unchanged verified data after a missed deployment; no-change stays no-change when public data matches',async()=>{
 const base={eventName:'schedule',local:'verified',url:'https://example.invalid/data.js'};
 assert.equal((await deploymentNeeded({...base,fetcher:async()=>({ok:true,text:async()=>'verified'})})).deploy,false);
 assert.equal((await deploymentNeeded({...base,fetcher:async()=>({ok:true,text:async()=>'stale'})})).deploy,true);
 assert.equal((await deploymentNeeded({...base,fetcher:async()=>{throw Error('offline');}})).deploy,true);
 assert.equal((await deploymentNeeded({...base,committed:true,fetcher:()=>{throw Error('must not fetch');}})).deploy,true);
});
test('Workflow retrieves on manual deploy_current=false, gates all Pages steps on publication decision and persists metadata through data.js',()=>{
 const w=yaml.parse(fs.readFileSync(path.resolve(__dirname,'../../.github/workflows/update-episodes.yml'),'utf8')),steps=w.jobs.update.steps;
 assert.equal(w.on.workflow_dispatch.inputs.deploy_current.default,false);
 assert.equal(steps.find(s=>s.id==='results').if,"github.event_name != 'push' && inputs.deploy_current != true");
 assert(steps.findIndex(s=>s.id==='publication')>steps.findIndex(s=>s.id==='commit'));
 for(const name of ['Prepare Pages artifact','Configure Pages','Upload Pages artifact','Deploy the verified site'])assert.equal(steps.find(s=>s.name===name).if,"steps.publication.outputs.deploy == 'true'");
 assert(w.on.schedule.some(s=>s.cron==='0 10 * * *'&&s.timezone==='Europe/London'));
});
test('Transient source failure retries; terminal HTTP errors stop without scoring',async()=>{
 const previous=global.fetch;let calls=0;
 try{
  global.fetch=async()=>++calls===1?{ok:false,status:503}:{ok:true,text:async()=>'source'};
  assert.equal(await get('https://example.invalid',config),'source');assert.equal(calls,2);
  calls=0;global.fetch=async()=>{calls++;return {ok:false,status:404};};await assert.rejects(get('https://example.invalid',config),/HTTP 404/);assert.equal(calls,1);
 }finally{global.fetch=previous;}
});
test('Invalid re-vote targets and unverified ties do not earn vote bonuses',()=>{
 const c={event:{type:'roundtable',banished:'A'},rounds:[{votes:{A:'B',B:'A',C:'A',D:'B'},raw:{},tally:'2–2'},{votes:{C:'D',D:'A'},raw:{},tally:'1–1'}]};
 let r=verifyVotes(c,{active:['A','B','C','D']});assert.equal(r.votingComplete,false);assert.equal(r.revotes[0].C,undefined);assert.equal(r.revotes[0].D,'A');
 c.rounds[0].votes.D='A';r=verifyVotes(c,{active:['A','B','C','D']});assert.equal(r.votingComplete,false);assert.deepEqual(r.revotes,[]);
});
test('Independent recap disagreement explicitly blocks chronology rather than choosing a source',async()=>{
 const previous=global.fetch;
 const candidates=[{event:{type:'murder',victim:'A'},key:'murder:A',evidence:[]},{event:{type:'roundtable',banished:'B'},key:'roundtable:B',evidence:[]}];
 const ep={episode:4,candidates,issues:[],safePrefix:2};
 try{
  global.fetch=async()=>({ok:true,text:async()=>'<article><p>B was banished. A was murdered.</p></article>'});
  await corroborate({episodes:[ep],recaps:[{episode:4,url:'https://www.bbc.co.uk/example'}]},config,[]);
  assert(ep.issues.some(x=>x.status==='conflicting'));assert.equal(ep.candidates[0].key,'murder:A');
 }finally{global.fetch=previous;}
});
