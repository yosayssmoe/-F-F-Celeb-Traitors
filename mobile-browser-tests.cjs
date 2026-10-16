// Optional standalone rendering checks; no production or Actions dependencies.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const {load,T,E,stable}=require('./automation/shared.cjs');
const root=__dirname,out=path.join(root,'test-results/mobile-fit-table');
async function inspect(page){
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 return page.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const canvas=document.querySelector('.table-canvas'),c=rect(canvas),w=document.querySelector('#table-window')||document.querySelector('#stage');
  return {viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,canvas:c,image:rect(document.querySelector('.stage-img')),window:rect(w),expanded:document.querySelector('#expand-table')?.getAttribute('aria-expanded')==='true',
   cards:[...document.querySelectorAll('.seat')].map(e=>({name:e.querySelector('.name').textContent.trim(),owner:e.querySelector('.who').textContent,rect:rect(e),text:rect(e.querySelector('.txt')),
    cx:(rect(e).x+rect(e).width/2-c.x)/c.width,cy:(rect(e).y+rect(e).height/2-c.y)/c.height,
    expectedX:parseFloat(e.style.left)/100,expectedY:parseFloat(e.style.top)/100,
    lines:[...e.querySelectorAll('.fit')].map(n=>{const s=getComputedStyle(n);return {text:n.textContent,width:n.clientWidth,scroll:n.scrollWidth,size:parseFloat(s.fontSize),visible:s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)>0&&rect(n).height>0};})}))};
 });
}
function validate(r,data,mode){
 assert.equal(r.cards.length,21);assert(r.documentWidth<=r.viewport.width,'Page must not scroll horizontally');
 for(const [i,c] of r.cards.entries()){
  assert.equal(c.name,data.celebs[i].name);assert.equal(c.owner,data.celebs[i].participant||'Unassigned');
  assert(Math.abs(c.cx-c.expectedX)<.001&&Math.abs(c.cy-c.expectedY)<.001,`${c.name}: seat position changed`);
  assert(c.text.y>=c.rect.y-1&&c.text.bottom<=c.rect.bottom+1,`${c.name}: vertical text clipping`);
  for(const l of c.lines){assert(l.text.trim()&&l.visible&&l.size>0,`${c.name}: blank label`);assert(l.scroll<=l.width+1,`${c.name}: text clipped`);if(mode==='expanded')assert(l.size>=12);}
  if(mode==='fit')assert(c.rect.x>=r.window.x-1&&c.rect.right<=r.window.right+1&&c.rect.y>=r.window.y-1&&c.rect.bottom<=r.window.bottom+1,`${c.name}: outside fitted table`);
 }
 for(const k of ['x','y','width','height'])assert(Math.abs(r.canvas[k]-r.image[k])<1,'Artwork and seats must share the same scale');
 if(mode==='fit'){
  assert.equal(r.expanded,false);assert(Math.abs(r.canvas.width-r.window.width)<1,'Entire table must fit available width');
  assert(r.image.x>=0&&r.image.right<=r.viewport.width&&r.image.y>=0&&r.image.bottom<=r.viewport.height,'Entire artwork must be visible in the initial viewport');
  assert(Math.abs(r.image.width/r.image.height-1312/1199)<.002,'Artwork aspect ratio changed');
 }
 if(mode==='expanded'){assert(r.expanded);assert.equal(r.canvas.width,1440);assert(r.canvas.width>r.window.width);}
}
async function tapDetails(page,index,data,scores){
 const c=data.celebs[index],s=scores[c.name];
 await page.locator('.seat').nth(index).tap();await page.locator('#hist').waitFor({state:'visible'});
 assert.equal(await page.locator('#hist-name').textContent(),c.name);
 const sub=await page.locator('#hist-sub').textContent();assert(sub.includes(c.participant||'Unassigned'));
 assert(sub.includes(({active:'Active',murdered:'Murdered',banished:'Banished',left:'Left',winner:'Winner'})[s.status]));
 assert.equal(Number(await page.locator('#hist-body .hs.total strong').textContent()),s.celebScore);
 assert(await page.locator('#hist').evaluate(e=>e.getBoundingClientRect().width<=innerWidth));
 await page.locator('#hist button[aria-label="Close"]').tap();
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const data=load(),scores=T.compute(data).contestants,report={checkedAt:new Date().toISOString(),base:null,engines:[],limitation:'WebKit with iPhone profile and Chromium with Android profile; no physical devices available.'};
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/family\//,'');const file=path.resolve(root,name||'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{res.setHeader('Content-Type',({'js':'application/javascript','css':'text/css','html':'text/html','webp':'image/webp'})[path.extname(file).slice(1)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.TEST_BASE_URL||`http://127.0.0.1:${server.address().port}/family/`;report.base=base;
 try{for(const engine of ['chromium','webkit']){
  const browser=await pw[engine].launch(engine==='chromium'&&process.env.CHROME_PATH?{headless:true,executablePath:process.env.CHROME_PATH}:{headless:true});
  try{
   const context=await browser.newContext({...pw.devices[engine==='webkit'?'iPhone 13':'Pixel 7'],viewport:{width:390,height:844},deviceScaleFactor:1});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const cases=[];
   // Direct entry must show the full ring before any pan, zoom or interaction.
   for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:width===375?667:844});
    await page.goto(base+'?view=table');await page.waitForFunction(()=>!!window.SweepstakeApp);
    const fitted=await inspect(page);assert.equal(fitted.viewport.width,width);validate(fitted,data,'fit');
    assert(!/pinch/i.test(await page.locator('#table-help').textContent()));
    await page.screenshot({path:path.join(out,`${engine}-${width}-fit.png`)});
    // Every card must really accept a touch at 375/390, including small labels.
    if(width===375||width===390)for(let i=0;i<21;i++)await tapDetails(page,i,data,scores);
    validate(await inspect(page),data,'fit');
    cases.push({width,all21Visible:true,wholeArtworkInInitialViewport:true,tapDetailsPassed:width===375||width===390?true:'not-run'});
    console.log(`PASS ${engine} ${width}px: entire table fitted, 21 labels and correct positions`);
   }
   await page.setViewportSize({width:390,height:844});await page.goto(base+'?view=table');await page.waitForFunction(()=>!!window.SweepstakeApp);
   await page.locator('#expand-table').tap();validate(await inspect(page),data,'expanded');
   const miranda=data.celebs.findIndex(c=>c.name==='Miranda Hart');await tapDetails(page,miranda,data,scores);
   await page.locator('#table-window').evaluate(e=>{e.scrollLeft=0;e.scrollTop=250;});
   assert(await page.locator('#table-window').evaluate(e=>e.scrollTop>0));
   await page.screenshot({path:path.join(out,`${engine}-390-expanded.png`)});
   await page.locator('#expand-table').tap();validate(await inspect(page),data,'fit');
   assert.equal(await page.locator('#table-window').evaluate(e=>e.scrollLeft),0);
   // The compact dialog is readable; screenshot captures a real card tap.
   await page.locator('.seat').nth(miranda).tap();await page.screenshot({path:path.join(out,`${engine}-390-details.png`)});
   await page.locator('#hist button[aria-label="Close"]').tap();
   await page.locator('[data-view="board"]').click();await page.locator('[data-view="table"]').click();validate(await inspect(page),data,'fit');
   const actual=await page.evaluate(()=>SweepstakeApp.getState());assert.equal(stable(actual.events),stable(data.events));assert.equal(stable(E.totals(actual)),stable(E.totals(data)));
   // Desktop remains the same composition, with mobile controls absent.
   await page.setViewportSize({width:1440,height:1000});await page.goto(base+'?view=table');await page.waitForFunction(()=>!!window.SweepstakeApp);
   const desktop=await inspect(page);validate(desktop,data,'desktop');assert.equal(await page.locator('#expand-table').isVisible(),false);
   const geometry=r=>({width:r.canvas.width,height:r.canvas.height,cards:r.cards.map(c=>({cx:c.cx,cy:c.cy,width:c.rect.width,height:c.rect.height}))});
   if(process.env.DESKTOP_BASELINE_URL){
    const ref=await context.newPage();await ref.setViewportSize({width:1440,height:1000});await ref.goto(process.env.DESKTOP_BASELINE_URL+'?view=table');await ref.waitForFunction(()=>!!window.SweepstakeApp);
    const old=geometry(await inspect(ref)),fresh=geometry(desktop);assert.equal(stable(fresh),stable(old),'Desktop card geometry changed');await ref.close();
   }
   await page.screenshot({path:path.join(out,`${engine}-desktop.png`)});
   assert.equal(errors.length,0,errors.join('\n'));report.engines.push({engine,cases,expandedAndCollapsePassed:true,desktopPassed:true,unchangedScores:true,errors});
  }finally{await browser.close();}
 }}finally{await new Promise(r=>server.close(r));}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
