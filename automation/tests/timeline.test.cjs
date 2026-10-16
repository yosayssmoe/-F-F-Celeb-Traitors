const {test}=require('node:test'),assert=require('node:assert/strict');
const {clone,load,T,E,stable}=require('../shared.cjs');
const {resolveChronology,dependent}=require('../chronology.cjs');
const {merge}=require('../merge.cjs'),{parseWikipedia}=require('../wikipedia.cjs');
const config=require('../config.json'),published=require('../fixtures/published-episode3.json');
const four=require('../fixtures/episode4-facts.json'),five=require('../fixtures/episode5-facts.json');
const source=five.source;
const candidate=event=>({event,key:event.type+':'+(event.who||event.victim||event.shielded||event.banished),verified:true,evidence:['Synthetic future fixture; not a broadcast claim']});
function episode(n,events,description=''){const ep={episode:n,source,description,candidates:events.map(candidate),issues:[]};resolveChronology(ep);return ep;}
function real(facts){const ep={...clone(facts),issues:[]};resolveChronology(ep);return ep;}
const run=(episodes,data=published)=>merge(clone(data),{source,episodes,recaps:[]},config,'2026-10-16T12:00:00Z');
const murder=(ep=7)=>({ep,type:'murder',victim:'Ross Kemp'});
const recruit=(ep=7,who='Miranda Hart')=>({ep,type:'recruit',who,accepted:true});
const shield=(ep=7)=>({ep,type:'murder',shielded:'Jerry Hall'});

test('Pinned Episode 5 facts resolve murder, banishment, recruitment, all votes and draw invariants',()=>{
 const before=run([real(four)]).data,r=run([real(five)],before);
 assert.deepEqual(r.report.accepted.map(a=>a.event),['murder:Rob Beckett','roundtable:Hannah Fry','recruit:King Kenny']);
 assert.equal(r.data.events.find(e=>e.ep===5&&e.type==='roundtable').votingComplete,true);
 assert.equal(r.report.latestEpisodeFullyScored,5);
 assert.deepEqual(r.report.afterTotals,{Talia:40,Joe:51,Alex:56,Apala:60,Reuben:44,Julian:51,Ava:56});
 assert.deepEqual(r.data.events.filter(e=>e.ep<5),before.events);
 const scores=T.compute(r.data).contestants;
 assert.equal(scores['King Kenny'].cats.murder,undefined);assert.equal(scores['King Kenny'].role,'Traitor');
 assert.equal(r.report.afterTotals.Ava,scores['Joanne McNally'].celebScore+2*scores['Miranda Hart'].celebScore);
 assert.equal(run([real(five)],r.data).changed,false);
});

test('Episodes 1–6 replay: existing 1–4, verified 5, unpublished 6 stays pending',()=>{
 const before=run([real(four)]).data;
 const eps=[{episode:1,source,candidates:[],issues:[],noEvents:true,description:'Starting roles only.'}];
 for(const n of [2,3,4]){const e=episode(n,before.events.filter(e=>e.ep===n));resolveChronology(e,before.events.filter(e=>e.ep===n));eps.push(e);}
 eps.push(real(five),episode(6,[]));
 const r=run(eps,before);assert.equal(r.report.latestEpisodeFullyScored,5);
 assert(r.report.pendingEvents.some(p=>p.episode===6&&p.status==='not-published'));
 assert.equal(r.data.events.filter(e=>e.ep===6).length,0);
 assert.equal(run(eps,r.data).changed,false);
});

