export const KEY='hoshi_v1';
export const DEFAULTS=Object.freeze({
 profile:{graduationYear:'2027',roleLanes:['product designer','ux designer','ux researcher','experience designer','interaction designer'],sponsorship:'requires-sponsorship',locations:['United States','London'],priorityThreshold:70},
 jobs:[],people:[],boards:[],answers:[],events:[],settings:{},lastBriefDate:null
});
export const PROTECTED=/\b(race|ethnicity|gender|sex|disability|veteran|birth.?date|date.?of.?birth|sexual.?orientation|religion)\b/i;
export const asId=()=>globalThis.crypto?.randomUUID?.() || String(Date.now())+'-'+Math.random().toString(36).slice(2);
export const cleanText=(value,max=500)=>String(value??'').trim().slice(0,max);
export function stateFrom(input){return Object.fromEntries(Object.entries(DEFAULTS).map(([k,v])=>[k,input?.[k]===undefined?structuredClone(v):input[k]]))}
export function safeProfile(updates){
 const result={};
 for(const k of ['graduationYear','roleLanes','sponsorship','locations','priorityThreshold'])if(Object.hasOwn(updates||{},k))result[k]=updates[k];
 for(const k of ['roleLanes','locations'])if(result[k])result[k]=Array.isArray(result[k])?result[k].map(v=>cleanText(v,70)).filter(Boolean).slice(0,20):[];
 if(result.priorityThreshold!==undefined)result.priorityThreshold=Math.max(0,Math.min(100,Number(result.priorityThreshold)||70));
 if(result.graduationYear!==undefined)result.graduationYear=cleanText(result.graduationYear,4);
 return result;
}
export function jobIdentity(job){
 const url=String(job.applyUrl||'').split(/[?#]/)[0].replace(/\/$/,'').toLowerCase();
 if(url)return 'url:'+url;
 if(job.provider&&job.providerJobId)return job.provider+':'+job.providerJobId;
 return 'name:'+String(job.company+'|'+job.title+'|'+job.location).toLowerCase().replace(/\s+/g,' ').trim();
}
export function mergeJob(existing,next){
 if(!existing)return {...next,id:next.id||asId(),createdAt:new Date().toISOString()};
 if(existing.origin==='page'&&next.origin==='discovery'){
  const patched={...existing};
  for(const [key,val] of Object.entries(next))if((patched[key]==null||patched[key]==='')&&val!=null)patched[key]=val;
  return patched;
 }
 const result={...existing,...next};result.id=existing.id;result.createdAt=existing.createdAt;return result;
}
export function addJob(state,job){
 if(!job.title||!job.company)throw Error('A job needs a real title and company.');
 const identity=jobIdentity(job);
 const at=state.jobs.findIndex(j=>j.identity===identity || (j.provider&&j.provider===job.provider&&j.providerJobId&&j.providerJobId===job.providerJobId));
 const record={...job,identity,listingState:job.listingState||'unknown'};
 if(at<0)return {...state,jobs:[mergeJob(null,record),...state.jobs]};
 const jobs=[...state.jobs];jobs[at]=mergeJob(jobs[at],record);return {...state,jobs};
}
export function appendEvent(state,event){
 if(!['submission','outcome','outreach','reply','brief'].includes(event.kind))throw Error('Unknown event kind');
 const e=Object.freeze({id:asId(),at:new Date().toISOString(),...event});
 return {...state,events:[...state.events,e]};
}
export function mayMarkApplied(state,jobId,{confirm=false,source='hoshi',score=null}={}){
 if(!confirm)throw Error('User confirmation required; Hoshi never submits.');
 const job=state.jobs.find(j=>j.id===jobId);if(!job)throw Error('Job missing');
 if(state.events.some(e=>e.kind==='submission'&&e.jobId===jobId))return state;
 return appendEvent(state,{kind:'submission',jobId,source,roleFit:source==='hoshi'?score?.roleFit??null:null,totalScore:source==='hoshi'?score?.total??null:null,weightsVersion:source==='hoshi'?'2026-09-29':null,personAttached:source==='hoshi'&&score?.tier!=='C0'&&score?.contact?{contactId:score.contact.id,tier:score.tier}:null});
}
export function markOutcome(state,jobId,stage){
 if(!['response','screen','interview','rejected'].includes(stage))throw Error('Invalid outcome');
 if(!state.jobs.some(j=>j.id===jobId))throw Error('Job missing');
 return appendEvent(state,{kind:'outcome',jobId,stage,source:'user'});
}
export function jobStage(events,jobId){
 const e=[...events].reverse().find(x=>x.jobId===jobId&&x.kind==='outcome');
 return e?.stage || (events.some(x=>x.kind==='submission'&&x.jobId===jobId)?'marked submitted':'saved');
}
export function saveAnswer(state,{question,answer,scope,company='',originalJobId=null}){
 if(PROTECTED.test(question))throw Error('Protected questions are never stored');
 if(!['employer-independent','employer-specific'].includes(scope))throw Error('Choose an answer scope');
 const q=cleanText(question,250),a=cleanText(answer,3500);if(!q||!a)throw Error('Question and answer are required');
 return {...state,answers:[...state.answers,{id:asId(),question:q,answer:a,scope,company:cleanText(company,120),originalJobId,editedAt:new Date().toISOString()}]};
}
export function usableAnswer(answer,{question,company,applicationCreatedAt}){
 if(PROTECTED.test(question)||question.trim().toLowerCase()!==answer.question.trim().toLowerCase())return {fill:false,why:'Question not matched exactly or protected'};
 if(answer.company&&company&&answer.company.toLowerCase()!==company.toLowerCase())return {fill:false,why:'Answer belongs to another employer'};
 if(answer.scope==='employer-independent')return {fill:true,value:answer.answer};
 if(!applicationCreatedAt||new Date(answer.editedAt)<=new Date(applicationCreatedAt))return {fill:false,why:'Employer-specific answer must be updated for this application'};
 return {fill:true,value:answer.answer};
}
export function stardust(events,date=new Date().toISOString().slice(0,10)){
 const today=events.filter(e=>String(e.at).slice(0,10)===date);
 let sends=0,submissions=0;return today.reduce((sum,e)=>{
  if(e.kind==='outreach'&&e.step==='sent')return sum+(sends++<5?40:0);
  if(e.kind==='submission')return sum+(submissions++<5?15:0);
  return sum;
 },0);
}
