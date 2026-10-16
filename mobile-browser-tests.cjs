// Standalone visual checks. Use Playwright Core with installed Chromium/WebKit;
// no runtime dependency or GitHub Actions configuration changes are required.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=__dirname,out=path.join(root,'test-results/mobile-round-table');
const {load,E,stable}=require('./automation/shared.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const widths=[320,375,390,430];
async function inspect(page){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 return page.evaluate(()=>{
 const canvas=document.querySelector('.table-canvas').getBoundingClientRect();
 const stage=document.querySelector('#stage');
 return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,stageWidth:stage.clientWidth,scrollWidth:stage.scrollWidth,canvasWidth:canvas.width,
  cards:[...document.querySelectorAll('.seat')].map(e=>{
   const r=e.getBoundingClientRect(),t=e.querySelector('.txt').getBoundingClientRect();
   return {name:e.querySelector('.name').textContent.trim(),owner:e.querySelector('.who')?.textContent,status:e.querySelector('.fate')?.textContent||'Active',
    rect:{x:r.x-canvas.x,y:r.y-canvas.y,width:r.width,height:r.height},
    textWithinCard:t.top>=r.top-1&&t.bottom<=r.bottom+1,
    lines:[...e.querySelectorAll('.fit')].map(n=>({text:n.textContent,size:parseFloat(getComputedStyle(n).fontSize),width:n.clientWidth,scrollWidth:n.scrollWidth,visible:getComputedStyle(n).visibility==='visible'&&getComputedStyle(n).display!=='none'&&n.getBoundingClientRect().height>0}))};
  })};
 });}
