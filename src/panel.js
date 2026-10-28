import {morningBrief,scoreJob,activity} from './scoring.js';
import {stardust,jobStage,cleanText} from './model.js';
import {parseBoardUrl,PROVIDERS} from './discovery.js';
let state=null,tab='orbit',search='',jobFilter='all',subview=null;
const view=document.querySelector('#view'),toast=document.querySelector('#toast');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=x=>x?new Date(x).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'Not recorded';
const badge=(label,variant='')=>'<span class="chip '+variant+'">'+esc(label)+'</span>';
const empty=(emoji,title,subtitle)=>'<div class="empty"><div class="emoji">'+emoji+'</div><h3>'+esc(title)+'</h3><p>'+esc(subtitle)+'</p></div>';
const button=(label,action,id='',variant='secondary')=>'<button class="btn '+variant+'" data-action="'+action+'" data-id="'+esc(id)+'">'+esc(label)+'</button>';
function notice(text){toast.textContent=text;toast.classList.add('visible');clearTimeout(notice.t);notice.t=setTimeout(()=>toast.classList.remove('visible'),3500)}
async function request(type,data={}){const result=await chrome.runtime.sendMessage({type,data});if(!result?.ok)throw Error(result?.error||'Hoshi could not complete that action');return result.result}
async function refresh(){state=await request('GET');render()}
const sec=(title,count)=>'<div class="section-heading"><h2>'+esc(title)+'</h2><small>'+esc(count)+'</small></div>';
const personCard=(p,why)=>'<article class="card contact-card"><div class="avatar">'+esc(p.name?.slice(0,1).toUpperCase()||'?')+'</div><div class="card-body"><p class="card-title">'+esc(p.name)+'</p><div class="micro muted">'+esc(p.currentEmployer||p.company||'Employer unconfirmed')+'</div>'+(p.sharedContext?'<p class="why">'+esc(p.sharedContext)+'</p>':'')+
 (why?badge(why,'good'):'')+'<div class="action-row">'+button('Coffee chat draft','draft',p.id)+button('Mark sent','sent',p.id,'ghost')+'</div></div></article>';
