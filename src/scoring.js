// PRD section 9: scores prioritize conversations; never predict hiring odds.
import {jobStage,gateState} from './model.js';
import {freshnessScore,describeAge,recencyOf,isFresh} from './freshness.js';
export const WEIGHTS=Object.freeze({role:25,eligibility:20,connection:20,experience:10,company:5,narrative:5,location:5,authorization:5,freshness:5});
export const POINTS=Object.freeze({C3:20,C2:14,C1:8,C0:0});
const lower=s=>String(s||'').toLowerCase();
export function tierFor(company,people,events,now=new Date()){
 const matches=people.filter(p=>{
  if(!p.name||!p.origin)return false;
  if(p.origin==='user-imported CareerLink CSV'&&!['Verified current','Changed employer','Verified public profile'].includes(p.employerCheck))return false;
  return lower(p.currentEmployer||p.company)===lower(company);
 });
 let best={tier:'C0',contact:null,reason:'Nobody found at this company'};
 for(const p of matches){
  const replies=events.filter(e=>e.kind==='reply'&&e.contactId===p.id);
  const sends=events.filter(e=>e.kind==='outreach'&&e.contactId===p.id&&e.step==='sent');
  let tier='C2';
  if(replies.length)tier='C3';
  else if(sends.length&&((now-new Date(sends.at(-1).at))/86400000)>21)tier='C1';
  else if(p.rankSource==='alumni'&&!p.saved)tier='C1';
  if(tier==='C1'&&!p.origin)continue;
  if(POINTS[tier]>POINTS[best.tier])best={tier,contact:p,reason:p.name+' · '+(p.sharedContext||p.origin)+' · '+(tier==='C3'?'replied':tier==='C2'?'saved contact':'from your alumni list / cooled after 21 days')};
 }
 return best;
}
// Freshness lives in src/freshness.js so the four timestamp kinds, the recency
// bands and the pool bands have one home. WEIGHTS.freshness is the only knob.
export function freshness(job,now=new Date()){
 const f=freshnessScore(job,{max:WEIGHTS.freshness,now});
 return {points:f.points,line:describeAge(job,now)+(job.provider?' · '+job.provider:''),band:f.band,recency:f.recency,basis:f.basis,capped:f.capped};
}
export function scoreJob(job,profile,people=[],events=[],now=new Date()){
 const title=lower(job.title),lanes=profile.roleLanes||[];
 const direct=lanes.some(l=>l&&title.includes(lower(l)));
 const partial=!direct&&/product design|ux |user experience|experience design|researcher|interaction design/.test(title);
 const roleFit=direct?25:partial?16:0;
 const eligibility=job.eligibility==='eligible'?20:0;
 const authorization=job.authorization==='confirmed'?5:0;
 const tier=tierFor(job.company,people,events,now);
 const fresh=freshness(job,now);
 const experience=job.experienceMatch==='strong'?10:job.experienceMatch==='partial'?5:0;
 const company=job.savedCompany?5:0;
 const narrative=job.narrativeEvidence?5:0;
 const location=job.locationMatch===true?5:0;
 // Invariant (12), PRD §9.1: only a job whose gates are both VERIFIED is ranked,
 // so every ranked job scores eligibility 20 and authorization 5 and the ranked
 // range is 40–100. A held job carries no total at all — a 25-point deficit that
 // is the absence of a check must never compete with a real score.
 const gate=gateState(job);
 const closed=job.listingState==='closed';
 const rankable=gate.state==='ranked'&&!closed;
 const total=rankable?roleFit+eligibility+POINTS[tier.tier]+experience+company+narrative+location+authorization+fresh.points:null;
 const qualified=rankable&&roleFit>=15;
 const threshold=profile.priorityThreshold??70;
 const promoted=qualified&&(total>=threshold||tier.tier!=='C0');
 return {total,rankable,gate:gate.state,missingChecks:gate.missing,roleFit,tier:tier.tier,contact:tier.contact,promoted,qualified,
  // The ranked range is 40–100, not 0–100: state it so the number is readable.
  scale:rankable?{min:40,max:100}:null,
  reason:closed?'Listing closed — no longer accepting applications':gate.state==='excluded'?gate.why:gate.state==='held'?gate.why:roleFit<15?'Below 15/25 role-fit floor':!promoted?'Below priority threshold':'Qualified',
  lines:['+'+roleFit+' role · '+(direct?'matches your saved role lane':partial?'adjacent role':'not matched'),
    '+'+eligibility+' eligibility · '+(job.eligibility||'not verified'),
    '+'+POINTS[tier.tier]+' connection · '+tier.reason,
    '+'+experience+' experience · '+(job.experienceMatch||'not evidenced'),
    '+'+company+' company · '+(job.savedCompany?'watchlisted':'not watchlisted'),
    '+'+narrative+' narrative · '+(job.narrativeEvidence||'not supplied'),
    '+'+location+' location · '+(job.locationMatch===true?'preferred location':'not verified'),
    '+'+authorization+' authorization · '+(job.authorization||'not verified'),
    '+'+fresh.points+' freshness · '+fresh.line]};
}
export function conversationBrief(state,now=new Date()){
 const items=[];
 for(const p of state.people){
  const sends=state.events.filter(e=>e.kind==='outreach'&&e.contactId===p.id);
  const replies=state.events.filter(e=>e.kind==='reply'&&e.contactId===p.id);
  const lastSend=sends.at(-1),lastReply=replies.at(-1);
  let why=null,priority=9;
  if(lastReply&&(!lastSend||new Date(lastReply.at)>new Date(lastSend.at))){why='Reply waiting for your response';priority=0;}
  else if(lastSend&&!lastReply&&sends.length===1&&(now-new Date(lastSend.at))/86400000>=7){why='Follow-up due · 7+ days since your message';priority=1;}
  else if(lastSend&&!lastReply&&(now-new Date(lastSend.at))/86400000>=18&&(now-new Date(lastSend.at))/86400000<21){why='Connection cooling · nearly 21 days';priority=3;}
  else if(!lastSend&&state.jobs.some(j=>j.company===(p.currentEmployer||p.company)&&j.listingState!=='closed')){why='Role at their company';priority=2;}
  if(why&&p.name&&p.origin)items.push({contact:p,why,priority});
 }
 return items.sort((a,b)=>a.priority-b.priority).slice(0,3);
}
export function morningBrief(state,now=new Date()){
 const conversations=conversationBrief(state,now);
 const ranked=state.jobs.map(job=>({job,score:scoreJob(job,state.profile,state.people,state.events,now)})).filter(x=>x.job.listingState!=='closed');
 const promoted=ranked.filter(x=>x.score.promoted).sort((a,b)=>b.score.total-a.score.total||POINTS[b.score.tier]-POINTS[a.score.tier]||a.job.company.localeCompare(b.job.company)).slice(0,5);
 return {conversations,promoted,alsoOpen:ranked.filter(x=>!x.score.promoted).length};
}
/**
 * Fresh Jobs: every open job grouped by verified posting age, newest band first.
 * Older and unverified rows are kept in their own buckets and are never
 * presented as newly posted (2026-11-03 spec §3).
 */
