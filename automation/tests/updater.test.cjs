const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {clone,stable,T,E,serialize,D,payload,hash}=require('../shared.cjs'),{merge}=require('../merge.cjs'),{parseWikipedia,verifyVotes}=require('../wikipedia.cjs');
const baseline=require('../fixtures/baseline-data.json'),config=require('../config.json');
const source={title:'Synthetic test source',url:'https://en.wikipedia.org/w/index.php?oldid=123',retrievedAt:'2026-10-09T09:00:00Z',revision:123,revisionTimestamp:'2026-10-09T07:00:00Z'};
const candidate=event=>({event,key:event.type+':'+(event.who||event.victim||event.shielded||event.banished||''),verified:true,evidence:['Fixture: explicit event','Fixture: supporting section']});
const episode=(n,events,extra={})=>({episode:n,date:'2026-10-08',source,candidates:events.map(candidate),issues:[],...extra});
const parse=eps=>({source,episodes:[{episode:1,source,candidates:[],issues:[],noEvents:true},episode(2,clone(baseline.events)),...eps],recaps:[]});
const run=eps=>merge(clone(baseline),parse(eps),config,'2026-10-09T09:00:00Z');
function round(ep,banished,votes={},raw={},tally=''){const c=candidate({ep,type:'roundtable',banished,votes:{},revotes:[],absent:[],votingComplete:false});c.rounds=[{votes,raw,tally}];return c;}
test('No new verified facts is byte-equivalent, including dates and event history',()=>{const r=run([]);assert.equal(r.changed,false);assert.equal(stable(r.data),stable(baseline));assert.equal(r.report.accepted.length,0);});
test('Murder awards survival and only currently active Traitors',()=>{const r=run([episode(3,[{ep:3,type:'murder',victim:'Ross Kemp'}])]);assert(r.changed);const s=T.compute(r.data).contestants;assert.equal(s['James Acaster'].cols.murder,1);assert.equal(s['Maya Jama'].cols.murder,2);assert.equal(s['Amol Rajan'].survival,1);assert.equal(s['Miranda Hart'].survival,3);assert.equal(r.report.afterTotals.Ava,9);});
test('Partial verified banishment scores team/survival; no zero-vote assumption',()=>{const c=round(3,'Richard E. Grant',{'Miranda Hart':'Richard E. Grant'});const r=run([episode(3,[],{candidates:[c]})]);const s=T.compute(r.data).contestants;assert.equal(s['Miranda Hart'].cats.traitorVote,2);assert.equal(s['Miranda Hart'].cats.traitorBanished,2);assert.equal(s['Miranda Hart'].cats.zeroVote,undefined);assert.equal(r.data.automation.votingData,'Partial');});
test('Complete later voting backfills once and a repeat changes no metadata',()=>{
 const active=baseline.celebs.map(c=>c.name).filter(n=>n!=='Amol Rajan'),votes=Object.fromEntries(active.map(n=>[n,n==='Richard E. Grant'?'Maya Jama':'Richard E. Grant']));
 const partial=round(3,'Richard E. Grant',{'Miranda Hart':'Richard E. Grant'});const initial=run([episode(3,[],{candidates:[partial]})]).data;
 const full=round(3,'Richard E. Grant',votes,clone(votes),'19–1');const p=parse([episode(3,[],{candidates:[full]})]);const r=merge(initial,p,config,'2026-10-09T10:00:00Z');
 assert(r.changed);assert.equal(r.data.events.length,3);assert.equal(r.report.accepted[0].action,'backfilled');assert.equal(T.compute(r.data).contestants['Miranda Hart'].cats.zeroVote,1);assert.equal(r.report.afterTotals.Ava-r.report.beforeTotals.Ava,5);
 const repeat=merge(r.data,p,config,'2026-10-10T00:00:00Z');assert.equal(repeat.changed,false);assert.equal(stable(repeat.data),stable(r.data));
});
test('Recruitment chronology and Shield save apply Miranda multiplier to all categories',()=>{
 const r=run([episode(3,[{ep:3,type:'murder',shielded:'Miranda Hart'},{ep:3,type:'recruit',who:'Miranda Hart',accepted:true},{ep:3,type:'murder',victim:'Ross Kemp'}])]);const s=T.compute(r.data).contestants;
 assert.equal(s['Miranda Hart'].cols.murder,1);assert.equal(s['Miranda Hart'].cats.shield,2);assert.equal(s['Miranda Hart'].cols.recruitment,2);assert.equal(s['Miranda Hart'].contributed,16);assert.equal(r.report.afterTotals.Ava,19);
});
test('Conflicting votes and regressing source do not overwrite history',()=>{
 const c=round(3,'Richard E. Grant',{'Miranda Hart':'Richard E. Grant'});const d=run([episode(3,[],{candidates:[c]})]).data;
 c.rounds[0].votes['Miranda Hart']='Maya Jama';const r=merge(d,parse([episode(3,[],{candidates:[c]})]),config);assert.equal(r.changed,false);assert.equal(stable(d),stable(r.data));assert(r.report.deferred.some(x=>x.status==='conflicting'));
});
test('Ambiguous chronology blocks episode and subsequent dependent scoring',()=>{const r=run([episode(3,[{ep:3,type:'recruit',who:'Hannah Fry',accepted:true}],{issues:[{status:'ambiguous',detail:'Recruitment timing unknown'}]}),episode(4,[{ep:4,type:'murder',victim:'Ross Kemp'}])]);assert.equal(r.changed,false);assert.equal(r.data.events.length,2);});
test('Duplicate candidates fail validation atomically',()=>{const ev={ep:3,type:'murder',victim:'Ross Kemp'};const r=run([episode(3,[ev,ev])]);assert.equal(r.changed,false);assert.equal(r.data.events.length,2);});
test('Historical backfill preserves later events and recomputes roles',()=>{const d=run([episode(3,[{ep:3,type:'murder',victim:'Ross Kemp'}]),episode(4,[{ep:4,type:'murder',victim:'Jerry Hall'}])]).data;
 const p=parse([episode(3,[{ep:3,type:'murder',victim:'Ross Kemp'},{ep:3,type:'recruit',who:'Miranda Hart',accepted:true}]),episode(4,[{ep:4,type:'murder',victim:'Jerry Hall'}])]);const r=merge(d,p,config);assert(r.changed);assert.equal(r.data.events.filter(e=>e.ep===4).length,1);assert.equal(T.compute(r.data).contestants['Miranda Hart'].cols.murder,1);});