function jobCard(job,score){
 const stage=jobStage(state.events,job.id);
 const tag=job.listingState==='closed'?badge('Closed','bad'):job.listingState==='live'?badge('Live board','good'):badge('Listing unknown','warn');
 return '<article class="card"><div class="row"><div class="card-body"><p class="card-title">'+esc(job.title)+'</p><div class="micro muted">'+esc(job.company)+' · '+esc(job.location||'Location not verified')+'</div></div><div class="score">'+score.total+'<small>/ 100</small></div></div>'+
 '<div class="tags">'+tag+badge(stage,stage==='rejected'?'bad':stage==='interview'?'good':'')+badge(score.tier+' connection')+(job.authorization==='not-sponsored'?badge('No sponsorship','bad'):job.authorization!=='confirmed'?badge('Sponsorship unverified','warn'):'')+'</div>'+
 '<p class="why">'+esc(score.reason)+(score.contact?' · Person: '+esc(score.contact.name):'')+'</p>'+
 '<details class="disclosure"><summary>Why this score?</summary><ul class="line-list">'+score.lines.map(l=>'<li>'+esc(l)+'</li>').join('')+'</ul><small class="muted">Score is not a hiring probability. No eligibility inferred from silence.</small></details>'+
 '<div class="action-row">'+(job.applyUrl?button('View job ↗','open-job',job.id):'')+button('Mark I applied','submit',job.id)+button('Update outcome','outcome',job.id,'ghost')+'</div></article>';
function orbit(){
 const brief=morningBrief(state);const s=stardust(state.events);
 return '<div class="hero"><div class="eyebrow">Your daily orbit</div><h1>Good things start with a conversation.</h1><p>Find the person. Find the role. Make the introduction count.</p><span class="stardust">✦ '+s+' stardust today</span></div>'+
 '<div class="action-row">'+button('＋ Capture current job','capture','','')+button('Add a person','show-add-person','','ghost')+'</div>'+
 sec("Today's conversations",brief.conversations.length+' / 3')+
 (brief.conversations.length?'<div class="stack">'+brief.conversations.map(x=>personCard(x.contact,x.why)).join('')+'</div>':empty('💬','No conversations due yet',state.people.length===0?'0 people saved. Add a contact from CareerLink to begin.':'0 replies waiting or follow-ups due. Open People to start a conversation.'))+
 sec('Jobs worth your morning',brief.promoted.length+' / 5')+
 (brief.promoted.length?'<div class="stack">'+brief.promoted.map(x=>jobCard(x.job,x.score)).join('')+'</div>':empty('✦','No promoted jobs yet','0 jobs meet the role-fit floor and promotion gate. Add a role or watch a company board.'))+
 '<div class="card" style="margin-top:11px"><div class="card-title">'+brief.alsoOpen+' also open</div><p class="micro muted" style="margin:4px 0 0">Other saved jobs are available under Jobs; none is promoted without evidence.</p></div>';
}
function addJobForm(){return '<form class="form-card" id="job-form"><h3>Save a job manually</h3><p class="micro muted">No auto-applications. Paste details you can verify.</p><label for="job-title">Job title</label><input id="job-title" name="title" required maxlength="140"><label for="job-company">Company</label><input id="job-company" name="company" required maxlength="120"><label for="job-url">Application URL</label><input id="job-url" name="applyUrl" type="url"><label for="job-location">Location</label><input id="job-location" name="location"><div class="row"><div><label for="job-eligible">Eligibility</label><select name="eligibility" id="job-eligible"><option value="unverified">Unverified</option><option value="eligible">Verified eligible</option><option value="ineligible">Not eligible</option></select></div><div><label for="job-auth">Sponsorship</label><select name="authorization" id="job-auth"><option value="unverified">Unverified</option><option value="confirmed">Confirmed</option><option value="not-sponsored">Not sponsored</option></select></div></div><button class="btn full" type="submit">Save job</button></form>'}
function addBoardForm(){return '<form class="form-card" id="board-form"><h3>Watch a company board</h3><p class="micro muted">Paste an actual Greenhouse, Lever, or Ashby URL. Hoshi never guesses board handles.</p><label for="board-url">Board URL</label><input type="url" name="boardUrl" id="board-url" placeholder="https://jobs.lever.co/company" required><label for="board-company">Company name</label><input name="company" id="board-company" required placeholder="Company as you know it"><button class="btn full" type="submit">Ask permission & watch</button></form>'}
function jobs(){
 const all=state.jobs.map(job=>({job,score:scoreJob(job,state.profile,state.people,state.events)}));
 const shown=jobFilter==='promoted'?all.filter(x=>x.score.promoted):jobFilter==='open'?all.filter(x=>x.job.listingState!=='closed'):all;
 return '<div class="eyebrow">Your opportunity shelf</div><h1>Jobs, with reasons.</h1><p class="section-intro">A role has to fit before a connection can lift it. Your action stays yours.</p>'+
 '<div class="pill-tabs">'+['all','open','promoted'].map(x=>'<button class="'+(jobFilter===x?'active':'')+'" data-filter="'+x+'">'+x[0].toUpperCase()+x.slice(1)+'</button>').join('')+'</div>'+
 (shown.length?'<div class="stack">'+shown.map(x=>jobCard(x.job,x.score)).join('')+'</div>':empty('🔎','Nothing in this filter','Try a different filter or add a job you found.'))+
 '<div class="section-heading"><h2>Add to your shelf</h2></div>'+addJobForm()+addBoardForm()+
 (state.boards.length?sec('Watched boards',state.boards.length)+'<div class="stack">'+state.boards.map(b=>'<div class="card"><div class="card-title">'+esc(b.company)+'</div><div class="micro muted">'+esc(b.provider+' / '+b.handle)+'</div><div class="tags">'+badge(b.lastError?'Partial / error':b.lastCompleteAt?'Last complete '+date(b.lastCompleteAt):'Not checked',b.lastError?'warn':'good')+'</div>'+button('Refresh board','poll',b.id)+'</div>').join('')+'</div>':'');
}
function addPersonForm(){return '<form id="person-form" class="form-card"><h3>Add someone worth talking to</h3><p class="micro muted">People must come from you, a directory you import, or a real introduction. Hoshi does not scrape LinkedIn.</p><label for="person-name">Name</label><input name="name" id="person-name" required><label for="person-company">Current employer (or last known)</label><input name="company" id="person-company"><label for="person-context">How you know them / shared context</label><textarea name="sharedContext" id="person-context" placeholder="UMSI alum, designed accessibility features at…" required></textarea><label for="person-link">Profile link (optional)</label><input name="linkedIn" id="person-link" type="url"><label for="person-email">Email (optional)</label><input name="email" id="person-email" type="email"><button type="submit" class="btn full">Add person</button></form>'}
function people(){
 const ps=state.people.filter(p=>(p.name+' '+(p.currentEmployer||p.company)).toLowerCase().includes(search.toLowerCase()));
 return '<div class="eyebrow">Your unfair advantage</div><h1>People before postings.</h1><p class="section-intro">'+state.people.length+' saved contacts · Every connection comes from your own list, not a scraped directory.</p>'+
 '<input id="person-search" aria-label="Search people" placeholder="Search a name or company…" value="'+esc(search)+'">'+
 '<div class="section-heading"><h2>Your people</h2><small>'+ps.length+' shown</small></div>'+
 (ps.length?'<div class="stack">'+ps.slice(0,50).map(p=>personCard(p)).join('')+'</div>':empty('🤝','Nobody here yet','Import your CareerLink contacts or add one person to begin.'))+
 '<div class="section-heading"><h2>Grow your circle</h2></div>'+addPersonForm();
}
function activityView(){
 const a=activity(state);
 return '<div class="eyebrow">Momentum, not vanity</div><h1>What actually happened.</h1><p class="section-intro">These are the events you marked in Hoshi, not a claim about every application or conversation you have ever had.</p>'+
 '<div class="stats">'+[['Conversations started',a.counts.outreach],['Replies you recorded',a.counts.replies],['Marked submitted',a.counts.submissions],['Interviews recorded',a.counts.interviews]].map(([name,num])=>'<div class="stat"><strong>'+num+'</strong><small>'+name+'</small></div>').join('')+'</div>'+
 sec('Rates are estimates','95% Wilson interval')+
 a.rates.map(r=>'<div class="rate"><strong>'+esc(r.summary)+'</strong><small>'+esc(r.label)+'. Based only on events you recorded.</small></div>').join('')+
 '<div class="card" style="margin-top:10px"><strong>'+a.immature+' applications too recent</strong><p class="micro muted">Submissions younger than 21 days stay out of response-rate denominators. Missing replies and unconfirmed external submissions are not observed.</p></div>'+
 sec('Your record','Append-only history')+
 (state.events.length?'<div class="stack">'+state.events.slice(-20).reverse().map(e=>'<div class="card"><strong>'+esc(e.kind)+'</strong><div class="micro muted">'+date(e.at)+' · '+esc(e.stage||e.step||'Recorded by you')+'</div></div>').join('')+'</div>':empty('◉','No recorded events','Mark a message sent, or mark an application after you submit it yourself.'));
}
function settings(){
 return '<div class="eyebrow">Your operating rules</div><h1>Make it yours.</h1>'+
 '<form id="settings-form" class="form-card"><label for="grad">Graduation year</label><input name="graduationYear" id="grad" value="'+esc(state.profile.graduationYear)+'"><label for="lanes">Role lanes (comma-separated)</label><textarea id="lanes" name="roleLanes">'+esc(state.profile.roleLanes.join(', '))+'</textarea><label for="places">Locations (comma-separated)</label><textarea id="places" name="locations">'+esc(state.profile.locations.join(', '))+'</textarea><label for="priority">Priority threshold (0–100; PRD B-15 still open)</label><input id="priority" name="priorityThreshold" type="number" min="0" max="100" value="'+esc(state.profile.priorityThreshold)+'"><button class="btn full" type="submit">Save preferences</button></form>'+
 '<div class="form-card"><h3>Bring in your Google Sheet</h3><p class="micro muted">Working option: in Google Sheets choose File → Download → CSV on the Applications or Contacts tab. Import the file here. Data remains in local Chrome storage. Automatic OAuth sync is still awaiting extension authorization configuration; it is not currently connected.</p><label for="import-kind">CSV source</label><select id="import-kind"><option value="contacts">My Contacts</option><option value="applications">Daily Applications</option></select><label for="import-file">CSV file</label><input id="import-file" type="file" accept=".csv,text/csv"><div class="action-row">'+button('Import CSV','import-csv')+'</div></div>'+
 '<div class="form-card"><h3>Your data stays yours</h3><p class="micro muted">No server. No automatic submissions. No LinkedIn scraping. Dates and sources remain visible. Export your local records whenever you like.</p>'+button('Export backup JSON','export')+'</div>'+
 '<div class="form-card"><h3>Saved answer bank</h3><p class="micro muted">Only answers you write are stored. Protected demographic questions are never saved.</p><form id="answer-form"><label>Exact question</label><input name="question" required><label>Your answer</label><textarea name="answer" required></textarea><label>Scope</label><select name="scope"><option value="employer-independent">Employer-independent</option><option value="employer-specific">Employer-specific</option></select><label>Company (if specific)</label><input name="company"><button class="btn full" type="submit">Save my answer</button></form><p class="micro muted">'+state.answers.length+' answers saved locally.</p></div>';
}
function render(){
 const active=subview||tab;
 view.innerHTML=active==='orbit'?orbit():active==='jobs'?jobs():active==='people'?people():active==='activity'?activityView():settings();
 document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
}
document.querySelector('.bottom-nav').addEventListener('click',e=>{const btn=e.target.closest('[data-tab]');if(!btn)return;tab=btn.dataset.tab;subview=null;render();scrollTo(0,0)});
document.querySelector('#settings-trigger').addEventListener('click',()=>{subview=subview==='settings'?null:'settings';render();scrollTo(0,0)});
view.addEventListener('input',e=>{if(e.target.id==='person-search'){search=e.target.value; /* re-render after debounce to preserve focus */clearTimeout(view.q);view.q=setTimeout(()=>{const cursor=document.activeElement?.selectionStart;render();const el=document.querySelector('#person-search');el?.focus();if(cursor!=null)el?.setSelectionRange(cursor,cursor)},130)}});
view.addEventListener('click',async e=>{
 const f=e.target.closest('[data-filter]');if(f){jobFilter=f.dataset.filter;render();return;}
 const b=e.target.closest('[data-action]');if(!b)return;
 const action=b.dataset.action,id=b.dataset.id;
 try{
 if(action==='show-add-person'){tab='people';subview=null;render();document.querySelector('#person-name')?.focus();return}
 if(action==='capture'){
  const result=await request('CAPTURE');
  if(result.needsCompany){const name=prompt('The page did not provide a verified company. Enter it yourself:');if(!name)return;await request('ADD_JOB',{...result.captured,company:name})}
  notice('Job saved to Hoshi');await refresh();return;
 }
 if(action==='open-job'){const job=state.jobs.find(x=>x.id===id);if(job?.applyUrl)chrome.tabs.create({url:job.applyUrl});return}
 if(action==='submit'){if(!confirm('Have you personally submitted this application on the employer site? Hoshi does not submit forms or verify they arrived.'))return;await request('MARK_SUBMITTED',{jobId:id,confirm:true});notice('Marked submitted — your assertion recorded');await refresh();return}
 if(action==='outcome'){const stage=prompt('Record your update (response, screen, interview, rejected):');if(!stage)return;await request('OUTCOME',{jobId:id,stage:stage.toLowerCase().trim()});notice('Outcome recorded');await refresh();return}
 if(action==='poll'){await request('POLL',{id});notice('Board checked; errors are visible on its card');await refresh();return}
 if(action==='draft'){const p=state.people.find(x=>x.id===id);if(!p)return;
  if(!p.sharedContext){notice('Add real shared context before drafting');return}
  const message='Hi '+p.name.split(' ')[0]+', I came across your work through '+p.sharedContext+'. I am exploring early-career UX and product design roles and would really value your perspective. Would you be open to a short 15-minute coffee chat? Here is my portfolio: https://dhwanibagrecha.com/';
  await navigator.clipboard.writeText(message);notice('Draft copied to clipboard — review before sending');return;
 }
 if(action==='sent'){if(!confirm('Did you personally send this message? Hoshi cannot verify LinkedIn or email sends.'))return;await request('SENT',{contactId:id,channel:'other'});notice('Send recorded');await refresh();return}
 if(action==='import-csv'){await importCsv();return}
 if(action==='export'){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='hoshi-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);return}
 }catch(err){notice(err.message||String(err))}
});
view.addEventListener('submit',async e=>{
 e.preventDefault();const form=e.target;const values=Object.fromEntries(new FormData(form).entries());
 try{
 if(form.id==='person-form'){await request('ADD_PERSON',values);notice('Person added');subview=null;tab='people';await refresh();}
 else if(form.id==='job-form'){await request('ADD_JOB',{...values,origin:'manual',listingState:'unknown'});notice('Job saved');await refresh();}
 else if(form.id==='board-form'){const source=parseBoardUrl(values.boardUrl);if(!source)throw Error('Paste a supported, hosted ATS board URL');
   const permission=await chrome.permissions.request({origins:[PROVIDERS[source.provider].host]});
   if(!permission)throw Error('Board permission not granted');
   await request('ADD_BOARD',{...source,company:values.company});notice('Board added');await refresh();}
 else if(form.id==='settings-form'){values.roleLanes=values.roleLanes.split(',');values.locations=values.locations.split(',');values.priorityThreshold=Number(values.priorityThreshold);await request('PROFILE',values);notice('Preferences saved');await refresh();}
 else if(form.id==='answer-form'){await request('SAVE_ANSWER',values);notice('Your answer saved locally');await refresh();}
 }catch(err){notice(err.message||String(err))}
});
function parseCSV(text){
 const rows=[];let row=[],value='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++}else quoted=!quoted}
  else if(c===','&&!quoted){row.push(value);value=''}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))rows.push(row);row=[];value=''}
  else value+=c;
 }
 row.push(value);if(row.some(x=>x.trim()))rows.push(row);
 const [keys=[],...data]=rows;return data.map(r=>Object.fromEntries(keys.map((key,i)=>[key.trim(),(r[i]||'').trim()])));
}
async function importCsv(){
 const file=document.querySelector('#import-file')?.files?.[0];if(!file)throw Error('Choose a CSV file first');
 if(file.size>2_500_000)throw Error('This CSV is too large; export one tab at a time');
 const kind=document.querySelector('#import-kind').value;
 const rows=parseCSV(await file.text());
 const cleaned=kind==='contacts'?rows.map(x=>({
  name:x.Name,company:x['Company in CareerLink'],currentEmployer:x['Current Employer']||'',email:x.Email,linkedIn:x['LinkedIn URL'],
  sharedContext:x['Personalization Notes'],employerCheck:x['Employer Check'],evidenceUrl:x['Verification Evidence URL']
 })):rows.map(x=>({title:x.Role,company:x.Company,applyUrl:x['Job Link'],location:x.Location,eligibility:'unverified',authorization:'unverified',firstEvidenceDate:x['Applied / Confirmed'],sheetStatus:x.Status}));
 await request('IMPORT',{kind,rows:cleaned});notice('Imported '+rows.length+' rows (duplicates skipped)');await refresh();
}
refresh().catch(err=>{view.textContent='Hoshi cannot load local storage: '+err.message});
