const fs=require('node:fs'),path=require('node:path');
const file=path.resolve('automation-output/report.json');
const report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{checkedAt:new Date().toISOString(),accepted:[],deferred:[],queriedSources:[],dataUpdated:false};
report.gitCommit=process.env.COMMIT_OUTCOME||'skipped';report.pagesDeployment=process.env.DEPLOY_OUTCOME||'skipped';report.pageUrl=process.env.PAGE_URL||null;
report.publication=report.pagesDeployment==='success'?'Pages deployment succeeded':report.pagesDeployment==='failure'?'Pages deployment failed; previously deployed site remains available':report.gitCommit==='failure'?'Git push failed; public site unchanged':report.dataUpdated?'Deployment not completed; inspect job log':'No new verified data; no publication requested';
if(process.env.JOB_STATUS==='failure'&&report.pagesDeployment!=='success')report.publication='Workflow failed; no successful Pages deployment. Inspect the failed step; the previous deployment remains available.';
fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\n## Publication outcome\n'+report.publication+'\n'+(report.pageUrl||'')+'\n');
console.log(report.publication);