function validate(result,data,mobile){
 assert.equal(result.cards.length,21);assert(result.documentWidth<=result.viewport,'Only the table region may scroll horizontally');
 if(mobile){assert.equal(result.canvasWidth,1440);assert(result.scrollWidth>result.stageWidth);}
 for(const [i,c] of result.cards.entries()){
  assert.equal(c.name,data.celebs[i].name);assert.equal(c.owner,data.celebs[i].participant||'Unassigned');
  assert(c.textWithinCard,`${c.name}: vertical text overflow`);
 for(const line of c.lines){assert(line.visible,`${c.name}: hidden ${line.text}`);assert(line.scrollWidth<=line.width+1,`${c.name}: clipped ${line.text} (${line.scrollWidth}/${line.width}px at ${line.size}px)`);if(mobile)assert(line.size>=12,`${c.name}: unreadable ${line.text} at ${line.size}px`);}
  if(mobile)for(const other of result.cards.slice(i+1)){
   const a=c.rect,b=other.rect;
   const overlaps=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1;
   assert(!overlaps,`${c.name} overlaps ${other.name}`);
  }
 }
 assert(result.cards.some(c=>c.status==='Murdered'));assert(result.cards.some(c=>c.status.startsWith('Banished')));assert(result.cards.some(c=>c.status==='Active'));
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const data=load(),report={testedAt:new Date().toISOString(),engines:[],limitations:'Playwright WebKit and Chromium mobile emulation; physical iPhone and Android devices were not available.'};
 const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/family\//,'');
  const file=path.resolve(root,relative||'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{res.setHeader('Content-Type',({'js':'application/javascript','css':'text/css','html':'text/html','webp':'image/webp'})[path.extname(file).slice(1)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=process.env.TEST_BASE_URL||`http://127.0.0.1:${server.address().port}/family/`;
 try{for(const engine of ['chromium','webkit']){
  const browser=await pw[engine].launch(engine==='chromium'&&process.env.CHROME_PATH?{headless:true,executablePath:process.env.CHROME_PATH}:{headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,userAgent:pw.devices[engine==='webkit'?'iPhone 13':'Pixel 7'].userAgent});
  const errors=[],page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  try{
   // Exercise default-hidden table, direct table entry, repeated view switching,
   // all supported viewport widths, and horizontal access to every nameplate.
   await page.goto(base);await page.waitForFunction(()=>!!window.SweepstakeApp);
   await page.locator('[data-view="table"]').click();
   const cases=[];
   for(const width of widths){
    await page.setViewportSize({width,height:844});
    await page.evaluate(()=>{window.scrollTo(0,0);const s=document.querySelector('#stage');s.scrollLeft=(s.scrollWidth-s.clientWidth)/2;});await sleep(100);
    const result=await inspect(page);validate(result,data,true);cases.push({width,minFont:Math.min(...result.cards.flatMap(c=>c.lines.map(l=>l.size))),all21NamesAndOwners:true,noOverlapOrClipping:true});
    console.log(`PASS ${engine} ${width}px: all 21 names, owners and statuses; no overlap or clipping`);
    await page.screenshot({path:path.join(out,`${engine}-${width}.png`),fullPage:true});
    // Focusing each card must bring it into the scroll viewport; none are lost.
    for(let i=0;i<21;i++){
     await page.locator('.seat').nth(i).focus();
     assert(await page.locator('.seat').nth(i).evaluate(e=>{const a=e.getBoundingClientRect(),b=document.querySelector('#stage').getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;}),`Card ${i} cannot be reached by horizontal scrolling`);
    }
   }
   await page.setViewportSize({width:390,height:844});
   await page.goto(base+'?view=table');await page.waitForFunction(()=>document.querySelectorAll('.seat').length===21);await sleep(100);
   validate(await inspect(page),data,true);
   console.log(`PASS ${engine}: direct table entry; checking history interaction`);
   const miranda=page.locator('.seat').filter({has:page.locator('.name',{hasText:'Miranda Hart'})});
   await miranda.tap();await page.locator('#hist').waitFor({state:'visible'});
   assert((await page.locator('#hist-sub').textContent()).includes('Ava'));
   await page.evaluate(()=>document.querySelector('#hist').close());
   await miranda.press('Enter');await page.locator('#hist').waitFor({state:'visible'});
   assert((await page.locator('#hist-body').textContent()).includes('2'));await page.evaluate(()=>document.querySelector('#hist').close());
   const actual=await page.evaluate(()=>SweepstakeApp.getState());assert.equal(stable(actual.events),stable(data.events));assert.equal(stable(E.totals(actual)),stable(E.totals(data)));
   await page.locator('[data-view="board"]').click();await page.locator('[data-view="table"]').click();validate(await inspect(page),data,true);
   console.log(`PASS ${engine}: history and view switching; capturing full ring`);
   // A full canvas screenshot retains the exact mobile layout while exposing
   // the complete ring for visual review, without fitting names down to 3px.
   // Render a copy in a separate page so the running app's timers and DOM stay
   // intact. Its mobile styles and fitted text are preserved at full resolution.
   const markup=await page.evaluate(()=>document.querySelector('body > svg').outerHTML+document.querySelector('.table-canvas').outerHTML);
   const css=await page.locator('link[rel="stylesheet"]').evaluate(e=>fetch(e.href).then(r=>r.text()));
   const overview=await page.context().newPage();
   try{
    await overview.setViewportSize({width:390,height:844});
    await overview.setContent(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><base href="${base}"><style>${css}</style></head><body style="width:1440px;overflow:visible;margin:0">${markup}</body></html>`);
    await overview.screenshot({path:path.join(out,`${engine}-full-ring.png`),fullPage:true,clip:{x:0,y:0,width:1440,height:1440*1199/1312}});
   }finally{await overview.close();}
   await page.goto(base+'?view=table');await page.waitForFunction(()=>!!window.SweepstakeApp);
   await page.setViewportSize({width:1440,height:1000});await sleep(100);
   const desktop=await inspect(page);validate(desktop,data,false);
   await page.screenshot({path:path.join(out,`${engine}-desktop.png`),fullPage:true});
   assert.equal(errors.length,0,errors.join('\n'));report.engines.push({engine,cases,desktopPassed:true,historyAndScoringUnchanged:true,errors});
  }finally{await browser.close();}
 }}finally{await new Promise(r=>server.close(r));}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