test('Episode 5 actual parser reads normalized source facts, merged columns and recruitment note',()=>{
 const base=run([real(four)]).data,round=five.candidates.find(c=>c.kind==='table').rounds[0];
 const cast=base.celebs.map(c=>`<tr><th>${c.name}</th><td>${c.name==='Hannah Fry'?'Traitor':'Faithful'}</td><td>${c.name==='Rob Beckett'?'Murdered (Episode 5)':c.name==='Hannah Fry'?'Banished (Episode 5)':'Participating'}</td></tr>`).join('');
 const rows=base.celebs.map(c=>`<tr><th>${c.name}</th><td colspan="2">${round.raw[c.name]}</td></tr>`).join('');
 const html=`<li>Kenny was recruited as a Traitor in Episode 5.</li><table class="wikitable"><tr><th>Contestant</th><th>Affiliation</th><th>Finish</th></tr>${cast}</table><table class="wikitable"><tr><th>Episode</th><th colspan="2">5</th></tr><tr><th rowspan="2">Traitors' Decision</th><td>Rob</td><td>Kenny</td></tr><tr><td>Murder</td><td>Recruit</td></tr><tr><th>Banishment</th><td colspan="2">Hannah</td></tr><tr><th>Vote</th><td colspan="2">12–1–1–1</td></tr>${rows}</table><table><tr class="vevent"><td class="summary">Episode 5</td></tr><tr class="expand-child"><td>${five.description}</td></tr></table>`;
 const p=parseWikipedia({html,revision:source.revision},base,config);
 assert.equal(p.episodes[0].safePrefix,3);assert(p.episodes[0].candidates.every(c=>c.verified));
 assert.equal(merge(base,p,config).report.latestEpisodeFullyScored,5);
});

test('Bare mention order and reversed recap summaries are never chronology evidence',()=>{
 for(const text of ['Ross Kemp was murdered. Miranda Hart was recruited as a Traitor.','Miranda Hart was recruited as a Traitor. Ross Kemp was murdered.']){
  const ep=episode(7,[murder(),recruit()],text);assert.equal(ep.safePrefix,0);assert.equal(ep.timeline.edges.length,0);
 }
});

test('Future episodes support recruitment before OR after murder through explicit clauses',()=>{
 for(const first of ['murder','recruit']){
  const text=first==='murder'?'Ross Kemp was murdered before Miranda Hart was recruited as a Traitor.':'Miranda Hart was recruited as a Traitor before Ross Kemp was murdered.';
  const ep=episode(7,[murder(),recruit()],text);assert.equal(ep.safePrefix,2);assert.equal(ep.candidates[0].event.type,first);
  const r=run([ep]);assert.equal(r.report.accepted.length,2);
  assert.equal(T.compute(r.data).contestants['Miranda Hart'].cats.murder,first==='recruit'?1:undefined);
 }
});

test('Unresolved role chronology stays pending with named dependencies and full candidates',()=>{
 const r=run([episode(7,[murder(),recruit()])]);assert.equal(r.report.accepted.length,0);
 const pending=r.report.pendingEvents.filter(p=>p.event);assert.equal(pending.length,2);
 assert(pending.every(p=>p.dependencies.length&&p.candidate.event&&p.sources.length));
 assert.equal(run([episode(7,[murder(),recruit()])],r.data).changed,false);
});

test('Independent shield save passes unresolved chronology, including in a later episode',()=>{
 const ep=episode(7,[murder(),recruit(),shield()]);
 assert.deepEqual(ep.candidates.slice(0,ep.safePrefix).map(c=>c.key),['murder:Jerry Hall']);
 const r=run([ep,episode(8,[{ep:8,type:'recruit',who:'James Blunt',accepted:true}])]);
 assert.equal(r.report.accepted.length,1); // successful murder and unknown recruit affect later recruitment eligibility
 const later=run([episode(7,[recruit()]),episode(8,[{ep:8,type:'murder',shielded:'Jerry Hall'}])]);
 assert.equal(later.report.accepted.length,2);
});

test('One unverified recruitment does not block independent later recruitment or shield',()=>{
 const ep=episode(7,[recruit()]);ep.candidates[0].verified=false;
 const r=run([ep,episode(8,[{ep:8,type:'recruit',who:'James Blunt',accepted:true},{ep:8,type:'murder',shielded:'Jerry Hall'}])]);
 assert.equal(r.report.accepted.length,2);assert(r.report.pendingEvents.some(p=>p.event==='recruit:Miranda Hart'));
 assert.equal(r.data.episodeRecords[8].status,'complete');
});

test('A pending role change blocks a later murder with an explicit dependency',()=>{
 const ep=episode(7,[recruit()]);ep.candidates[0].verified=false;
 const r=run([ep,episode(8,[murder(8)])]);assert.equal(r.report.accepted.length,0);
 assert(r.report.pendingEvents.find(p=>p.episode===8).dependencies.includes('ep7:recruit:Miranda Hart'));
});

