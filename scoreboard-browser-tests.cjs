// Optional visual checks: uses externally installed Playwright, no site dependencies.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=__dirname,out=path.join(root,'test-results/scoreboard');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));try{if(file!==root&&!file.startsWith(root+path.sep))throw Error();const target=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;res.setHeader('Content-Type',({'js':'application/javascript','css':'text/css','html':'text/html','webp':'image/webp'})[path.extname(target).slice(1)]||'application/octet-stream');res.end(fs.readFileSync(target));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.TEST_BASE_URL||`http://127.0.0.1:${server.address().port}/`;
 const report=[];
 try{for(const engine of ['chromium','webkit']){
  const browser=await pw[engine].launch(engine==='chromium'?{executablePath:process.env.CHROME_PATH,headless:true}:{headless:true});
  try{for(const width of [320,375,390,430,1440]){
   const context=await browser.newContext({...pw.devices[engine==='webkit'?'iPhone 13':'Pixel 7'],viewport:{width,height:width===1440?1100:844},deviceScaleFactor:1});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base);await page.waitForFunction(()=>!!window.SweepstakeApp);
   const model=await page.evaluate(()=>ScoreboardModel.build(SweepstakeApp.getState(),TraitorsScoring));
   assert.equal(await page.locator('.leader-card').count(),7);assert.equal(await page.locator('.participant-group').count(),7);assert.equal(await page.locator('.celebrity-link').count(),20);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No page horizontal overflow');
   for(const p of model.participants)assert.equal(await page.locator('.participant-group').filter({has:page.locator('h3 span',{hasText:p.name})}).locator('.total').textContent(),p.total+' points');
   for(const p of model.participants)for(const s of p.celebs){const row=page.locator('.simple-scores tr').filter({has:page.locator('.lb-name',{hasText:s.name})});assert.equal(Number(await row.locator('.previous strong').textContent()),s.previous);assert.equal(Number(await row.locator('.current strong').textContent()),s.celebScore);assert.equal(Number(await row.locator('.contribution strong').textContent()),s.contributed);}
   await page.screenshot({path:path.join(out,`${engine}-${width}-board.png`),fullPage:true});
   await page.screenshot({path:path.join(out,`${engine}-${width}-viewport.png`)});
   const recruited=Object.values(model.contestants).find(c=>c.recruitedEp);
   for(const name of ['Miranda Hart',...(recruited?[recruited.name]:[])]){
    const button=page.locator('.celebrity-link').filter({has:page.locator('.lb-name',{hasText:name})});await button.scrollIntoViewIfNeeded();await button.focus();
    const scroll=await page.evaluate(()=>scrollY);await button.press('Enter');await page.locator('#hist').waitFor({state:'visible'});
    assert(await page.locator('.overall-panel').isVisible());assert.equal(await page.locator('.history-panel').isVisible(),false);
    assert.equal(Number(await page.locator('.hs.total strong').textContent()),model.contestants[name].celebScore);
    assert.equal(await page.locator('.category-breakdown dd').evaluateAll(es=>es.reduce((a,e)=>a+Number(e.textContent),0)),model.contestants[name].celebScore);
    assert.equal(await page.locator('#hist').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
    await page.screenshot({path:path.join(out,`${engine}-${width}-${name.replaceAll(' ','-')}-overall.png`)});
    await page.getByRole('button',{name:'Episode history',exact:true}).click();assert(await page.locator('.history-panel').isVisible());assert.equal(await page.locator('.overall-panel').isVisible(),false);
    assert.equal(await page.locator('.hist-ep').count(),model.episode);
    await page.screenshot({path:path.join(out,`${engine}-${width}-${name.replaceAll(' ','-')}-history.png`)});
    await page.getByRole('button',{name:'Overall breakdown',exact:true}).click();assert(await page.locator('.overall-panel').isVisible());
    await page.keyboard.press('Escape');assert.equal(await page.locator('#hist').isVisible(),false);assert(await button.evaluate(e=>document.activeElement===e));assert(Math.abs(await page.evaluate(()=>scrollY)-scroll)<2,'User place restored');
    await button.click();await page.locator('#hist button[aria-label="Close"]').click();assert.equal(await page.locator('#hist').isVisible(),false);
   }
   assert.equal(errors.length,0,errors.join('\n'));report.push({engine,width,totals:true,dialogs:true,focusRestored:true,noOverflow:true});console.log(`PASS ${engine} scoreboard ${width}px`);await context.close();
  }}finally{await browser.close();}
 }}finally{await new Promise(r=>server.close(r));}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({base,cases:report,limitation:'Emulated iPhone WebKit and Android Chromium; physical devices unavailable.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