test('Manual change and manual deletion are protected, including missing metadata on changed fields',()=>{
 const d=run([episode(3,[{ep:3,type:'murder',victim:'Ross Kemp'}])]).data;
 d.events[2].victim='Jerry Hall';let r=merge(d,parse([episode(3,[{ep:3,type:'murder',victim:'Ross Kemp'}])]),config);assert.equal(r.changed,false);assert.equal(r.data.events[2].victim,'Jerry Hall');
 d.events.pop();r=merge(d,parse([episode(3,[{ep:3,type:'murder',victim:'Ross Kemp'}])]),config);assert.equal(r.changed,false);assert.equal(r.data.events.length,2);
});
test('Independent corroboration can be required by configuration',()=>{const r=merge(clone(baseline),parse([episode(3,[{ep:3,type:'murder',victim:'Ross Kemp'}])]),{...config,requireIndependentCorroboration:true});assert.equal(r.changed,false);});
test('Wrong allocation or multiplier halts automation',()=>{const d=clone(baseline);d.celebs.find(c=>c.name==='Miranda Hart').multiplier=1;assert.throws(()=>merge(d,parse([]),config));});
test('Winner bonus remains in the existing engine, no separate scoring implementation',()=>{
 const d=clone(baseline);d.events=d.celebs.filter(c=>c.name!=='Miranda Hart').map(c=>({ep:2,type:'exit',who:c.name}));
 const p={source,recaps:[],episodes:[episode(3,[{ep:3,type:'final',winners:['Miranda Hart']}])]};const r=merge(d,p,config);assert(r.changed);assert.equal(r.report.afterTotals.Ava,T.compute(r.data).contestants['Joanne McNally'].celebScore+52);
});
test('Validated export/import preserves event provenance and revision audit',()=>{const d=run([episode(3,[{ep:3,type:'murder',victim:'Ross Kemp'}])]).data;assert.equal(stable(D.parse(serialize(d))),stable(d));assert.equal(d.events[2].automation.verification,'structured-verified');assert(d.episodeAudit[0].previousEvents);});
test('Re-votes require tied first round, eligible voters and matching tallies',()=>{
 const step={active:['A','B','C','D']};const c=round(3,'A');c.rounds=[{votes:{A:'B',B:'A',C:'A',D:'B'},raw:{},tally:'2–2'},{votes:{C:'A',D:'A'},raw:{},tally:'2'}];assert.equal(verifyVotes(c,step).votingComplete,true);
 c.rounds[1].votes.D='C';assert.equal(verifyVotes(c,step).votingComplete,false);
});
// Tiny synthetic source fixtures, not broadcast claims or copied articles.
function htmlFixture({unknown=false,finish='Murdered (Episode 3)',kind='Murder',target='Ross Kemp'}={}){
 const cast=baseline.celebs.map(c=>`<tr><th>${c.name}</th><td>Faithful</td><td>${c.name==='Ross Kemp'?finish:'Participating'}</td></tr>`).join('');
 const rows=baseline.celebs.map(c=>`<tr><th>${c.name}</th><td></td></tr>`).join('');
 return `<table class="wikitable"><tr><th>Contestant</th><th>Affiliation</th><th>Finish</th></tr>${cast}</table><table class="wikitable"><tr><th>Episode</th><th>3</th></tr><tr><th rowspan="2">Traitors' Decision</th><td>${unknown?'Unknown':target}</td></tr><tr><td>${kind}</td></tr><tr><th>Banishment</th><td>None</td></tr><tr><th>Vote</th><td></td></tr>${rows}</table>`;
}
test('Actual parser accepts cross-checked murder, rejects contradictory/unknown identity',()=>{
 const wrap=html=>({html,revision:1,timestamp:source.revisionTimestamp,retrievedAt:source.retrievedAt});
 const valid=parseWikipedia(wrap(htmlFixture()),baseline,config);assert(valid.episodes[0].candidates[0].verified);
 assert.equal(parseWikipedia(wrap(htmlFixture({finish:'Participating'})),baseline,config).episodes[0].candidates[0].verified,false);
 assert(parseWikipedia(wrap(htmlFixture({unknown:true})),baseline,config).episodes[0].issues.length);
});
test('Shield possession never becomes a prevented murder',()=>{const p=parseWikipedia({html:htmlFixture({kind:'Shield'}),revision:1},baseline,config);assert.equal(p.episodes[0].candidates.length,0);});
test('Unrecognised layout fails closed',()=>assert.throws(()=>parseWikipedia({html:'<h1>No results</h1>'},baseline,config)));
test('Workflow schedules are timezone-aware, serialised, and explicitly deploy with built-in token',()=>{
 const yaml=require('yaml'),w=yaml.parse(fs.readFileSync(path.resolve(__dirname,'../../.github/workflows/update-episodes.yml'),'utf8'));
 assert.deepEqual(w.on.schedule,[{cron:'0 23 * * 4,5',timezone:'Europe/London'},{cron:'0 10 * * 6',timezone:'Europe/London'}]);assert(w.on.workflow_dispatch);assert.equal(w.concurrency['cancel-in-progress'],false);
 assert.equal(w.jobs.update.permissions.contents,'write');assert.equal(w.jobs.update.permissions.pages,'write');assert.equal(w.jobs.update.permissions['id-token'],'write');assert(w.jobs.update.steps.some(s=>s.uses==='actions/deploy-pages@v4'));
 // London observes the required summer/winter wall time using the declared IANA zone.
 const hour=d=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23'}).format(new Date(d));assert.equal(hour('2026-10-08T22:00:00Z'),'23');assert.equal(hour('2026-10-29T23:00:00Z'),'23');
});
test('Real Git commit/push, no-change run, and stale branch protection',()=>{
 const git=process.env.GIT_BINARY||'git';execFileSync(git,['--version']);const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ff-git-test-')),remote=path.join(dir,'remote.git'),work=path.join(dir,'work');
 const command=(cwd,...args)=>execFileSync(git,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 command(dir,'init','--bare',remote);command(dir,'clone',remote,work);command(work,'checkout','-b','main');fs.writeFileSync(path.join(work,'data.js'),'original\n');command(work,'add','data.js');command(work,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','Initial fixture');command(work,'push','-u','origin','main');
 const {publish}=require('../publish.cjs');fs.writeFileSync(path.join(work,'data.js'),'verified update\n');const first=publish({cwd:work,git});assert(first.committed);assert.equal(command(dir,'--git-dir',remote,'show','main:data.js'),'verified update');assert.equal(publish({cwd:work,git}).committed,false);
 const second=path.join(dir,'second');command(dir,'clone','--branch','main',remote,second);fs.writeFileSync(path.join(second,'data.js'),'manual correction\n');command(second,'add','data.js');command(second,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','Manual fixture edit');command(second,'push','origin','main');fs.writeFileSync(path.join(work,'data.js'),'stale auto update\n');assert.throws(()=>publish({cwd:work,git}),/Remote branch moved/);assert.equal(command(dir,'--git-dir',remote,'show','main:data.js'),'manual correction');
});
