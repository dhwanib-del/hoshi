import {KEY,DEFAULTS,stateFrom,asId,addJob,appendEvent,mayMarkApplied,markOutcome,saveAnswer,safeProfile,usableAnswer} from './model.js';
import {listJobs,applyBoardResult} from './discovery.js';
import {captureCurrentPage} from './capture.js';
import {inspectFields,fillReviewed} from './autofill.js';
import {scoreJob,morningBrief} from './scoring.js';
let serial=Promise.resolve();
const load=async()=>stateFrom((await chrome.storage.local.get(KEY))[KEY]);
const save=async state=>{await chrome.storage.local.set({[KEY]:state});return state};
function mutator(fn){const task=serial.then(async()=>save(await fn(await load())));serial=task.catch(()=>{});return task;}
async function pollOne(id){
 const state=await load(),board=state.boards.find(b=>b.id===id);
 if(!board)throw Error('Unknown board');
 const result=await listJobs(board);
 return mutator(s=>applyBoardResult(s,id,result));
}
async function getCurrentTab(){
 const tabs=await chrome.tabs.query({active:true,currentWindow:true});
 if(!tabs[0]?.id)throw Error('Open a job posting tab first');
 return tabs[0];
}
async function handle(message){
 const data=message?.data||{};
 switch(message?.type){
  case 'GET': return load();
  case 'PROFILE':return mutator(s=>({...s,profile:{...s.profile,...safeProfile(data)}}));
  case 'ADD_PERSON':return mutator(s=>{
   if(!data.name?.trim())throw Error('Name required');
   const person={id:asId(),name:String(data.name).trim().slice(0,120),
     company:String(data.company||'').trim().slice(0,120),currentEmployer:String(data.currentEmployer||data.company||'').trim().slice(0,120),
     sharedContext:String(data.sharedContext||'').slice(0,400),
     linkedIn:String(data.linkedIn||'').slice(0,500),email:String(data.email||'').slice(0,180),
     employerCheck:data.employerCheck||'unverified',evidenceUrl:String(data.evidenceUrl||''),origin:'user entered · '+new Date().toISOString().slice(0,10),saved:true,createdAt:new Date().toISOString()};
   return {...s,people:[...s.people,person]};
  });
  case 'ADD_JOB':return mutator(s=>addJob(s,{...data,origin:data.origin||'manual'}));
  case 'VERIFY_JOB':return mutator(s=>{
   if(!['eligible','ineligible','unverified'].includes(data.eligibility)||!['confirmed','not-sponsored','unverified'].includes(data.authorization))throw Error('Unrecognized eligibility or sponsorship answer');
   const job=s.jobs.find(j=>j.id===data.jobId);if(!job)throw Error('Job not found');
   return {...s,jobs:s.jobs.map(j=>j.id!==job.id?j:{...j,eligibility:data.eligibility,authorization:data.authorization,eligibilityEvidence:String(data.evidence||'User verified from employer posting').slice(0,240),eligibilityReviewedAt:new Date().toISOString()})};
  });
  case 'ADD_BOARD':return mutator(s=>{
   if(!data.company||!data.handle||!['greenhouse','lever','ashby'].includes(data.provider))throw Error('Paste a supported board URL and company name');
   if(s.boards.some(b=>b.provider===data.provider&&b.handle===data.handle))return s;
   return {...s,boards:[...s.boards,{...data,id:asId(),createdAt:new Date().toISOString(),lastCompleteAt:null}]};
  });
  case 'POLL':return pollOne(data.id);
  case 'CAPTURE':{
   const tab=await getCurrentTab();
   const url=tab.url||'';
   if(!/^https:\/\/(job-boards\.greenhouse\.io|boards\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com|[^/]*myworkdayjobs\.com|[^/]*smartrecruiters\.com|[^/]*icims\.com|[^/]*workable\.com|[^/]*jobvite\.com)\//.test(url))
    throw Error('Only supported ATS job pages may be captured.');
   const rows=await chrome.scripting.executeScript({target:{tabId:tab.id},func:captureCurrentPage});
   const job=rows[0]?.result;
   if(!job||job.error)throw Error(job?.error||'Job page could not be read. Grant site access using the Hoshi toolbar icon.');
   if(!job.company) return {needsCompany:true,captured:job};
   return mutator(s=>addJob(s,job));
  }
  case 'MARK_SUBMITTED':return mutator(s=>{
   const job=s.jobs.find(x=>x.id===data.jobId);
   if(!job)throw Error('Job not found');
   return mayMarkApplied(s,data.jobId,{confirm:data.confirm===true,source:'hoshi',score:scoreJob(job,s.profile,s.people,s.events)});
  });
  case 'OUTCOME':return mutator(s=>markOutcome(s,data.jobId,data.stage));
  case 'SENT':return mutator(s=>{
   if(!s.people.some(p=>p.id===data.contactId))throw Error('Person not found');
   return appendEvent(s,{kind:'outreach',contactId:data.contactId,threadId:data.threadId||asId(),jobId:data.jobId||null,channel:data.channel||'other',step:data.step||'sent'});
  });
  case 'REPLY':return mutator(s=>{
   const message=[...s.events].reverse().find(e=>e.kind==='outreach'&&e.contactId===data.contactId);
   if(!message)throw Error('No outbound thread to attach this reply to');
   return appendEvent(s,{kind:'reply',contactId:data.contactId,threadId:message.threadId,source:'user',step:data.step||'replied',arrived:data.arrivedAt?{kind:'stated',at:data.arrivedAt}:{kind:'unknown'}});
  });
  case 'SAVE_ANSWER':return mutator(s=>saveAnswer(s,data));
  case 'IMPORT':return mutator(s=>{
   if(!['applications','contacts'].includes(data.kind)||!Array.isArray(data.rows))throw Error('Invalid import');
   if(data.rows.length>3000)throw Error('Import limited to 3,000 rows');
   let next=s;
   if(data.kind==='applications'){
    for(const a of data.rows){
     if(!a.company||!a.title)continue;
     const prev=next.jobs.find(j=>j.applyUrl&&a.applyUrl&&j.applyUrl===a.applyUrl);
     if(prev)continue;
     next=addJob(next,{...a,origin:'google-sheets-csv',listingState:'unknown'});
    }
   }else{
    const existing=new Set(next.people.map(p=>(p.email||p.linkedIn||p.name+'|'+p.company).toLowerCase()));
    for(const p of data.rows){
     if(!p.name)continue;
     const key=(p.email||p.linkedIn||p.name+'|'+p.company).toLowerCase();
     if(existing.has(key))continue;
     existing.add(key);
     next.people.push({id:asId(),...p,origin:'user-imported CareerLink CSV',saved:true});
    }
   }
   return next;
  });
  case 'PREVIEW_FILL':{
   const job=(await load()).jobs.find(j=>j.id===data.jobId);
   if(!job)throw Error('Save this job before reviewing form fields');
   const tab=await getCurrentTab();
   if(!job.applyUrl||new URL(job.applyUrl).origin!==new URL(tab.url).origin)throw Error('Open the saved job on the same employer site');
   const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:inspectFields});
   if(result?.result?.error)throw Error(result.result.error);
   const state=await load();
   const proposals=[];
   for(const field of result?.result?.fields||[]){
    const answer=[...state.answers].reverse().find(a=>a.question.toLowerCase()===field.label.toLowerCase());
    if(!answer)continue;
    const checked=usableAnswer(answer,{question:field.label,company:job.company,applicationCreatedAt:job.createdAt});
    proposals.push({selector:field.selector,label:field.label,answerId:answer.id,answer:answer.answer,fill:checked.fill,why:checked.why||'Exact saved answer',origin:'user-authored answer'});
   }
   return {jobId:job.id,proposals,skipped:(result?.result?.fields||[]).length-proposals.length};
  }
  case 'FILL_APPROVED':{
   const state=await load(),job=state.jobs.find(j=>j.id===data.jobId);
   if(!job)throw Error('Job missing');
   const tab=await getCurrentTab();
   if(!job.applyUrl||new URL(job.applyUrl).origin!==new URL(tab.url).origin)throw Error('Wrong employer page; no changes made');
   const pairs=[];
   for(const p of data.fields||[]){
    const answer=state.answers.find(a=>a.id===p.answerId&&a.question.toLowerCase()===String(p.label).toLowerCase());
    if(!answer)continue;
    const usable=usableAnswer(answer,{question:p.label,company:job.company,applicationCreatedAt:job.createdAt});
    if(usable.fill&&p.approved===true)pairs.push({selector:p.selector,label:p.label,answer:usable.value,approved:true});
   }
   if(!pairs.length)return {filled:0,errors:['No eligible fields approved']};
   const [filled]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:fillReviewed,args:[pairs]});
   return filled?.result||{filled:0,errors:['No result']};
  }
  case 'CLEAR_ALL':throw Error('Hoshi does not wipe your records from a single click');
  default:throw Error('Unknown Hoshi operation');
 }
}
chrome.runtime.onInstalled.addListener(async()=>{
 const raw=(await chrome.storage.local.get(KEY))[KEY];
 if(!raw)await chrome.storage.local.set({[KEY]:structuredClone(DEFAULTS)});
 await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});
 chrome.alarms.create('hoshi-daily',{periodInMinutes:1440});
});
chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
 handle(message).then(result=>reply({ok:true,result})).catch(e=>reply({ok:false,error:String(e.message||e)}));
 return true;
});
chrome.alarms.onAlarm.addListener(async alarm=>{
 if(!['hoshi-daily','hoshi-next-board'].includes(alarm.name))return;
 const s=await load();
 let boards=s.boards;
 if(alarm.name==='hoshi-daily'){
  await mutator(x=>({...x,settings:{...x.settings,pollCursor:0,lastPollCycle:new Date().toISOString()}}));
 }
 const cursor=(await load()).settings.pollCursor||0;
 if(cursor>=boards.length)return;
 const board=boards[cursor];
 try{await pollOne(board.id)}catch(e){console.warn('Hoshi: board poll failed',String(e))}
 await mutator(x=>({...x,settings:{...x.settings,pollCursor:cursor+1}}));
 if(cursor+1<boards.length)chrome.alarms.create('hoshi-next-board',{when:Date.now()+60_000});
});