test('Scheduled recheck backfills unresolved chronology once and preserves independent imports',()=>{
 const pending=episode(7,[murder(),recruit(),shield()]);const initial=run([pending]);
 const resolved=episode(7,[murder(),recruit(),shield()],'Ross Kemp was murdered before Miranda Hart was recruited as a Traitor.');
 resolveChronology(resolved,initial.data.events.filter(e=>e.ep===7));
 const r=run([resolved],initial.data);assert.equal(r.report.accepted.length,2);assert.equal(r.report.pendingEvents.length,0);
 assert.equal(r.data.events.find(e=>e.shielded).id,initial.data.events.find(e=>e.shielded).id);
 assert.equal(run([resolved],r.data).changed,false);
});

test('Pending evidence disappearing from a new revision cannot silently unblock later scoring',()=>{
 const ep=episode(7,[recruit()]);ep.candidates[0].verified=false;const initial=run([ep]);
 const r=run([episode(7,[]),episode(8,[murder(8)])],initial.data);
 assert.equal(r.report.accepted.length,0);assert(r.report.pendingEvents.some(p=>p.status==='source-missing'&&p.event==='recruit:Miranda Hart'));
 assert.equal(run([episode(7,[]),episode(8,[murder(8)])],r.data).changed,false);
});

test('Source chronology cycles fail closed without replacing published history',()=>{
 const ep=episode(7,[murder(),recruit()],'Ross Kemp was murdered before Miranda Hart was recruited as a Traitor.');
 ep.externalEdges=[{before:'recruit:Miranda Hart',after:'murder:Ross Kemp',reason:'explicit-temporal-clause',source:{url:'https://www.bbc.co.uk/example'}}];resolveChronology(ep);
 assert.equal(ep.timeline.status,'conflicting');assert.equal(ep.safePrefix,0);assert.equal(run([ep]).report.accepted.length,0);
});

test('Negated and speculative temporal clauses cannot establish chronology',()=>{
 for(const text of ['If Ross Kemp was murdered before Miranda Hart was recruited as a Traitor.','Ross Kemp was not murdered before Miranda Hart was recruited as a Traitor.','Ross Kemp might be murdered before Miranda Hart was recruited as a Traitor.'])assert.equal(episode(7,[murder(),recruit()],text).safePrefix,0);
});

test('Multiple Round Tables use verified voting-column sequence; unordered table objects remain pending',()=>{
 const a=candidate({ep:7,type:'roundtable',banished:'Ross Kemp',votes:{},revotes:[],absent:[],votingComplete:false}),b=candidate({ep:7,type:'roundtable',banished:'Jerry Hall',votes:{},revotes:[],absent:[],votingComplete:false});
 a.kind=b.kind='table';const ep={episode:7,source,candidates:[b,a],issues:[]};resolveChronology(ep);assert.equal(ep.safePrefix,0);
 a.column=2;b.column=3;resolveChronology(ep);assert.equal(ep.safePrefix,2);assert.equal(ep.candidates[0].event.banished,'Ross Kemp');
 assert.equal(run([ep]).report.accepted.length,2);
});

test('An explicitly ordered unusual exit uses the original scoring engine',()=>{
 const ep=episode(7,[{ep:7,type:'exit',who:'Ross Kemp'}]);const r=run([ep]);
 assert.equal(r.report.accepted.length,1);assert.equal(T.compute(r.data).contestants['Ross Kemp'].status,'left');
 assert.equal(r.report.afterTotals.Ava,E.totals(r.data).Ava);
});

test('Dependency classification is symmetric and conservative for global state changes',()=>{
 const events=[murder(),recruit(),shield(),{ep:7,type:'roundtable',banished:'Ross Kemp'},{ep:7,type:'exit',who:'Ross Kemp'},{ep:7,type:'final',winners:['Miranda Hart']}];
 for(const a of events)for(const b of events)assert.equal(dependent(a,b),dependent(b,a));
 assert.equal(dependent(recruit(),shield()),false);assert.equal(dependent(null,shield()),true);
});
