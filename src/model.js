import {mergeTimestamps} from './freshness.js';
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
 if(!existing)return {...next,id:next.id||asId(),createdAt:new Date().toISOString(),
  timestamps:mergeTimestamps(null,next.timestamps)};
 // Timestamps merge on their own rules: a real publication date is never
 // overwritten by a weaker one, and a reappearance after a verified delisting
 // is recorded as a repost rather than silently restored (src/freshness.js).
 const timestamps=mergeTimestamps(existing,next.timestamps);
 const reposted=timestamps.repostedAt&&!existing.timestamps?.repostedAt;
 const listing=reposted?{listingState:'live',closedAt:null,closedReason:null}:{};
 if(existing.origin==='page'&&next.origin==='discovery'){
  // PRD §8.5: the page record wins on populated fields; discovery only fills blanks.
  const patched={...existing};
  for(const [key,val] of Object.entries(next))if((patched[key]==null||patched[key]==='')&&val!=null)patched[key]=val;
  return {...patched,...listing,timestamps};
 }
 const result={...existing,...next,...listing,timestamps};
 result.id=existing.id;result.createdAt=existing.createdAt;return result;
}

// PRD §9.1 invariant (12), added 2026-11-03. Eligibility and sponsorship are
// hard gates, so every RANKED job carries both in full: 25 of the 100 points are
// a constant and the ranked range is 40–100. A job whose gate input is merely
// *unverified* is a third state — not refused, not passed — and ranking it on a
// 25-point deficit would sink an unverified job with a replied-to contact below
// a verified job with nobody at it, on the absence of a check rather than any
// property of the role. So it is HELD, and the count of held jobs is shown as a
// number (§10.3 rule 6) rather than as a silence.
export function gateState(job){
 const eligibility=job?.eligibility||'unverified';
 const authorization=job?.authorization||'unverified';
 if(eligibility==='ineligible'||authorization==='not-sponsored')return {state:'excluded',missing:[],
  why:eligibility==='ineligible'?'Not eligible for this role':'Employer does not sponsor'};
 const missing=[];
 if(eligibility!=='eligible')missing.push('graduation eligibility');
 if(authorization!=='confirmed')missing.push('sponsorship policy');
 if(missing.length)return {state:'held',missing,why:'Verify '+missing.join(' and ')+' before this job is ranked'};
 return {state:'ranked',missing:[],why:'Eligibility and sponsorship verified by you'};
}
export const isRankable=job=>gateState(job).state==='ranked';
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
// PRD §10.5 / invariant (9): `submission` is two arms discriminated on `source`,
// not one arm with optional fields. A `source:'user'` row carries NONE of
// roleFit, totalScore, weightsVersion or a tier — there was no Hoshi score to
// copy in, and scoring the job at entry time instead is honesty rule 8 in its
// original form. It adds recordedAt, because `at` is a date she asserts about
// the past rather than one written inside the flow.
export function mayMarkApplied(state,jobId,{confirm=false,source='hoshi',score=null,at=null,contactId=null}={}){
 if(!confirm)throw Error('User confirmation required; Hoshi never submits.');
 const job=state.jobs.find(j=>j.id===jobId);if(!job)throw Error('Job missing');
 if(state.events.some(e=>e.kind==='submission'&&e.jobId===jobId))return state;
 if(source==='user')return appendEvent(state,{kind:'submission',source:'user',jobId,
  at:at||new Date().toISOString(),recordedAt:new Date().toISOString(),
  personAttached:contactId?{contactId}:null});
 if(!score||score.total==null)throw Error('A Hoshi-scored submission needs the score as at submit');
 return appendEvent(state,{kind:'submission',source:'hoshi',jobId,
  roleFit:score.roleFit,totalScore:score.total,weightsVersion:'2026-09-29',
  personAttached:score.tier!=='C0'&&score.contact?{contactId:score.contact.id,tier:score.tier}:null});
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
