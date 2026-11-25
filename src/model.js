import {mergeTimestamps} from './freshness.js';
export const KEY='hoshi_v1';
export const DEFAULTS=Object.freeze({
 profile:{graduationYear:'2027',roleLanes:['product designer','ux designer','ux researcher','experience designer','interaction designer'],sponsorship:'requires-sponsorship',locations:['United States','London','United Kingdom'],priorityThreshold:70,
  // The user's own projects, in her own words. Editable in Settings. Tags are
  // what a posting's text is matched against; nothing here is a skill claim.
  portfolioProjects:[
   {name:'U-M DPSS',tags:['public safety','service design','government','civic','campus']},
   {name:'General Motors automotive UX research',tags:['automotive','in-vehicle','infotainment','mobility','user research']},
   {name:'Open Library multilingual accessibility',tags:['accessibility','a11y','multilingual','localization','internationalization','library']},
   {name:'Amazon Family research',tags:['family','consumer','marketplace','e-commerce','retail']},
   {name:'MaizeTix mobile optimization',tags:['mobile','ticketing','conversion','checkout','performance']}
  ]},
 jobs:[],people:[],boards:[],answers:[],answersWithdrawn:0,events:[],settings:{},lastBriefDate:null
});
// The protected-group guard. Its WORDING COVERAGE is an assumption and always
// will be: a deny-list fails open, so a phrasing it does not carry is stored
// and then filled by the exact-match rule. The four wordings an integration
// vendor calls typical (gender / race-ethnicity / protected veteran /
// disability) were all caught by the old list, which is exactly why its gaps
// survived -- the list and the test that covered it were written from the same
// four. So what the tests assert is the MECHANISM, not the list: invariant (8)
// holds over the whole store, and widening this regex withdraws what it has
// already stored (bankWithdrawals, re-run by stateFrom on every read).
// Deliberately absent: citizenship, national origin and work authorization.
// Sponsorship is the employer-independent answer PRD 11 exists to reuse.
export const PROTECTED=/\b(rac(e|ial)|ethnic(ity)?|hispanic|latin[oax]|gender|sex|sexual(ity)?|sexual.?orientation|lgbt\w*|transgender|pronouns?|disab(led|ility|ilities)|accommodations?|impairment|(health|medical)[ -]?condition|chronic[ -]?(illness|condition)|veterans?|military[ -]?service|birth.?date|date.?of.?birth|age|religio(n|us)|caste|marital|married|pregnan(t|cy))\b/i;
// Invariant (8) over the DATA rather than over the schema. The bank's keys are
// fixed, so Principle 3's walk finds no protected key by construction and
// proves nothing: the category lives in the VALUE of `question`. The count is
// stated and the question text is never kept -- printing a withdrawn question
// back would re-store the thing being refused.
export function bankWithdrawals(answers=[]){
 const kept=[],withdrawn=[];
 for(const a of answers)(PROTECTED.test(a?.question||'')?withdrawn:kept).push(a);
 return {kept,withdrawn:withdrawn.length};
}
export const asId=()=>globalThis.crypto?.randomUUID?.() || String(Date.now())+'-'+Math.random().toString(36).slice(2);
export const cleanText=(value,max=500)=>String(value??'').trim().slice(0,max);
// PRD §8.4 / invariant (22), added 2026-11-16. ONE cap for the description,
// because §8.4 promises one shape from two producers and a bound each producer
// applies for itself is two bounds: the page path cut at 1400 and the adapter
// path at 1800, so the same requisition stored a different amount of text
// depending on how she met it. `[assumption]` the 1800 — it is a trade against
// B-17's 10MB quota, not a measurement: at this cap a job record is ~2.9KB and
// the quota fills at ~3,600 jobs; at 4000 chars ~2,050; at full HTML ~495.
export const DESCRIPTION_CAP=1800;
// The length BEFORE the cut rides the record, so truncation is DERIVED and
// never stamped (invariant 13's shape). A cap on a LIST can print "2 more not
// shown"; a cap on a STRING has no overflow surface, so a sibling field is the
// only way the cut is countable at all.
export function boundDescription(raw,cap){
 if(!Number.isFinite(cap)||cap<=0)throw Error('A stored description needs the one cap passed in, never a local literal');
 const text=String(raw??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 return {descriptionText:text.slice(0,cap),descriptionSourceChars:text?text.length:null};
}
// Three states and never two. `partial` covers both "cut" and "stored before
// this rule existed, so completeness is unknown" — a truncation can only ever
// produce a FALSE NEGATIVE, so both cases forbid the same thing: reporting
// absence over this text as a finding.
export function descriptionCoverage(job,cap=DESCRIPTION_CAP){
 if(!job?.descriptionText)return 'none';
 if(!Number.isFinite(job.descriptionSourceChars))return 'partial';
 return job.descriptionSourceChars>cap?'partial':'full';
}
export function stateFrom(input){
 const state=Object.fromEntries(Object.entries(DEFAULTS).map(([k,v])=>[k,input?.[k]===undefined?structuredClone(v):input[k]]));
 // Migrations. Without these the new engine runs against old records and
 // produces nothing: a stored profile kept its old keys, so portfolioProjects
 // never existed and that term scored 0 for everyone with an existing install,
 // and every job saved before 2026-11-03 carried date/dateKind rather than the
 // four timestamps, so all of them read "Posting age unverified".
 state.profile={...structuredClone(DEFAULTS.profile),...state.profile};
 state.jobs=state.jobs.map(job=>{
  if(job.timestamps)return job;
  const ms=job.date?Date.parse(job.date):NaN;
  const at=Number.isFinite(ms)?new Date(ms).toISOString():null;
  return {...job,timestamps:{
   // dateKind said which of the two it was, so carry it to the matching field
   // and never promote an edit date into a publication date.
   publishedAt:job.dateKind==='posted'?at:null,
   modifiedAt:job.dateKind==='updated'?at:null,
   discoveredAt:job.createdAt||null,
   repostedAt:null}};
 });
 // The protected-group guard is re-run on every read, not only at the write
 // site, so widening it withdraws answers stored under a narrower version
 // instead of grandfathering them. Possible here and not for weightsVersion
 // (PRD 10.5) because the bank is current state rather than append-only.
 const bank=bankWithdrawals(state.answers);
 state.answers=bank.kept;
 state.answersWithdrawn=(Number(input?.answersWithdrawn)||0)+bank.withdrawn;
 return state;
}
export function safeProfile(updates){
 const result={};
 for(const k of ['graduationYear','roleLanes','sponsorship','locations','priorityThreshold'])if(Object.hasOwn(updates||{},k))result[k]=updates[k];
 for(const k of ['roleLanes','locations'])if(result[k])result[k]=Array.isArray(result[k])?result[k].map(v=>cleanText(v,70)).filter(Boolean).slice(0,20):[];
 if(result.priorityThreshold!==undefined)result.priorityThreshold=Math.max(0,Math.min(100,Number(result.priorityThreshold)||70));
 if(result.graduationYear!==undefined)result.graduationYear=cleanText(result.graduationYear,4);
 return result;
}
/**
 * PRD §9.2 invariant (28), added 2026-11-25. The company join, in one place.
 *
 * The connection term, §8.1's watchlist, §7.3's "role at their company" row,
 * the contacts count and §8.5's third dedup key all ask one question — is this
 * posting at a company where she knows someone — and every one of them asked it
 * with its own string comparison. Three different rules were in the code: a
 * case-folded equality in `tierFor`, a CASE-SENSITIVE one in the brief row, and
 * a whitespace-collapsing one in the dedup key. And neither side of the compare
 * is constrained: a person's employer is typed by her or imported from a sheet,
 * while a job's company is either the label she gave the board or the posting's
 * own `hiringOrganization.name`, so the same employer arrives spelled two ways
 * by design. A comma cost a whole tier.
 *
 * The normalisation is SYNTACTIC and stops there: case, punctuation, whitespace
 * and a closed list of legal forms taken off the tail. Hoshi never maps one
 * name to another — Alphabet is not Google here, and a parent is not its
 * subsidiary — because that is a corporate-structure claim, and §9.1 carries
 * the publisher of the one public dataset saying in writing that a name is not
 * an employer. At least one token always survives, so a name made only of legal
 * forms still has a key rather than becoming the empty string that matches
 * everything.
 */
export const LEGAL_FORMS=Object.freeze(['inc','incorporated','llc','ltd','limited',
 'corp','corporation','co','company','plc','gmbh','ag','sa','sas','srl','bv','nv','ab','oy','pty','llp','lp']);
export function companyKey(name){
 const words=String(name||'').toLowerCase().replace(/[^a-z0-9&+]+/g,' ').trim().split(/\s+/).filter(Boolean);
 while(words.length>1&&LEGAL_FORMS.includes(words[words.length-1]))words.pop();
 return words.join(' ');
}
/**
 * A miss is not an observation of absence (§8.8's rule, now in a join). Four
 * relations, and only `exact` and `normalised` are a match:
 *  - `incomparable` — one side has no company at all, so nothing was compared.
 *  - `unresolved`   — one key's tokens are a PREFIX of the other's ("stripe"
 *    against "stripe technologies"). Hoshi cannot tell whether that is one
 *    employer, so it awards nothing and names the pair for her to settle.
 *  - `different`    — the keys share no leading run of tokens. This is the only
 *    relation that supports "nobody is there".
 * `[assumption]` the prefix test. A wider one — any shared first token — would
 * flag American Airlines against American Express, and a louder false alarm on
 * the one surface she reads is worse than a quieter miss she can still fix by
 * editing either name.
 */
export function companyMatch(a,b){
 const x=companyKey(a),y=companyKey(b);
 if(!x||!y)return {match:false,relation:'incomparable'};
 if(x===y)return {match:true,relation:String(a).trim()===String(b).trim()?'exact':'normalised'};
 const xs=x.split(' '),ys=y.split(' '),short=xs.length<=ys.length?xs:ys,long=xs.length<=ys.length?ys:xs;
 return {match:false,relation:short.every((w,i)=>w===long[i])?'unresolved':'different'};
}
export function jobIdentity(job){
 const url=String(job.applyUrl||'').split(/[?#]/)[0].replace(/\/$/,'').toLowerCase();
 if(url)return 'url:'+url;
 if(job.provider&&job.providerJobId)return job.provider+':'+job.providerJobId;
 // Key 3 takes the same key as every other consumer of the company join, so a
 // posting met at a board and met on its own page is not two records over a
 // legal suffix (invariant 28).
 return 'name:'+[companyKey(job.company),job.title,job.location].join('|').toLowerCase().replace(/\s+/g,' ').trim();
}
export function mergeJob(existing,next){
 if(!existing)return {...next,id:next.id||asId(),createdAt:new Date().toISOString(),
  timestamps:mergeTimestamps(null,next.timestamps)};
 // Timestamps merge on their own rules: a real publication date is never
 // overwritten by a weaker one, and a reappearance after a verified delisting
 // is recorded as a repost rather than silently restored (src/freshness.js).
 const timestamps=mergeTimestamps(existing,next.timestamps);
 const reposted=timestamps.repostedAt&&!existing.timestamps?.repostedAt;
 const listing=reposted?{listingState:'live',listingSeenAt:next.listingSeenAt||existing.listingSeenAt||null,closedAt:null,closedReason:null}:{};
 // PRD §8.8: a listing state that an observation produced is not overwritten by
 // a record that carries none. The page path wins on extracted fields (§8.5),
 // but liveness and closure are observations about the BOARD, so a page capture
 // arriving with the default `unknown` must not un-see this morning's poll.
 const observed=x=>x?.listingSeenAt||x?.closedAt;
 const held=observed(existing)&&!observed(next)
  ?{listingState:existing.listingState,listingSeenAt:existing.listingSeenAt??null,closedAt:existing.closedAt??null,closedReason:existing.closedReason??null}:{};
 // PRD §8.5 (2026-11-16): the page record wins on populated fields BECAUSE it is
 // the higher-fidelity one — true of a selector against a guess, and false for
 // exactly one field. "Higher fidelity" is a claim about a record, and fidelity
 // is a property of a field: the page path's description is JSON-LD prose, often
 // a short summary or absent, while the adapter's is the provider's own field.
 // So this field resolves on which copy is less cut, whichever path it came from,
 // and its source length and provenance travel with the text that won.
 const better=bestDescription(existing,next);
 if(existing.origin==='page'&&next.origin==='discovery'){
  // PRD §8.5: the page record wins on populated fields; discovery only fills blanks.
  const patched={...existing};
  for(const [key,val] of Object.entries(next))if((patched[key]==null||patched[key]==='')&&val!=null)patched[key]=val;
  return {...patched,...listing,...better(patched),timestamps};
 }
 const result={...existing,...next,...held,...listing,...better(existing),timestamps};
 result.id=existing.id;result.createdAt=existing.createdAt;return result;
}
function bestDescription(existing,next){
 const len=x=>String(x?.descriptionText||'').length;
 // A tie keeps the record already stored: equal text is not a reason to churn,
 // and nothing is gained by preferring either producer at the same length.
 const win=len(next)>len(existing)?next:existing;
 return base=>!len(win)?{}:{descriptionText:win.descriptionText,
  descriptionSourceChars:win.descriptionSourceChars??null,
  provenance:{...(base?.provenance||{}),descriptionText:win.provenance?.descriptionText||'unavailable'}};
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
// PRD §8.8 (2026-11-09). `live` is an observation — a complete board response
// that contained this requisition — and the observation has an instant.
// Invariant (17): listingState 'live' requires a non-null listingSeenAt, and a
// record that arrives claiming liveness without one FAILS CLOSED to `unknown`
// rather than keeping the claim. `unknown` is the no-claim state, so this
// withdraws a claim instead of inventing one (Principle 5).
export const LISTING_STALE_INTERVALS=2,POLL_INTERVAL_HOURS=24;
export function listingStatus(job,now=new Date()){
 const seen=job?.listingSeenAt?Date.parse(job.listingSeenAt):NaN;
 if(job?.listingState==='closed')return {state:'closed',seenAt:job.closedAt||null,why:job.closedReason||'delisted'};
 if(job?.listingState!=='live'||!Number.isFinite(seen))return {state:'unknown',seenAt:null,why:job?.unmatchedReason||'no complete board response has confirmed this listing'};
 // §8.9's two-interval rule, DERIVED rather than stamped (invariant 13's
 // shape): the stored value is the observation, and its age is computed, so
 // nothing on the record goes false while nobody polls.
 const hours=(now.getTime()-seen)/3600000;
 if(hours>LISTING_STALE_INTERVALS*POLL_INTERVAL_HOURS)return {state:'unknown',seenAt:job.listingSeenAt,why:'last confirmed more than '+LISTING_STALE_INTERVALS+' polls ago'};
 return {state:'live',seenAt:job.listingSeenAt,why:'listed in the board’s last complete response'};
}
export function addJob(state,job){
 if(!job.title||!job.company)throw Error('A job needs a real title and company.');
 // Invariant (22): a stored description carries the length it was cut from, or
 // the write is refused rather than kept as text of unknown completeness
 // (Principle 5 — fail closed means writing nothing, not writing a guess).
 if(job.descriptionText&&job.descriptionSourceChars===undefined)
  throw Error('A stored description must carry descriptionSourceChars (PRD §8.4 invariant 22)');
 const identity=jobIdentity(job);
 const at=state.jobs.findIndex(j=>j.identity===identity || (j.provider&&j.provider===job.provider&&j.providerJobId&&j.providerJobId===job.providerJobId));
 const claimed=job.listingState||'unknown';
 const record={...job,identity,listingState:claimed==='live'&&!job.listingSeenAt?'unknown':claimed};
 if(at<0)return {...state,jobs:[mergeJob(null,record),...state.jobs]};
 const jobs=[...state.jobs];jobs[at]=mergeJob(jobs[at],record);return {...state,jobs};
}
// PRD §9.2 invariant (24), added 2026-11-18. The `outcome` kind has carried
// `rejected` since 2026-10-16, so the APPLICATION funnel's enum could record a
// no; the CONVERSATION funnel's could not — `reply` had `replied` and
// `refer-offered` and nothing for the answer that refuses. So a contact who
// wrote back "I've left, I can't refer you" was stored with the same word as a
// referral offer, and C3 read the arrival of a message rather than the answer in
// it. `declined` is her assertion like the other two (Principle 4 keeps Hoshi
// out of her mail), and a step outside the union is REFUSED rather than coerced
// to `replied`: fail closed on an append-only store means writing nothing.
export const REPLY_STEPS=Object.freeze(['replied','refer-offered','declined']);
export function appendEvent(state,event){
 if(!['submission','outcome','outreach','reply','brief'].includes(event.kind))throw Error('Unknown event kind');
 if(event.kind==='reply'&&!REPLY_STEPS.includes(event.step))
  throw Error('A reply must say what came back: '+REPLY_STEPS.join(' | ')+' (PRD §9.2 invariant 24)');
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
 // Invariant (14): no version literal lives here. The score carries the table
 // that produced it, and a score that cannot name one is REFUSED rather than
 // stamped with a guess — fail closed (Principle 5) on an append-only store,
 // where a row written wrong can never be taken back.
 if(!score.weightsVersion)throw Error('A Hoshi-scored submission needs the weight table that produced the score');
 // Invariant (23), PRD §9.2: C1 is two constructions, so a C1 row without the
 // one that produced it is permanently un-segmentable in an append-only store —
 // the same reason invariant (14) refuses a row whose score names no weight
 // table. Refused rather than stamped with whichever construction looks likely.
 if(score.tier==='C1'&&!score.tierBasis)throw Error('A C1 submission needs the construction that produced the tier');
 return appendEvent(state,{kind:'submission',source:'hoshi',jobId,
  roleFit:score.roleFit,totalScore:score.total,weightsVersion:score.weightsVersion,
  personAttached:score.tier!=='C0'&&score.contact?{contactId:score.contact.id,tier:score.tier,
   ...(score.tier==='C1'?{tierBasis:score.tierBasis}:{})}:null});
}
// PRD §10.3 rule 12, added 2026-11-20. The enum had no single definition: this
// write site held one copy and Activity's numerator held another, as an
// inclusion list that silently left `rejected` out. A numerator is a membership
// test, so it is derived from the enum rather than written beside it, and a
// value the numerator does not count has to be NAMED (invariant 25).
export const OUTCOME_STAGES=Object.freeze(['response','screen','interview','rejected']);
export function markOutcome(state,jobId,stage){
 if(!OUTCOME_STAGES.includes(stage))throw Error('Invalid outcome: '+OUTCOME_STAGES.join(' | '));
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
