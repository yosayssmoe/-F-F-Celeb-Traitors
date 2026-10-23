// Optional visual checks: uses externally installed Playwright, no site dependencies.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=__dirname,out=path.join(root,'test-results/league-table');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));try{if(file!==root&&!file.startsWith(root+path.sep))throw Error();const target=file===path.join(root,'data.js')&&process.env.TEST_DATA_FILE?path.resolve(process.env.TEST_DATA_FILE):fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;res.setHeader('Content-Type',({'js':'application/javascript','css':'text/css','html':'text/html','webp':'image/webp'})[path.extname(target).slice(1)]||'application/octet-stream');res.end(fs.readFileSync(target));}catch{res.writeHead(404);res.end();}});
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
   const scroll=page.locator('#league-scroll');
   assert.equal(await page.locator('#league-table').count(),1);assert.equal(await page.locator('.leader-card').count(),0);assert.equal(await page.locator('.participant-group').count(),7);
   assert.equal(await page.locator('.celebrity-row:visible').count(),20);assert.equal(await page.locator('.expand-celebrities').count(),0);assert.equal(await page.locator('#bonus-facts,#bonus-btn').count(),0);
   assert.equal(await page.locator('#countdown').count(),0);assert.equal(await page.locator('#episode-update-btn').isVisible(),false);assert.equal(await page.locator('#automation-status').isVisible(),false);
   assert(!(await page.locator('#board').textContent()).includes('Previous episode'));assert((await page.locator('#score-episode').textContent()).includes('Scores through Episode '+model.episode));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page horizontal overflow');
   for(const p of model.participants){const g=group(p.name);assert.equal(Number(await g.locator('.total').textContent()),p.total);assert.equal(Number(await g.locator('.participant-gain').textContent()),p.latestGain);assert.equal(await g.locator('.standing-rank').textContent(),(p.tied?'=':'')+p.rank);
    let contributed=0;
    for(const c of p.celebs){const row=g.locator('.celebrity-row').filter({has:page.locator('.lb-name',{hasText:c.name})});
     assert.equal(Number(await row.locator('.raw-total strong').textContent()),c.celebScore);assert.equal(Number(await row.locator('.raw-gain').textContent()),c.latestGain);
     const contribution=Number(await row.locator('.contribution strong').textContent());assert.equal(contribution,c.contributed);contributed+=contribution;
     assert((await row.locator('.league-meta').textContent()).includes(({active:'Active',murdered:'Murdered',banished:'Banished',left:'Left',winner:'Winner'})[c.status]));
     assert.equal(await row.locator('.category-points').count(),9);let sum=0;
     for(const [key,cell] of Object.entries(c.categoryCells)){const td=row.locator('[data-category="'+key+'"]');assert.equal(await td.textContent(),cell.text);sum+=Number(await td.getAttribute('data-points'));}assert.equal(sum,c.celebScore);
     if(c.multiplier!==1){assert.equal(await row.locator('.multiplier-badge').textContent(),'×'+c.multiplier);assert.equal(await row.locator('.contribution small').textContent(),c.celebScore+' ×'+c.multiplier);}
    }assert.equal(contributed,p.total);
   }
   await page.screenshot({path:path.join(out,engine+'-'+width+'-board.png'),fullPage:true});await page.screenshot({path:path.join(out,engine+'-'+width+'-viewport.png')});
   const nameCell=page.locator('.celebrity-row .league-name').first(),before=await nameCell.boundingBox();
   await scroll.evaluate(e=>{e.scrollLeft=e.scrollWidth;});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const after=await nameCell.boundingBox();assert(Math.abs(before.x-after.x)<1,'Celebrity names stay sticky');
   assert(await nameCell.evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.left+15,r.top+r.height/2)?.closest('.league-name')===e;}),'Sticky names remain the top clickable layer');
   const strips=await page.locator('.participant-strip').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=document.querySelector('#league-scroll').getBoundingClientRect();return {left:r.left,right:r.right,scrollLeft:s.left,scrollRight:s.right};}));
   for(const r of strips)assert(r.left>=r.scrollLeft-1&&r.right<=r.scrollRight+1,'Participant name and total stay inside the viewport');
   assert.equal(await nameCell.evaluate(e=>getComputedStyle(e).position),'sticky');assert.equal(await nameCell.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(25, 20, 16)');
   const available=await scroll.evaluate(e=>e.scrollWidth>e.clientWidth);
   if(width<=430){assert(available);assert(await scroll.evaluate(e=>e.scrollLeft>0));assert(await page.locator('.league-swipe').isVisible());}
   await group('Ava').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,engine+'-'+width+'-ava-scrolled.png')});
   await scroll.evaluate(e=>{e.scrollLeft=0;});if(available){await scroll.focus();await scroll.press('ArrowRight');assert(await scroll.evaluate(e=>e.scrollLeft>0),'Keyboard can scroll scoring columns');await scroll.evaluate(e=>{e.scrollLeft=0;});}
   await group('Talia').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,engine+'-'+width+'-eliminated.png')});
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
   await page.locator('#votes-btn').click();
   for(const event of original.events.filter(e=>e.outcome?.status==='pending')){
    const section=page.locator('#hist-body section').filter({has:page.locator('h4',{hasText:'Episode '+event.ep+' ·'})});
    assert((await section.textContent()).includes('Outcome pending'));
    assert.equal(await section.locator('.vote-record').filter({hasText:'(extra ballot)'}).count(),event.extraBallots?.length||0);
    assert((await section.textContent()).includes('Sharon Rooney 4'),'Weighted first tally is displayed');
   }
   await page.keyboard.press('Escape');
   await page.getByRole('tab',{name:'Sweepstake rules',exact:true}).click();assert(await page.locator('#sweepstake-rules').isVisible());assert.equal(await page.locator('#board').isVisible(),false);assert((await page.locator('#sweepstake-rules').textContent()).includes('Miranda Hart’s points ×2'));assert((await page.locator('#sweepstake-rules').textContent()).includes('extra ballots and re-votes'));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,`${engine}-${width}-rules.png`)});
   await page.locator('#tab-rules').press('Home');assert.equal(await page.locator('#tab-table').getAttribute('aria-selected'),'true');await page.locator('#tab-table').press('ArrowRight');assert(await page.locator('#board').isVisible());
   await page.locator('#manage-btn').click();await page.locator('.admin-operations summary').click();assert(await page.locator('#automation-status').isVisible());
   await page.locator('#episode-update-btn').click();assert(await page.locator('#episode-dialog').isVisible());assert.equal(await page.locator('#admin').isVisible(),false);
   await page.locator('#episode-close').click();assert(await page.locator('#manage-btn').evaluate(e=>document.activeElement===e));assert.deepEqual(await page.evaluate(()=>SweepstakeApp.getState()),original);
   await page.evaluate(()=>{const next=SweepstakeApp.getState();next.automation={...next.automation,latestEpisodeChecked:99};SweepstakeApp.applyEpisode(next);});assert((await page.locator('#score-episode').textContent()).includes('Episode '+model.episode));
   await page.evaluate(n=>{const next=SweepstakeApp.getState();next.automation.partiallyScoredEpisodes=[n];SweepstakeApp.applyEpisode(next);},model.episode);assert(await page.locator('#partial-notice').isVisible());assert((await page.locator('#score-episode').textContent()).includes('partially scored'));
   await page.evaluate(d=>SweepstakeApp.applyEpisode(d),original);assert.equal(await page.locator('#partial-notice').isVisible(),model.partial);
   assert.equal(errors.length,0,errors.join('\n'));report.push({engine,width,totals:true,latestGains:true,allRowsVisible:true,stickyNamesAndParticipantHeaders:true,scrolling:true,statuses:true,dialogs:true,bonusFactsRemoved:true,rules:true,adminAndAutoRefresh:true,focusRestored:true,noOverflow:true});console.log(`PASS ${engine} league table ${width}px`);await context.close();
  }}finally{await browser.close();}
 }}finally{await new Promise(r=>server.close(r));}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({base,cases:report,limitation:'Emulated iPhone WebKit and Android Chromium; physical devices unavailable.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
