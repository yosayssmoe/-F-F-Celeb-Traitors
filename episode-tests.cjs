const assert=require('node:assert/strict'),fs=require('node:fs');
global.window={SWEEPSTAKE:JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'automation/fixtures/baseline-data.json'),'utf8'))};require('./scoring.js');require('./validation.js');require('./episode-updates.js');
const E=window.EpisodeUpdates,T=window.TraitorsScoring,D=window.SweepstakeData,base=E.migrate(window.SWEEPSTAKE);
const clone=x=>JSON.parse(JSON.stringify(x));let count=0;
const pack=(episode,events)=>({schemaVersion:1,series:E.SERIES,episode,date:'',status:'partial',notes:'Test fixture, not broadcast data',sources:[],events});
function test(n,f){f();count++;console.log('PASS '+n);}
test('Episodes 1 and 2 represented without inventing or duplicating events',()=>{assert(base.episodeRecords[1]);assert(base.episodeRecords[2]);assert.equal(base.events.length,2);assert.equal(T.compute(base).contestants['Amol Rajan'].survival,1);});
test('Historical Episode 1 import preserves every later event and total',()=>{const r=E.prepare(base,JSON.parse(fs.readFileSync('examples/episode-1.json')));assert.deepEqual(r.data.events,base.events);assert.deepEqual(r.beforeTotals,r.afterTotals);assert(r.historical);});
test('Episode 2 snapshot replaces existing events rather than appending',()=>{const p=JSON.parse(fs.readFileSync('examples/episode-2.json'));const r=E.prepare(base,p);assert.equal(r.data.events.length,2);assert.deepEqual(r.beforeTotals,r.afterTotals);const again=E.prepare(r.data,p);assert.equal(again.changed,false);assert.equal(again.data.episodeAudit.length,1);});
test('New episode, role chronology and Miranda multiplier',()=>{const r=E.prepare(base,pack(3,[{type:'murder',victim:'Ross Kemp'},{type:'murder',shielded:'Miranda Hart'}]));const s=T.compute(r.data).contestants;assert.equal(s['James Acaster'].cols.murder,1);assert.equal(s['Richard E. Grant'].cols.murder,2);assert.equal(s['Miranda Hart'].cats.shield,2);assert.equal(r.afterTotals.Ava,13);assert.equal(s['Miranda Hart'].contributed,10);});
test('Partial voting retains known bonuses and withholds ALL zero-vote points',()=>{const r=E.prepare(base,pack(3,[{type:'roundtable',votes:{'Miranda Hart':'Maya Jama'},revotes:[],absent:[],banished:'Richard E. Grant'}]));const s=T.compute(r.data).contestants;assert.equal(s['Miranda Hart'].cats.traitorVote,2);assert.equal(s['Miranda Hart'].cats.traitorBanished,2);assert(Object.values(s).every(x=>!x.cats.zeroVote));assert(r.warnings.some(x=>x.includes('withheld')));});
test('Completing voting adds zero-vote points once, including re-votes',()=>{
 const active=base.celebs.map(c=>c.name).filter(n=>n!=='Amol Rajan');const votes=Object.fromEntries(active.map(n=>[n,n==='Maya Jama'?'Richard E. Grant':'Maya Jama']));
 const ev={type:'roundtable',votes,revotes:[{'Miranda Hart':'Richard E. Grant'}],absent:[],banished:'Richard E. Grant',votingComplete:false};
 const partial=E.prepare(base,pack(3,[ev])).data;ev.votingComplete=true;const full=E.prepare(partial,pack(3,[ev])).data;const s=T.compute(full).contestants;
 assert.equal(s['Miranda Hart'].cats.zeroVote,1);assert.equal(s['Miranda Hart'].cats.traitorVote,2);assert.equal(full.events.length,3);assert.equal(E.prepare(full,pack(3,[ev])).changed,false);
});
test('False completeness and incomplete complete episode are rejected',()=>{
 assert.throws(()=>E.prepare(base,pack(3,[{type:'roundtable',votes:{},revotes:[],absent:[],votingComplete:true}])));
 const p=pack(3,[{type:'roundtable',votes:{},revotes:[],absent:[],votingComplete:false}]);p.status='complete';assert.throws(()=>E.prepare(base,p));
});
test('Duplicate IDs, duplicate payloads and wrong episode IDs rejected',()=>{
 assert.throws(()=>E.prepare(base,pack(3,[{type:'murder',shielded:'Miranda Hart',id:'ep3-a'},{type:'murder',shielded:'Miranda Hart',id:'ep3-b'}])));
 assert.throws(()=>E.prepare(base,pack(3,[{type:'murder',shielded:'Miranda Hart',id:'ep2-a'}])));
 assert.throws(()=>E.prepare(base,pack(3,[{type:'exit',who:'Ross Kemp',ep:4}])));
});
test('Historical change validates all later role-dependent events atomically',()=>{
 const d=E.prepare(base,pack(3,[{type:'recruit',who:'Ross Kemp',accepted:true}])).data;
 const p=pack(2,[...clone(base.events),{type:'exit',who:'Ross Kemp'}]);assert.throws(()=>E.prepare(d,p));assert.equal(d.events.length,3);
});
test('Historical correction preserves other episode histories and records audit',()=>{
 const d=E.prepare(base,pack(4,[{type:'exit',who:'Jerry Hall'}])).data;
 const r=E.prepare(d,pack(3,[{type:'exit',who:'Ross Kemp'}]));assert.deepEqual(r.data.events.filter(e=>e.ep===4),d.events.filter(e=>e.ep===4));assert.equal(r.data.episodeAudit.length,2);assert.equal(r.afterTotals.Ava,12);
});
test('Sources and audit survive full data.js export/import',()=>{
 const d=E.prepare(base,JSON.parse(fs.readFileSync('examples/episode-2.json'))).data;assert.deepEqual(D.parse('window.SWEEPSTAKE = '+JSON.stringify(d)+';'),d);
});
test('Fetched repeat observations preserve manually corrected data and flag conflicts',()=>{
 const old=E.snapshot(base,2),same=clone(old);assert.equal(E.combine(old,same).package.events.length,2);
 same.events[1].accepted=false;const r=E.combine(old,same);assert.equal(r.package.events[1].accepted,true);assert(r.warnings.length);
});
test('Unknown contestants, malicious links and wrong season rejected',()=>{
 assert.throws(()=>E.prepare(base,pack(3,[{type:'exit',who:'Claudia Winkleman'}])));
 const p=pack(3,[]);p.sources=[{title:'x',url:'javascript:alert(1)'}];assert.throws(()=>E.prepare(base,p));p.sources=[];p.series='uk-2';assert.throws(()=>E.prepare(base,p));
});
console.log(`${count} episode update tests passed.`);
