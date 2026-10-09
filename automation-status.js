window.AutomationStatus = (() => {
  function render(data){
    const box=document.getElementById('automation-status');if(!box)return;box.replaceChildren();
    const title=document.createElement('h3');title.textContent='Verified results';box.append(title);
    const meta=data.automation||{},list=document.createElement('dl');
    const parsed=Date.parse(meta.lastVerifiedUpdate||'');
    const when=Number.isFinite(parsed)?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(parsed))+' UK':'No automated data update yet';
    const latest=Math.max(0,...data.events.map(e=>e.ep));
    const tables=data.events.filter(e=>e.type==='roundtable');
    const voting=tables.length?(tables.every(e=>e.votingComplete===true)?'Complete':'Partial'):'Pending';
    for(const [label,value] of [['Last verified update',when],['Latest episode with confirmed results',latest?'Episode '+latest:'None yet'],['Voting data',voting]]){
      const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);list.append(row);
    }box.append(list);
    const note=document.createElement('p');note.className='hint';note.textContent=meta.scheduleDescription||'Scheduled checks run on GitHub after setup. Check the workflow for its next configured window and run history.';box.append(note);
    if(voting!=='Complete'){const pending=document.createElement('p');pending.className='hint';pending.textContent='Voting bonuses may still be pending. This is not continuous broadcast tracking.';box.append(pending);}
    const a=document.createElement('a');a.href='https://github.com/yosayssmoe/-F-F-Celeb-Traitors/actions/workflows/update-episodes.yml';a.textContent='Check runs and reports';a.target='_blank';a.rel='noopener noreferrer';box.append(a);
  }return {render};
})();
