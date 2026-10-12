const fs=require('node:fs'),path=require('node:path');
const {root}=require('./shared.cjs');
async function deploymentNeeded({eventName,deployCurrent,committed,local,fetcher=fetch,url}){
 if(eventName==='push'||deployCurrent||committed)return {deploy:true,reason:'Committed site changes or explicit deployment requested.'};
 try{
  const response=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  const same=await response.text()===local;
  return {deploy:!same,reason:same?'Public dataset matches verified repository data.':'Public dataset differs; retry publication of verified data.'};
 }catch(error){return {deploy:true,reason:'Could not verify public dataset; retry publication: '+error.message};}
}
async function main(){
 const config=require('./config.json'),[owner,repo]=config.repository.split('/');
 const result=await deploymentNeeded({eventName:process.env.GITHUB_EVENT_NAME,deployCurrent:process.env.DEPLOY_CURRENT==='true',committed:process.env.COMMITTED==='true',local:fs.readFileSync(path.join(root,'data.js'),'utf8'),url:`https://${owner}.github.io/${repo}/data.js`});
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`deploy=${result.deploy}\n`);
 console.log(JSON.stringify(result));return result;
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={deploymentNeeded};
