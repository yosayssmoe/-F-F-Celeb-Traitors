/* Run separately with a disposable Chrome debugging session on port 9223. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
(async()=>{
 const targets=await(await fetch('http://localhost:9223/json')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(path.resolve('_site/index.html')).href});
  for(let i=0;i<50;i++){await new Promise(r=>setTimeout(r,100));if(await evaluate('!!window.SweepstakeApp'))break;}
  const data=require('../shared.cjs').load(path.resolve('_site/data.js'));
  const expected=Object.values(require('../shared.cjs').E.totals(data)).sort((a,b)=>b-a);
  assert.deepEqual(await evaluate('[...document.querySelectorAll("#lb-rows .total")].map(e=>+e.textContent)'),expected);
  const status=await evaluate('document.querySelector("#automation-status").textContent');
  assert(status.includes('Episode 3'));assert(status.includes('Complete'));assert(status.includes('9 Oct 2026'));assert(status.includes('Europe/London'));
  await evaluate('AutomationStatus.render({...SweepstakeApp.getState(),events:[{ep:4,type:"roundtable",votingComplete:false}]})');
  assert((await evaluate('document.querySelector("#automation-status").textContent')).includes('Partial'));
  await evaluate('AutomationStatus.render(SweepstakeApp.getState())');
  fs.writeFileSync('test-results/automation-dashboard.png',Buffer.from((await send('Page.captureScreenshot',{captureBeyondViewport:true})).data,'base64'));
  assert.equal(errors.length,0,JSON.stringify(errors));
  const report='PASS built Pages artifact opened offline with current dataset, matching totals, verified timestamp, episode, Complete and Partial voting states, checking windows, and no JavaScript exceptions.\n';
  fs.writeFileSync('test-results/automation-browser-report.txt',report);console.log(report);
 }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
