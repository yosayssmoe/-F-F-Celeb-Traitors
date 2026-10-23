// Optional visual checks: uses externally installed Playwright, no site dependencies.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=__dirname,out=path.join(root,'test-results/compact-dashboard');
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
   const original=await page.evaluate(()=>SweepstakeApp.getState());
   const model=await page.evaluate(()=>ScoreboardModel.build(SweepstakeApp.getState(),TraitorsScoring));
   const group=name=>page.locator('.participant-group').filter({has:page.locator('.participant-name',{hasText:new RegExp('^'+name+'$')})});
   async function expand(name){const g=group(name),button=g.locator('.expand-celebrities');if(await button.getAttribute('aria-expanded')==='false')await button.click();return g;}
   assert.equal(await page.locator('.leader-card').count(),0);assert.equal(await page.locator('.standing-row').count(),7);assert.equal(await page.locator('.celebrity-link').count(),20);assert.equal(await page.locator('.celebrity-row:visible').count(),0);
   assert.equal(await page.locator('#countdown').count(),0);assert.equal(await page.locator('#episode-update-btn').isVisible(),false);assert.equal(await page.locator('#automation-status').isVisible(),false);
   assert(!(await page.locator('#board').textContent()).includes('Previous episode'));assert((await page.locator('#score-episode').textContent()).includes('Scores through Episode '+model.episode));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No page horizontal overflow');
   if(width===1440)assert(await page.locator('#board').evaluate(e=>e.getBoundingClientRect().top<=document.querySelector('.layout').getBoundingClientRect().top+30),'Desktop standings stay near the top');
   await page.screenshot({path:path.join(out,`${engine}-${width}-board.png`),fullPage:true});
   await page.screenshot({path:path.join(out,`${engine}-${width}-viewport.png`)});
   for(const p of model.participants){const g=await expand(p.name);assert.equal(Number(await g.locator('.total').textContent()),p.total);assert.equal(await g.locator('.standing-rank').textContent(),(p.tied?'=':'')+p.rank);
    for(const s of p.celebs){const row=g.locator('.celebrity-row').filter({has:page.locator('.lb-name',{hasText:s.name})});assert.equal(Number(await row.locator('.raw-score strong').textContent()),s.celebScore);assert.equal(Number(await row.locator('.episode-gain').textContent()),s.latestGain);
     assert((await row.locator('.status-badge').textContent()).startsWith(({active:'Active',murdered:'Murdered',banished:'Banished',left:'Left',winner:'Winner'})[s.status]));
     if(s.multiplier!==1)assert.equal(await row.locator('.multiplied-contribution').textContent(),`×${s.multiplier} = ${s.contributed} contribution`);else assert.equal(await row.locator('.multiplied-contribution').count(),0);
     assert(await row.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Celebrity row fits');
    }await g.locator('.expand-celebrities').click();assert.equal(await g.locator('.celebrity-list').isVisible(),false);
   }
   await expand(model.participants[0].name);await page.screenshot({path:path.join(out,`${engine}-${width}-expanded.png`)});await group(model.participants[0].name).locator('.expand-celebrities').click();
   await expand('Ava');await group('Ava').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${engine}-${width}-ava.png`)});
   await expand('Talia');await group('Talia').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${engine}-${width}-eliminated.png`)});
   const recruited=Object.values(model.contestants).find(c=>c.recruitedEp);
   for(const name of ['Miranda Hart',...(recruited?[recruited.name]:[])]){
    await expand(original.celebs.find(c=>c.name===name).participant);
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
   await page.locator('#bonus-btn').click();assert(await page.locator('#bonus-facts').isVisible());assert.equal(await page.locator('#bonus-rows tr').count(),21);
   const facts=await page.evaluate(()=>ScoreboardModel.facts(SweepstakeApp.getState(),TraitorsScoring));
   for(const [i,fact] of facts.rows.entries())assert.deepEqual(await page.locator('#bonus-rows tr').nth(i).locator('td').allTextContents(),[fact.receivedLabel,fact.traitorBallotsLabel,fact.shieldsLabel]);
   assert((await page.locator('#bonus-facts').textContent()).includes('including re-votes'));assert((await page.locator('#bonus-rows').textContent()).includes('Amol Rajan'));assert(await page.locator('#bonus-facts').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
   await page.screenshot({path:path.join(out,`${engine}-${width}-bonus-facts.png`)});await page.getByRole('button',{name:'Close bonus facts',exact:true}).click();assert(await page.locator('#bonus-btn').evaluate(e=>document.activeElement===e));
   await page.getByRole('tab',{name:'Sweepstake rules',exact:true}).click();assert(await page.locator('#sweepstake-rules').isVisible());assert.equal(await page.locator('#board').isVisible(),false);assert((await page.locator('#sweepstake-rules').textContent()).includes('Miranda Hart’s points ×2'));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,`${engine}-${width}-rules.png`)});
   await page.locator('#tab-rules').press('Home');assert.equal(await page.locator('#tab-table').getAttribute('aria-selected'),'true');await page.locator('#tab-table').press('ArrowRight');assert(await page.locator('#board').isVisible());
   await page.locator('#manage-btn').click();await page.locator('.admin-operations summary').click();assert(await page.locator('#automation-status').isVisible());
   await page.locator('#episode-update-btn').click();assert(await page.locator('#episode-dialog').isVisible());assert.equal(await page.locator('#admin').isVisible(),false);
   await page.locator('#episode-close').click();assert(await page.locator('#manage-btn').evaluate(e=>document.activeElement===e));assert.deepEqual(await page.evaluate(()=>SweepstakeApp.getState()),original);
   await page.evaluate(()=>{const next=SweepstakeApp.getState();next.automation={...next.automation,latestEpisodeChecked:99};SweepstakeApp.applyEpisode(next);});assert((await page.locator('#score-episode').textContent()).includes('Episode '+model.episode));
   await page.evaluate(n=>{const next=SweepstakeApp.getState();next.automation.partiallyScoredEpisodes=[n];SweepstakeApp.applyEpisode(next);},model.episode);assert(await page.locator('#partial-notice').isVisible());assert((await page.locator('#score-episode').textContent()).includes('partially scored'));
   await page.evaluate(d=>SweepstakeApp.applyEpisode(d),original);assert.equal(await page.locator('#partial-notice').isVisible(),model.partial);
   assert.equal(errors.length,0,errors.join('\n'));report.push({engine,width,totals:true,latestGains:true,collapsedAndExpanded:true,statuses:true,dialogs:true,bonusFacts:true,rules:true,adminAndAutoRefresh:true,focusRestored:true,noOverflow:true});console.log(`PASS ${engine} compact dashboard ${width}px`);await context.close();
  }}finally{await browser.close();}
 }}finally{await new Promise(r=>server.close(r));}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({base,cases:report,limitation:'Emulated iPhone WebKit and Android Chromium; physical devices unavailable.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
