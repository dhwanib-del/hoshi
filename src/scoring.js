// PRD section 9: scores prioritize conversations; never predict hiring odds.
import {jobStage,gateState} from './model.js';
import {freshnessScore,describeAge,recencyOf,isFresh} from './freshness.js';
// Weight table decided 2026-11-03: the 2027-agent spec's terms and priorities,
// with a connection term kept rather than dropped to 0. Authorization rises from
// 5 to 20 and becomes a three-state gate (Q4 answered); experience, company and
// narrative are retired; portfolio relevance enters at 5.
export const WEIGHTS=Object.freeze({role:25,eligibility:20,authorization:20,connection:15,freshness:10,portfolio:5,location:5});
// PRD §10.5 invariant (14), added 2026-11-05. The weight table's identity is
// DERIVED from the table, never written beside it. `weightsVersion` on a
// submission row exists so Activity can segment a rate by the table that scored
// it (honesty rule 11), and it was a literal `'2026-09-29'` for the two days
// after the table moved — stale, silent, and read by nothing, so no test failed.
// The row is append-only, so that staleness is permanent rather than a bug a
// release fixes. Sorted keys, so a reordered table is the same table.
export const WEIGHTS_VERSION=Object.keys(WEIGHTS).sort()
 .map(k=>k.slice(0,3)+WEIGHTS[k]).join('-');
// Tier points rescaled to the 15-point connection term, ordering preserved.
export const POINTS=Object.freeze({C3:15,C2:10,C1:6,C0:0});
// Eligibility and authorization are hard gates, so every RANKED job carries both
// in full. The ranked range is therefore RANKED_FLOOR–100 (40 gate points + the
// role floor), 45 points wide today, and connection's 15 is exactly a third of it.
// Every figure here is derived below, so none of it can go stale in a comment.
export const GATE_POINTS=WEIGHTS.eligibility+WEIGHTS.authorization;
export const RANKED_FLOOR=GATE_POINTS+15;
// PRD §9.3 invariant 1: connection re-ranks the qualified set, it cannot admit
// a job below this floor. Invariant (13): a share of the term, not a literal —
// 0.6 of role, which is 15 at today's 25 and follows the table if it moves.
export const ROLE_FLOOR_SHARE=0.6;
export const ROLE_FLOOR=Math.round(ROLE_FLOOR_SHARE*WEIGHTS.role);
export const SOFT_BLOCK=WEIGHTS.freshness+WEIGHTS.portfolio+WEIGHTS.location;
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
/**
 * Portfolio relevance, and it must name the project or it scores nothing
 * (Principle 6). Matches the job's own words against tags the user wrote for
 * her real projects — never invents a project and never claims a skill.
 */
export function portfolioMatch(job,profile){
 const text=lower((job.title||'')+' '+(job.descriptionText||''));
 if(!text.trim())return {points:0,project:null,why:'nothing to match against yet'};
 let best=null;
 for(const project of profile?.portfolioProjects||[]){
  const hits=(project.tags||[]).filter(t=>t&&text.includes(lower(t)));
  if(hits.length&&(!best||hits.length>best.hits.length))best={project,hits};
 }
 if(!best)return {points:0,project:null,why:'no saved project matches this posting'};
 return {points:WEIGHTS.portfolio,project:best.project.name,
  why:best.project.name+' — matched on '+best.hits.slice(0,3).join(', ')};
}

