/* Only pushes the generated data file, with no force pushes or token logging. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
function publish({cwd=path.resolve(__dirname,'..'),branch='main',git=process.env.GIT_BINARY||'git'}={}){
 const run=(...args)=>execFileSync(git,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 if(!/^[A-Za-z0-9_./-]+$/.test(branch))throw Error('Invalid branch name.');
 const head=run('rev-parse','HEAD');run('fetch','origin',branch);
 if(run('rev-parse',`origin/${branch}`)!==head)throw Error('Remote branch moved during the check. No commit pushed; rerun from the latest main branch.');
 const changes=execFileSync(git,['status','--porcelain','--untracked-files=no'],{cwd,encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
 if(changes.some(line=>line.slice(3)!=='data.js'))throw Error('Unexpected tracked changes; refusing automatic commit.');
 if(!changes.length)return {committed:false,sha:head};
 run('add','--','data.js');
 run('-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit','-m','Update verified Celebrity Traitors episode results');
 run('push','origin',`HEAD:${branch}`);return {committed:true,sha:run('rev-parse','HEAD')};
}
if(require.main===module){
 const config=require('./config.json');
 try{const result=publish({branch:config.branch});if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`committed=${result.committed}\nsha=${result.sha}\n`);console.log(JSON.stringify(result));}
 catch(e){console.error('Automatic commit failed: '+e.message);process.exitCode=1;}
}
module.exports={publish};