export function freshJobs(state,now=new Date()){
 const rows=(state.jobs||[]).filter(j=>j.listingState!=='closed').map(job=>({
  job,
  score:scoreJob(job,state.profile,state.people,state.events,now),
  recency:recencyOf(job,now),
  age:describeAge(job,now),
  fresh:isFresh(job,now),
  contacts:(state.people||[]).filter(p=>lower(p.currentEmployer||p.company)===lower(job.company)).length,
  applied:(state.events||[]).some(e=>e.kind==='submission'&&e.jobId===job.id)
 }));
 const bands={hour:[],sixHours:[],day:[],older:[],unverified:[]};
 for(const r of rows)(bands[r.recency.band]||bands.unverified).push(r);
 for(const key of Object.keys(bands))bands[key].sort((a,b)=>(b.score.total??-1)-(a.score.total??-1));
 return {bands,rows,open:rows.length,
  held:rows.filter(r=>r.score.gate==='held').length,
  excluded:rows.filter(r=>r.score.gate==='excluded').length};
}

/**
 * What Hoshi actually checked, and when. Polling is polling: this never claims
 * real-time monitoring (2026-11-03 spec §10).
 */
export function coverage(state,now=new Date()){
 const boards=state.boards||[];
 const verified=boards.filter(b=>b.lastCompleteAt);
 const times=verified.map(b=>Date.parse(b.lastCompleteAt)).filter(Number.isFinite).sort((a,b)=>b-a);
 const stale=boards.filter(b=>!b.lastCompleteAt||(now.getTime()-Date.parse(b.lastCompleteAt))/3600000>48);
 return {
  mode:'Checked by polling once a day — not real-time monitoring',
  boards:boards.length,verified:verified.length,
  lastCompleteAt:times.length?new Date(times[0]).toISOString():null,
  staleBoards:stale.map(b=>b.company||b.handle),
  // Every source Hoshi can see. Aggregators and LinkedIn are not among them.
  sources:['Greenhouse','Lever','Ashby'],
  notCovered:['Workday (undocumented endpoint)','job aggregators','LinkedIn']
 };
}

export function wilson(k,n){
 if(n<=0)return null;const z=1.96,p=k/n,den=1+z*z/n;
 const mid=(p+z*z/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
 return [Math.max(0,mid-half),Math.min(1,mid+half)];
}
export function rate(k,n,label){
 if(n<10)return {label,visible:false,summary:k+' of '+n+' · '+(10-n)+' more before a percentage is useful'};
 const [lo,hi]=wilson(k,n);
 return {label,visible:true,summary:Math.round(k/n*100)+'% ('+Math.round(lo*100)+'–'+Math.round(hi*100)+'%) · '+k+' of '+n};
}
export function activity(state,now=new Date()){
 const e=state.events,sub=e.filter(x=>x.kind==='submission'),out=e.filter(x=>x.kind==='outreach'&&x.step==='sent'),replies=e.filter(x=>x.kind==='reply');
 const responded=new Set(replies.map(x=>x.threadId));
 const attached=sub.filter(x=>x.personAttached?.contactId).length;
 const mature=sub.filter(x=>(now-new Date(x.at))/86400000>=21);
 const answered=new Set(e.filter(x=>x.kind==='outcome'&&['response','screen','interview'].includes(x.stage)).map(x=>x.jobId));
 return {counts:{submissions:sub.length,withPerson:attached,outreach:out.length,replies:replies.length,interviews:e.filter(x=>x.kind==='outcome'&&x.stage==='interview').length},
  rates:[rate(attached,sub.length,'Of applications marked submitted in Hoshi'),rate(out.filter(x=>responded.has(x.threadId)).length,out.length,'Of outreach sends you marked'),rate(mature.filter(x=>answered.has(x.jobId)).length,mature.length,'Of applications marked submitted 21+ days ago')],
  immature:sub.length-mature.length,stageFor:id=>jobStage(e,id)};
}