export function scoreJob(job,profile,people=[],events=[],now=new Date()){
 const title=lower(job.title),lanes=profile.roleLanes||[];
 const direct=lanes.some(l=>l&&title.includes(lower(l)));
 const partial=!direct&&/product design|ux |user experience|experience design|researcher|interaction design/.test(title);
 // Derived from WEIGHTS, never hardcoded: a weight change must not leave a
 // literal behind. (It did, on the first pass: authorization kept scoring 5
 // after the table moved it to 20, and the ranked floor silently broke.)
 const roleFit=direct?WEIGHTS.role:partial?Math.round(0.64*WEIGHTS.role):0;
 const eligibility=job.eligibility==='eligible'?WEIGHTS.eligibility:0;
 const authorization=job.authorization==='confirmed'?WEIGHTS.authorization:0;
 const tier=tierFor(job.company,people,events,now);
 const fresh=freshness(job,now);
 const folio=portfolioMatch(job,profile);
 const location=job.locationMatch===true?WEIGHTS.location
  :(profile.locations||[]).some(l=>l&&lower(job.location).includes(lower(l).trim()))?WEIGHTS.location:0;
 // Invariant (12), PRD §9.1: only a job whose gates are both VERIFIED is ranked,
 // so every ranked job scores eligibility and authorization in full and the
 // ranked range starts at RANKED_FLOOR. A held job carries no total at all — a
 // GATE_POINTS-sized deficit that is the absence of a check, not a property of
 // the role, must never compete with a real score.
 const gate=gateState(job);
 const closed=job.listingState==='closed';
 const rankable=gate.state==='ranked'&&!closed;
 const total=rankable?roleFit+eligibility+authorization+POINTS[tier.tier]+fresh.points+folio.points+location:null;
 const qualified=rankable&&roleFit>=ROLE_FLOOR;
 const threshold=profile.priorityThreshold??70;
 const promoted=qualified&&(total>=threshold||tier.tier!=='C0');
 return {total,rankable,gate:gate.state,missingChecks:gate.missing,roleFit,tier:tier.tier,contact:tier.contact,promoted,qualified,
  // The version travels with the score, not with whoever writes the row: a
  // score and the table that produced it are one fact (PRD §10.5 invariant 14).
  weightsVersion:WEIGHTS_VERSION,
  // The ranked range is 40–100, not 0–100: state it so the number is readable.
  scale:rankable?{min:RANKED_FLOOR,max:100}:null,
  portfolioProject:folio.project,
  // Structured breakdown so a surface can show WHY without parsing prose.
  // The panel led with a score box and buried all of this behind a disclosure,
  // which made a scored job and an unscored one look identical.
  terms:[
   {key:'role',points:roleFit,note:direct?'your role lane':partial?'adjacent role':'no match'},
   {key:'eligibility',points:eligibility,note:job.eligibility||'unverified'},
   {key:'authorization',points:authorization,note:job.authorization||'unverified'},
   {key:'connection',points:POINTS[tier.tier],note:tier.contact?.name||null},
   {key:'freshness',points:fresh.points,note:fresh.basis==='none'?null:fresh.band},
   {key:'portfolio',points:folio.points,note:folio.project},
   {key:'location',points:location,note:location?'your locations':null}
  ],
  reason:closed?'Listing closed — no longer accepting applications':gate.state==='excluded'?gate.why:gate.state==='held'?gate.why:roleFit<ROLE_FLOOR?'Below '+ROLE_FLOOR+'/'+WEIGHTS.role+' role-fit floor':!promoted?'Below priority threshold':'Qualified',
  lines:['+'+roleFit+' role · '+(direct?'matches your saved role lane':partial?'adjacent role':'not matched'),
    '+'+eligibility+' eligibility · '+(job.eligibility||'not verified'),
    '+'+authorization+' work authorization · '+(job.authorization||'not verified'),
    '+'+POINTS[tier.tier]+' connection · '+tier.reason,
    '+'+fresh.points+' freshness · '+fresh.line,
    '+'+folio.points+' portfolio · '+folio.why,
    '+'+location+' location · '+(location?'matches a location you listed':'not matched to your locations')]};
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
 // Rows imported from a spreadsheet or typed by hand carry no posting date any
 // source can verify, so they would fill this board with "unverified" cards and
 // bury the jobs it exists to show. They stay under the All filter.
 const IMPORTED=['google-sheets-csv','manual'];
 const imported=(state.jobs||[]).filter(j=>IMPORTED.includes(j.origin)&&j.listingState!=='closed').length;
 const rows=(state.jobs||[]).filter(j=>j.listingState!=='closed'&&!IMPORTED.includes(j.origin)).map(job=>({
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
 return {bands,rows,open:rows.length,imported,
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
// PRD §10.3 rule 10 and invariant (15), added 2026-11-06. A rate's population
// label is DERIVED from the membership test that built its denominator, never
// written beside it. The person-attached rate here read the literal 'Of
// applications marked submitted in Hoshi' over a denominator that also held her
// hand-entered `source:'user'` rows — so the one component whose job is to state
// its population stated the wrong one, and stated it confidently. A label is
// also the only part of a rate she cannot check: a percentage is recomputable
// from `6 of 20`, a population from nothing on the surface. This is invariant
// (14)'s fix moved from a store to a screen.
export const POPULATION=Object.freeze({
 hoshi:{of:x=>x.source==='hoshi',label:'applications Hoshi filled'},
 user:{of:x=>x.source==='user',label:'applications you entered yourself'},
 marked:{of:()=>true,label:'outreach sends you marked'}
});
// The skew direction belongs to the PAIR (rate, population) and not to either
// alone, which is why both arms of the person-attached rate read high while the
// two arms of the response rate point opposite ways. Rule 10 attaches a
// direction to a rate; once a rate is segmented the direction is a property of
// the segment, so the caller states it and the population only names itself.
export function populationRate(key,rows,hit,skew){
 const p=POPULATION[key];
 if(!p?.label)throw Error('A rate needs a population that can name itself (invariant 15)');
 const own=rows.filter(p.of),k=own.filter(hit).length;
 return {...rate(k,own.length,'Of '+p.label),population:key,k,n:own.length,skew};
}
// PRD §10.3 rule 11, amended 2026-11-06. Segmentation by `source` binds exactly
// two rates — person-attached, and response over `submission` rows — and neither
// may be shown pooled. Where an arm falls under rule 1's floor of 10 the
// fallback is rule 1's own: that arm shows its fraction, which is exact about
// what was recorded. It is never a pooled percentage with a caveat under it,
// because the caveat arrives after the number has been read.
function bySource(metric,rows,hit,skews,note){
 return {metric,kind:'segmented',pooled:null,note,
  segments:[['hoshi',skews.hoshi],['user',skews.user]].map(([k,s])=>populationRate(k,rows,hit,s))};
}
export function activity(state,now=new Date()){
 const e=state.events,sub=e.filter(x=>x.kind==='submission'),out=e.filter(x=>x.kind==='outreach'&&x.step==='sent'),replies=e.filter(x=>x.kind==='reply');
 const responded=new Set(replies.map(x=>x.threadId));
 const matured=x=>(now-new Date(x.at))/86400000>=21;
 const mature=sub.filter(matured);
 const answered=new Set(e.filter(x=>x.kind==='outcome'&&['response','screen','interview'].includes(x.stage)).map(x=>x.jobId));
 // §10.5: Activity segments by `weightsVersion` or states that it did not. It
 // states that it did not, and names how many tables the denominator spans,
 // which is the fact a reader needs. Pooling two scales widens a number; it
 // does not leave the direction unknown, which is why rule 11's harder fallback
 // is for `source` and not for this.
 const tables=[...new Set(sub.filter(x=>x.source==='hoshi').map(x=>x.weightsVersion).filter(Boolean))];
 return {counts:{submissions:sub.length,withPerson:sub.filter(x=>x.personAttached?.contactId).length,
   outreach:out.length,replies:replies.length,interviews:e.filter(x=>x.kind==='outcome'&&x.stage==='interview').length},
  rates:[
   bySource('A person attached before you submitted',sub,x=>!!x.personAttached?.contactId,
    {hoshi:'Reads high: the applications you send around Hoshi are mostly the cold ones.',
     user:'Reads high: you remember the application you cared about, not the midnight one.'},
    'Your own rows belong in this denominator — having a person attached is a fact about your behaviour, not about Hoshi. They are not pooled with Hoshi’s, because the two arms are skewed by different things (rule 11).'),
   bySource('A response, 21+ days after submitting',mature,x=>answered.has(x.jobId),
    {hoshi:'Reads low: a row written at review for an application never sent can only ever look like a failure.',
     user:'Reads high: the same entry selection, on the other side of the funnel.'},
    'These two point in opposite directions, so a pooled percentage would have no direction left to state.'),
   {metric:'A reply to outreach you sent',kind:'single',pooled:null,
    note:'One regime: every outreach and reply row is yours to assert, so there is nothing here to segment (rule 11).',
    segments:[populationRate('marked',out,x=>responded.has(x.threadId),
     'Upper bound: the denominator is the sends you remembered to mark.')]}],
  immature:{hoshi:sub.filter(x=>x.source==='hoshi'&&!matured(x)).length,
   user:sub.filter(x=>x.source==='user'&&!matured(x)).length},
  weightTables:tables,stageFor:id=>jobStage(e,id)};
}
