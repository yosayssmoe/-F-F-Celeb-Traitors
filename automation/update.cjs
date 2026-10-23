const fs=require('node:fs'),path=require('node:path');
const {root,load,serialize,hash}=require('./shared.cjs');
const {merge}=require('./merge.cjs'),{wikipedia,matureWikipedia,corroborate}=require('./retrieve.cjs');
const {selectRevision}=require('./select-revision.cjs');
function reportMarkdown(r){
 return ['# Episode automation report',`Checked: ${r.checkedAt}`,`Outcome: ${r.outcome}`,
  `Source revision: ${r.sourceRevision??'unavailable'}`,`Revision selection: ${JSON.stringify(r.revisionSelection||null)}`,
  `Data updated: ${r.dataUpdated}`,`Scores changed: ${r.scoresChanged}`,`Publication: ${r.publication}`,
  `Latest episode checked: ${r.latestEpisodeChecked??'unavailable'}`,`Latest episode fully scored: ${r.latestEpisodeFullyScored??'unavailable'}`,
  `Episodes partially scored: ${(r.partiallyScoredEpisodes||[]).join(', ')||'none'}`,`Points added by participant: ${JSON.stringify(r.pointsAdded||{})}`,
  ...(r.error?[`Error: ${r.error}`]:[]),'',
  ...['queriedSources','accepted','timelines','pendingEvents','missingIndividualVotes','sourceConflicts','deferred','unchanged'].flatMap(k=>['## '+k,...(r[k]||[]).map(x=>'- '+JSON.stringify(x))]),
  '','Totals: '+JSON.stringify(r.afterTotals||{})].join('\n')+'\n';
}
async function main(args=process.argv.slice(2),options={}){
 const config=JSON.parse(fs.readFileSync(path.join(__dirname,'config.json'),'utf8'));const out=options.outputDirectory||path.join(root,'automation-output');fs.mkdirSync(out,{recursive:true});
 const file=options.dataFile||path.join(root,'data.js'),original=fs.readFileSync(file,'utf8'),queriedSources=[];
 let report={checkedAt:new Date().toISOString(),outcome:'failed',queriedSources,accepted:[],deferred:[],unchanged:[],scoresChanged:false,dataUpdated:false,publication:'not attempted'};
 try{
  const data=load(file);const index=args.indexOf('--snapshot');
  const latest=index>=0?JSON.parse(fs.readFileSync(args[index+1],'utf8')):await wikipedia(config,queriedSources);
  const now=options.now??Date.now();
  report.sourceRevision=latest.revision;report.revisionTimestamp=latest.timestamp;
  const selected=await selectRevision(latest,data,config,{now,getMature:index>=0?undefined:()=>matureWikipedia(config,queriedSources,now)});
  const {snapshot,timing,parsed}=selected;
  report.revisionSelection=selected.selection;
  report.sourceRevision=snapshot.revision;
  report.revisionTimestamp=snapshot.timestamp;
  report.revisionAge=timing;
  if(timing.deferred){
   report.outcome='deferred';
   report.deferred.push({status:'source-too-recent',revision:snapshot.revision,...timing,reason:selected.selection.reason});
   report.publication='Deferred safely; existing data and deployed site unchanged. Next scheduled check will retry.';
   if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'changed=false\ndeferred=true\n');
   return report;
  }
  if(index<0)await corroborate(parsed,config,queriedSources);
  const result=merge(data,parsed,config);report={...result.report,queriedSources,outcome:result.changed?(result.report.accepted.length?'verified-changes':'pending-updated'):'no-change',sourceRevision:snapshot.revision,revisionAge:timing,revisionSelection:selected.selection};
  fs.writeFileSync(path.join(out,'candidate-data.js'),result.changed?serialize(result.data):original);
  if(result.changed&&args.includes('--write')){
   if(hash(fs.readFileSync(file,'utf8'))!==hash(original))throw Error('data.js changed during retrieval; refusing to overwrite.');
   const temporary=file+'.tmp';fs.writeFileSync(temporary,serialize(result.data));fs.renameSync(temporary,file);
   report.publication='data written locally; Git commit and Pages deployment pending';
  }else if(result.changed){report.outcome='dry-run-verified-changes';report.dataUpdated=false;report.publication='dry run; data.js untouched';}
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`changed=${result.changed&&args.includes('--write')}\n`);
 }catch(e){report.outcome='failed';report.error=e.message;report.dataUpdated=false;report.publication='not attempted; existing data preserved';process.exitCode=1;}
 finally{
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(out,'report.md'),reportMarkdown(report));
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,reportMarkdown(report));
  console.log(JSON.stringify({outcome:report.outcome,accepted:report.accepted.length,deferred:report.deferred.length,dataUpdated:report.dataUpdated,error:report.error}));
 }
 return report;
}
if(require.main===module)main();module.exports={main,reportMarkdown};
