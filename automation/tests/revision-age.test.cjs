const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {revisionAge}=require('../revision-age.cjs');
test('Actual failed run had valid UTC metadata but a revision only 85 seconds old',()=>{
 const r=revisionAge('2026-10-09T10:27:58Z',30,Date.parse('2026-10-09T10:29:23Z'));
 assert.equal(r.deferred,true);assert.equal(r.ageSeconds,85);assert.equal(r.retryAfter,'2026-10-09T10:57:58.000Z');
});
test('Age boundary stays 30 minutes; seconds, milliseconds and DST do not shift UTC',()=>{
 const now=Date.parse('2026-10-25T01:30:00Z');
 assert.equal(revisionAge('2026-10-25T01:00:00Z',30,now).deferred,false);
 assert.equal(revisionAge('2026-10-25T01:00:00.001Z',30,now).deferred,true);
 assert.equal(revisionAge('2026-10-25T00:59:59Z',30,now).deferred,false);
});
test('Missing, malformed, impossible dates, timezone-free and future timestamps still fail closed',()=>{
 const now=Date.parse('2026-10-09T11:00:00Z');
 for(const value of [undefined,null,123,'','yesterday','2026-02-30T10:00:00Z','2026-10-09T10:00:00','2026-10-09T11:00:01Z'])assert.throws(()=>revisionAge(value,30,now));
 assert.throws(()=>revisionAge('2026-10-09T10:00:00Z',0,now));
});
test('Updater defers without parsing/writing, then retries the source checks after ageing',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ff-revision-')),file=path.join(dir,'data.js'),snapshot=path.join(dir,'snapshot.json'),out=path.join(dir,'report');
 const {serialize}=require('../shared.cjs');const original=serialize(require('../fixtures/baseline-data.json'));fs.writeFileSync(file,original);
 fs.writeFileSync(snapshot,JSON.stringify({revision:123,timestamp:'2026-10-09T10:27:58Z',html:'Unsupported source must never bypass parser checks'}));
 const {main}=require('../update.cjs');const previousCode=process.exitCode,previousOutput=process.env.GITHUB_OUTPUT,previousSummary=process.env.GITHUB_STEP_SUMMARY;
 process.env.GITHUB_OUTPUT=path.join(dir,'outputs');delete process.env.GITHUB_STEP_SUMMARY;
 try{
  const r=await main(['--snapshot',snapshot,'--write'],{dataFile:file,outputDirectory:out,now:Date.parse('2026-10-09T10:29:23Z')});
  assert.equal(r.outcome,'deferred');assert.equal(process.exitCode,previousCode);assert.equal(fs.readFileSync(file,'utf8'),original);assert.equal(fs.existsSync(path.join(out,'candidate-data.js')),false);assert.match(fs.readFileSync(process.env.GITHUB_OUTPUT,'utf8'),/changed=false/);
  const retry=await main(['--snapshot',snapshot,'--write'],{dataFile:file,outputDirectory:out,now:Date.parse('2026-10-09T10:57:58Z')});
  assert.equal(retry.outcome,'failed');assert.match(retry.error,/table not recognised/);assert.equal(fs.readFileSync(file,'utf8'),original);
 }finally{process.exitCode=previousCode;if(previousOutput===undefined)delete process.env.GITHUB_OUTPUT;else process.env.GITHUB_OUTPUT=previousOutput;if(previousSummary===undefined)delete process.env.GITHUB_STEP_SUMMARY;else process.env.GITHUB_STEP_SUMMARY=previousSummary;}
});
