const assert = require('node:assert/strict');
const fs = require('node:fs');
global.window={SWEEPSTAKE:JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'automation/fixtures/baseline-data.json'),'utf8'))}; require('./scoring.js'); require('./validation.js');
const base=window.SWEEPSTAKE, T=window.TraitorsScoring, D=window.SweepstakeData;
const clone=x=>JSON.parse(JSON.stringify(x)); let count=0;
function test(name,fn){fn();console.log('PASS '+name);count++;}
function run(events,originalTraitors=base.originalTraitors){const d=clone(base);d.events=events;d.originalTraitors=originalTraitors;return T.compute(d).contestants;}
const murder={ep:2,type:'murder',victim:'Amol Rajan'};
const recruit={ep:2,type:'recruit',who:'James Acaster',accepted:true};
test('Confirmed draw: 7 participants, 21 contestants, 20 assigned once, Amol unassigned',()=>{
 D.validate(base); assert.equal(base.participants.length,7);assert.equal(new Set(base.celebs.map(c=>c.name)).size,21);
 assert.equal(base.celebs.filter(c=>c.participant).length,20);assert.equal(base.celebs.find(c=>!c.participant).name,'Amol Rajan');
 assert(!base.celebs.some(c=>c.name.includes('Claudia')));
});
test('Initial totals and Miranda multiplier applied exactly once',()=>{
 const s=T.compute(base).contestants, totals=Object.fromEntries(base.participants.map(p=>[p,base.celebs.filter(c=>c.participant===p).reduce((v,c)=>v+s[c.name].contributed,0)]));
 assert.deepEqual(totals,{Talia:7,Joe:7,Alex:6,Apala:6,Reuben:6,Julian:8,Ava:6});
 assert.equal(s['Miranda Hart'].celebScore,2);assert.equal(s['Miranda Hart'].contributed,4);
});
test('Incremental survival with episode history and frozen elimination scores',()=>{
 const s=run([murder,{ep:3,type:'exit',who:'Ross Kemp'}]);
 assert.equal(s['Amol Rajan'].survival,1);assert.equal(s['Ross Kemp'].survival,2);assert.equal(s['Miranda Hart'].survival,3);
 assert.deepEqual(T.history(s['Miranda Hart']).map(h=>h.pts),[1,1,1]);assert.equal(T.history(s['Miranda Hart']).at(-1).cumulative,3);
});
test('Recruitment preserves chronology and only active Traitors earn murder points',()=>{
 const s=run([murder,recruit,{ep:3,type:'exit',who:'Maya Jama'},{ep:3,type:'murder',victim:'Ross Kemp'}]);
 assert.equal(s['Maya Jama'].cols.murder,1);assert.equal(s['Richard E. Grant'].cols.murder,2);assert.equal(s['James Acaster'].cols.murder,1);assert.equal(s['James Acaster'].cols.recruitment,2);
});
test('Voting for any Traitor scores independently, and re-votes do not duplicate bonuses',()=>{
 const s=run([{ep:1,type:'roundtable',votes:{'Miranda Hart':'Maya Jama','Joanne McNally':'Ross Kemp'},revotes:[{'Miranda Hart':'Richard E. Grant'}],absent:['Jerry Hall'],banished:'Richard E. Grant'}]);
 assert.equal(s['Miranda Hart'].cats.traitorVote,2);assert.equal(s['Miranda Hart'].cats.traitorBanished,2);assert.equal(s['Miranda Hart'].cats.zeroVote,undefined);
 assert.equal(s['Jerry Hall'].cats.zeroVote,undefined);assert.equal(s['Jerry Hall'].cats.traitorBanished,2);assert.equal(s['Maya Jama'].cats.zeroVote,undefined);
 assert.equal(s['Miranda Hart'].contributed,s['Miranda Hart'].celebScore*2);
});
test('Faithful banishment rewards Traitors regardless of their votes',()=>{
 const s=run([{ep:1,type:'roundtable',votes:{'Maya Jama':'Richard E. Grant'},banished:'Ross Kemp'}]);assert.equal(s['Maya Jama'].cats.faithfulBanished,2);assert.equal(s['Richard E. Grant'].cats.faithfulBanished,2);
});
test('Shield prevention rewards target only; failed murders earn nothing',()=>{
 const s=run([{ep:1,type:'murder',shielded:'Miranda Hart'},{ep:2,type:'murder'}]);
 assert.equal(s['Miranda Hart'].cats.shield,2);assert.equal(s['Miranda Hart'].survival,1);assert.equal(s['Maya Jama'].cols.murder,0);
});
test('Earlier Faithful points survive later recruitment',()=>{
 const s=run([{ep:1,type:'roundtable',votes:{'James Acaster':'Maya Jama'}},recruit,{ep:3,type:'murder',victim:'Ross Kemp'}]);
 assert.equal(s['James Acaster'].cats.traitorVote,2);assert.equal(s['James Acaster'].cats.recruited,2);assert.equal(s['James Acaster'].cats.murder,1);
});
test('Sole winner reaches 21 survival +5 winner bonus; multiplier includes bonus',()=>{
 const events=base.celebs.filter(c=>c.name!=='Miranda Hart').map(c=>({ep:1,type:'exit',who:c.name}));events.push({ep:2,type:'final',winners:['Miranda Hart']});
 const d=clone(base);d.events=events;D.validate(d);const s=T.compute(d).contestants;
 assert.equal(s['Miranda Hart'].survival,21);assert.equal(s['Miranda Hart'].celebScore,26);assert.equal(s['Miranda Hart'].contributed,52);
 assert.equal(s['Joanne McNally'].cats.winner,undefined);
});
test('Multiple winners get actual incremental survival and individual winner bonuses',()=>{
 const winners=['Miranda Hart','Joanne McNally'];const events=base.celebs.filter(c=>!winners.includes(c.name)).map(c=>({ep:1,type:'exit',who:c.name}));events.push({ep:2,type:'final',winners});const s=run(events);
 winners.forEach(n=>{assert.equal(s[n].survival,20);assert.equal(s[n].cats.winner,5);});
});
test('Event removal and reordering recalculate from scratch',()=>{
 assert.equal(run([])['Miranda Hart'].survival,1);assert.equal(run([recruit,murder])['James Acaster'].cols.murder,1);assert.equal(run([murder,recruit])['James Acaster'].cols.murder,0);
});
test('JSON and data.js import roundtrip; malicious JavaScript rejected',()=>{
 assert.deepEqual(D.parse(JSON.stringify(base)),base);assert.deepEqual(D.parse('window.SWEEPSTAKE = '+JSON.stringify(base)+';'),base);
 assert.throws(()=>D.parse('window.SWEEPSTAKE = alert(1);'));assert.throws(()=>D.parse('window.SWEEPSTAKE = '+JSON.stringify(base)+'; alert(1)'));
});
test('Invalid chronology, partial votes, conflicting Shield and duplicate final rejected',()=>{
 for(const events of [[{ep:1,type:'roundtable',votes:{},revotes:[],absent:[]}],[murder,murder],[{...murder,shielded:'Miranda Hart'}],[{ep:1,type:'final',winners:['Miranda Hart']}],[{ep:1,type:'recruit',who:'Maya Jama',accepted:true}]]){
 const d=clone(base);d.events=events;assert.throws(()=>D.validate(d));}
});
test('Complete Round Table passes validation and imported vote data is preserved',()=>{
 const d=clone(base); const n=d.celebs.map(c=>c.name);d.events=[{ep:1,type:'roundtable',votes:Object.fromEntries(n.map((v,i)=>[v,n[(i+1)%n.length]])),revotes:[{[n[0]]:n[1]}],absent:[],banished:n[0]}]; D.validate(d);assert.deepEqual(D.parse(JSON.stringify(d)),d);
});
test('Traitor winner gets the individual winner bonus',()=>{
 const events=base.celebs.filter(c=>c.name!=='Maya Jama').map(c=>({ep:1,type:'exit',who:c.name}));events.push({ep:2,type:'final',winners:['Maya Jama']});
 const d=clone(base);d.events=events;D.validate(d);const s=T.compute(d).contestants;assert.equal(s['Maya Jama'].cats.winner,5);assert.equal(s['Richard E. Grant'].cats.winner,undefined);
});
console.log(`${count} scoring and data tests passed.`);
