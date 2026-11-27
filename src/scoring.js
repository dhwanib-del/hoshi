// PRD section 9: scores prioritize conversations; never predict hiring odds.
import {jobStage,gateState,descriptionCoverage,companyMatch,REPLY_STEPS,OUTCOME_STAGES} from './model.js';
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
// PRD §9.6 invariant (16), added 2026-11-07. Role is the largest term and had no
// scoring rule in the document at all. Three bands, as shares of the term, with
// the relation asserted rather than the points: unmatched < floor <= adjacent <
// lane. The floor and the adjacent band are ONE decision — one point apart today
// — so either moved alone empties the brief of every adjacent-title role or
// admits every title Hoshi half-recognised.
export const ROLE_ADJACENT_SHARE=0.64;
export const ROLE_BANDS=Object.freeze({
 lane:WEIGHTS.role,
 adjacent:Math.round(ROLE_ADJACENT_SHARE*WEIGHTS.role),
 unmatched:0
});
export const SOFT_BLOCK=WEIGHTS.freshness+WEIGHTS.portfolio+WEIGHTS.location;
const lower=s=>String(s||'').toLowerCase();
const shortDate=x=>new Date(x).toLocaleDateString(undefined,{month:'short',day:'numeric'});
// PRD §9.2 invariant (19), added 2026-11-11. The tier belongs to the contact and
// the event log's grain is the thread, so "21 days since the thread's outreach
// row" had as many answers as she has threads with that person — and reading the
// LATEST send made the clock hers to restart: one new send about a second opening
// put a contact who had been silent for 40 days back at C2, and §7.3's decaying
// row went quiet on the same event. One more unanswered message is more evidence
// the path is cold, not less, so decay is monotone absent a reply: the clock runs
// from the EARLIEST unanswered thread and no later send restores the tier.
export const DECAY_DAYS=21;
export const COOLING_LEAD_DAYS=3;
export function decayClock(contactId,events,now=new Date()){
 const replied=events.some(e=>e.kind==='reply'&&e.contactId===contactId);
 const messages=events.filter(e=>e.kind==='outreach'&&e.contactId===contactId);
 const opens=messages.filter(e=>e.step==='sent');
 if(replied||!opens.length)return {replied,first:null,days:0,messages:messages.length,spent:false};
 const first=opens.reduce((a,b)=>new Date(a.at)<=new Date(b.at)?a:b);
 const days=(now-new Date(first.at))/86400000;
 return {replied,first,days,messages:messages.length,spent:days>DECAY_DAYS};
}
// PRD §9.2 invariant (23), added 2026-11-17 (B-28). C1 holds TWO constructions
// and the invariants admitted only one. Invariants (5) and (10) were written for
// the alum route — a ranked alum at the company she has not saved, which is the
// one tier Hoshi asserts on her behalf, so it owes a resolvable record, its
// `origin` and an `employerAsOf`. But decay has sent a C2 to C1 since 09-29, and
// a C2 may be a hand-typed contact with no alum record at all, so that route
// could not satisfy either invariant — and invariant (19) made it permanent.
// Both are C1 because both are the same claim about today (a named person at the
// company and nothing she can act on), and each names its own evidence: the alum
// route the list and the date, the spent route the thread and the silence. So
// the basis is DERIVED from the evidence and travels with the tier, because
// everything downstream — the score line, the stored row, a tier-segmented rate
// — was reading one label over two populations with opposite meanings.
export const C1_BASES=Object.freeze(['alum','spent','declined']);
// PRD §9.2 invariant (24), added 2026-11-18. The tier claims what the person can
// do TODAY, and it was derived from a reply row's existence rather than from the
// answer in it — so a decline scored C3, the whole connection weight, identical
// to a referral offer, and C3 never decays, so it was permanent. The latest
// COUNTERPARTY row governs: monotone in evidence that is not hers, as invariant
// (19) made decay, so nothing she sends moves it and a later offer still lifts
// it. Her only repair for a row already written is to append the correcting one,
// because the tier is derived from the log rather than stored beside it.
export function latestAnswer(contactId,events){
 const replies=events.filter(e=>e.kind==='reply'&&e.contactId===contactId&&REPLY_STEPS.includes(e.step));
 return replies.length?replies.reduce((a,b)=>new Date(a.at)>=new Date(b.at)?a:b):null;
}
export function tierFor(company,people,events,now=new Date()){
 // Invariant (28): the join runs through companyMatch and nowhere else, and a
 // relation it cannot settle is held out of the tier rather than scored as
 // nobody being there. `unresolved` is the near-miss Hoshi holds and used to
 // hide: "Nobody found at this company" over a saved contact one comma away.
 const eligible=people.filter(p=>{
  if(!p.name||!p.origin)return false;
  if(p.origin==='user-imported CareerLink CSV'&&!['Verified current','Changed employer','Verified public profile'].includes(p.employerCheck))return false;
  return true;
 });
 const rel=p=>companyMatch(company,p.currentEmployer||p.company);
 const matches=eligible.filter(p=>rel(p).match);
 const unresolved=eligible.filter(p=>rel(p).relation==='unresolved')
  .map(p=>({name:p.name,employer:String(p.currentEmployer||p.company||'').trim()}));
 let best={tier:'C0',basis:null,contact:null,unresolved,
  reason:unresolved.length
   // Hoshi names its OWN failure — two strings it could not match — never a
   // judgment about her list (§9.4 invariant 27's line on whose gap it is).
   ?'no name matched “'+String(company).trim()+'” · '+unresolved[0].name+' is at “'+unresolved[0].employer+'”, which Hoshi cannot tell is the same employer'
   :'Nobody found at this company'};
 for(const p of matches){
  const clock=decayClock(p.id,events,now);
  const answer=latestAnswer(p.id,events);
  let tier='C2',basis=null;
  // A decline is C1 and not C0: C0's line reads "nobody found at this company",
  // which is false of a person who wrote back. And it sits BELOW an unanswered
  // C2 on purpose — silence is ambiguous, an explicit no is information.
  if(answer&&answer.step==='declined'){tier='C1';basis='declined';}
  else if(answer)tier='C3';
  else if(clock.spent){tier='C1';basis='spent';}
  else if(p.rankSource==='alumni'&&!p.saved){
   // Invariants (5) and (10) bind this construction and only this one: an
   // unprovenanced or undated alum C1 is UNCONSTRUCTIBLE rather than scored
   // low, and nothing upgrades on failure — she does not become a C2 because
   // her record is thin.
   if(!p.origin||!p.employerAsOf)continue;
   tier='C1';basis='alum';
  }
  // Each construction names the evidence that produced it. Invariant (19)'s
  // display half: a spent claim prints the date that spent it rather than
  // asserting a cooled tier, and the alum claim prints the date she last
  // confirmed the employer (§9.2's clock) rather than implying it is current.
  const why=tier==='C3'?(answer.step==='refer-offered'?'offered a referral '+shortDate(answer.at):'replied '+shortDate(answer.at))
   :tier==='C2'?'saved contact'
   :basis==='declined'?'answered and could not help, '+shortDate(answer.at)
   :basis==='spent'?'no reply since '+shortDate(clock.first.at)+', '+clock.messages+(clock.messages===1?' send':' sends')
   :'from your alumni list, not saved · employer last confirmed '+shortDate(p.employerAsOf);
  // A tier won on a normalised match says so and prints both strings, because
  // normalisation can over-match as well as under-match and this is the only
  // surface where she could catch it (invariant 18's move, one term over).
  const matched=rel(p).relation==='normalised'?' · matched “'+String(company).trim()+'” to your “'+String(p.currentEmployer||p.company).trim()+'”':'';
  if(POINTS[tier]>POINTS[best.tier])best={tier,basis,contact:p,unresolved,reason:p.name+' · '+(p.sharedContext||p.origin)+' · '+why+matched};
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
 const coverage=descriptionCoverage(job);
 let best=null;
 for(const project of profile?.portfolioProjects||[]){
  const hits=(project.tags||[]).filter(t=>t&&text.includes(lower(t)));
  if(hits.length&&(!best||hits.length>best.hits.length))best={project,hits};
 }
 // A match is a match whatever the coverage: the cap can only ever hide a tag,
 // never invent one, so truncation produces FALSE NEGATIVES only. Which is why
 // the zero is where it has to be honest — §9.6's unmatched band one term over,
 // and §8.8's rule a third time: a failure to see is not an observation of
 // absence. So the line says which of the three it is and never asserts that no
 // project matches a posting Hoshi only read part of.
 if(best)return {points:WEIGHTS.portfolio,project:best.project.name,coverage,basis:'match',
  why:best.project.name+' — matched on '+best.hits.slice(0,3).join(', ')};
 // Invariant (27), added 2026-11-24. Invariant (22) made this term's zero
 // three-state on the POSTING's side of the comparison and left her side with
 // one state, so a profile holding no tagged project printed "no saved project
 // matches this posting" — a comparison that never ran, asserted as its result.
 // Her side is checked FIRST: with nothing saved, the posting's coverage cannot
 // matter. Same rule as §8.8's, on the other end of the same term.
 const tagged=(profile?.portfolioProjects||[]).some(p=>(p?.tags||[]).some(Boolean));
 if(!tagged)return {points:0,project:null,coverage,basis:'no-input',
  why:'no saved project carries a tag, so nothing was compared — this term is yours to fill in'};
 if(!text.trim()||coverage==='none')return {points:0,project:null,coverage,basis:'no-description',
  why:'no description stored for this posting — nothing to match against'};
 if(coverage==='partial')return {points:0,project:null,coverage,basis:'partial',
  why:'no saved project in the '+(job.descriptionText||'').length+' characters stored of '
   +(Number.isFinite(job.descriptionSourceChars)?job.descriptionSourceChars+' — the rest was not read'
     :'this posting — how much was cut is not recorded')};
 return {points:0,project:null,coverage,basis:'no-match',why:'no saved project matches this posting'};
}
/**
 * PRD §9.4 invariant (27). The same asymmetry one term over, with a third case
 * the old expression also got wrong: a posting that states no location at all
 * scored 0 and printed "not matched to your locations", which blames her list
 * for a field the provider never sent.
 */
export function locationTerm(job,profile){
 if(job?.locationMatch===true)return {points:WEIGHTS.location,basis:'match',why:'matches a location you listed'};
 const saved=(profile?.locations||[]).map(l=>String(l||'').trim()).filter(Boolean);
 if(!saved.length)return {points:0,basis:'no-input',why:'no locations saved, so nothing was compared — this term is yours to fill in'};
 if(!String(job?.location||'').trim())return {points:0,basis:'no-field',why:'this posting states no location'};
 return saved.some(l=>lower(job.location).includes(lower(l)))
  ?{points:WEIGHTS.location,basis:'match',why:'matches a location you listed'}
  :{points:0,basis:'no-match',why:'not one of the locations you listed'};
}

/**
 * PRD §9.6. Which of her saved lanes the posting is, read off fields that carry
 * provenance — never a keyword overlap against her resume, and never a claim
 * about her chances. `unmatched` is "no lane was found in the posting's own
 * words", which is NOT "a role she cannot do"; the floor cannot tell them apart,
 * so the count of unmatched rows is surfaced rather than swallowed.
 *
 * PRD §9.6 invariant (18), added 2026-11-10. §9.6 says the matched lane is named
 * in the score line or the points are not awarded — and the MIDDLE band could
 * never satisfy that. `adjacent` was a fixed regex of UX-ish titles held in this
 * file: it awarded 16 of 25, one point OVER the role floor, printed "adjacent
 * role title", and named nothing. Two consequences, both run rather than argued:
 * it scored 16 for a profile with NO saved lanes at all, so the term she is told
 * she controls in Settings had a floor-clearing band deaf to her profile; and
 * "Clinical Researcher" cleared the floor off the regex's `researcher`.
 * So every nonzero band is DERIVED from a lane she wrote and carries the evidence
 * that produced it, and a band that cannot name its evidence fails closed to
 * `unmatched` — the no-claim state, countable in block 3, never a verdict.
 */
const laneWords=s=>lower(s).split(/[^a-z0-9+#]+/).filter(Boolean);
const roleEvidence=b=>b.basis==='lane'?(b.lane||null)
 :b.basis==='adjacent'?(b.lane&&b.laneTerm?b.lane:null):null;
function band(b){
 // Fail closed, in invariant (17)'s shape: points without nameable evidence are
 // withdrawn rather than kept. Principle 6 enforced per band, not per term.
 return b.points>0&&!roleEvidence(b)
  ?{points:ROLE_BANDS.unmatched,basis:'unmatched',lane:null,laneTerm:null,field:b.field,lanes:b.lanes}:b;
}
export function roleBand(job,profile){
 const title=lower(job.title),titleWords=new Set(laneWords(title));
 const lanes=(profile?.roleLanes||[]).map(l=>String(l||'').trim()).filter(Boolean);
 const lane=lanes.find(l=>title.includes(lower(l)));
 if(lane)return band({points:ROLE_BANDS.lane,basis:'lane',lane,laneTerm:null,field:'title',lanes:lanes.length});
 // Adjacent is a SHARED TERM with a lane she wrote, so the line can print which
 // word of which lane earned it and she can judge it (§9.2's move on an employer
 // date: print the thing rather than guess a window). `[assumption]` that a whole
 // shared word is the right adjacency test — it is a judgment, like the 0.64.
 for(const l of lanes){
  const laneTerm=laneWords(l).find(w=>titleWords.has(w));
  if(laneTerm)return band({points:ROLE_BANDS.adjacent,basis:'adjacent',lane:l,laneTerm,field:'title',lanes:lanes.length});
 }
 // `lanes` is what tells "no lane matched this title" from "she saved no lanes":
 // invariant (18) fails the band closed either way, and only the first of those
 // is a statement about the posting (invariant 27).
 return {points:ROLE_BANDS.unmatched,basis:'unmatched',lane:null,laneTerm:null,field:'title',lanes:lanes.length};
}

/**
 * PRD §9.4 invariant (27), added 2026-11-24 (B-30).
 *
 * A 0 is a claim, and several of these terms have a 0 that is not one. Four
 * runs gave four terms a zero that distinguishes a failure to observe from an
 * observation of absence — §9.6's `unmatched`, §9.5's `dateKind:'none'`, §8.4's
 * truncated description, §9.1's held gates — and every one of those is reached
 * by Hoshi having nothing on the POSTING's side. Her side was never specified,
 * so an empty profile printed "no saved project matches this posting" and "not
 * matched to your locations", which are comparisons that never ran stated as
 * their results. And the card then pooled every zero into one `0 a, b, c` chip,
 * so the three-state zeros the document had been careful to build were rendered
 * as absence on the one surface she reads.
 *
 * So a term's `claim` is DERIVED from the basis and the inputs it read
 * (invariant 13's shape), a `no-evidence` term names the absent input rather
 * than printing the negative, and no surface prints a bare `0` for one.
 */
const claimOf=(points,unevidenced)=>points>0?'scored':unevidenced?'no-evidence':'zero';
const UNCHECKED={eligibility:['eligible','ineligible'],authorization:['confirmed','not-sponsored']};
const FOLIO_MISSING={'no-input':'no saved projects','no-description':'no description stored',
 partial:'only part of the description stored'};
const LOC_MISSING={'no-input':'no locations saved','no-field':'this posting states no location'};
export const TERM_LINE_LABEL=Object.freeze({role:'role',eligibility:'eligibility',
 authorization:'work authorization',connection:'connection',freshness:'freshness',
 portfolio:'portfolio',location:'location'});
function evidencedTerms({role,roleFit,job,eligibility,authorization,tier,people,fresh,folio,loc}){
 const direct=role.basis==='lane',partial=role.basis==='adjacent';
 const t=(key,points,note,why,unevidenced,missing)=>{
  const claim=claimOf(points,!!unevidenced);
  return {key,points,note,why,claim,missing:claim==='no-evidence'?missing:null};
 };
 return [
  // Invariant (18): a nonzero band names the lane that earned it. `adjacent`
  // names the shared word too, because that word is the whole of its claim.
  t('role',roleFit,direct?role.lane:partial?role.lane+' · “'+role.laneTerm+'”':'no saved lane found in the title',
   direct?'matches your saved lane “'+role.lane+'”'
    :partial?'shares “'+role.laneTerm+'” with your saved lane “'+role.lane+'” — not the lane itself'
     :role.lanes?'no saved lane found in this title — not a judgment about the role'
      :'no role lanes saved, so no lane was looked for',
   role.basis==='unmatched'&&!role.lanes,'no role lanes saved'),
  t('eligibility',eligibility,job.eligibility||'unverified',job.eligibility||'not verified',
   !UNCHECKED.eligibility.includes(job.eligibility),'graduation eligibility not checked'),
  t('authorization',authorization,job.authorization||'unverified',job.authorization||'not verified',
   !UNCHECKED.authorization.includes(job.authorization),'sponsorship policy not checked'),
  // C0's line reads "nobody found at this company", which is false of a user
  // who has entered nobody anywhere — B-10's empty list is a no-claim state.
  // Invariant (28) on top of invariant (27): a C0 is three claims and not one.
  // She has nobody saved anywhere; or Hoshi holds a name it could not match to
  // this company; or the comparison ran against every saved name and nobody is
  // there. Only the third is a zero — the first two are withheld, and the
  // second names the two strings rather than the conclusion.
  t('connection',POINTS[tier.tier],tier.contact?.name||null,
   tier.tier!=='C0'||people.length?tier.reason:'no people saved yet, so no company was matched',
   tier.tier==='C0'&&(!people.length||!!tier.unresolved?.length),
   people.length?tier.unresolved.length+' saved name'+(tier.unresolved.length===1?'':'s')+' Hoshi could not match to this company':'no people saved'),
  t('freshness',fresh.points,fresh.basis==='none'?null:fresh.band,fresh.line,
   fresh.basis==='none','no posting date'),
  t('portfolio',folio.points,folio.project,folio.why,
   FOLIO_MISSING[folio.basis],FOLIO_MISSING[folio.basis]),
  t('location',loc.points,loc.points?'your locations':null,loc.why,
   LOC_MISSING[loc.basis],LOC_MISSING[loc.basis])
 ];
}
/**
 * The same array, as the lines §9.4 specifies. A no-evidence term is prefixed
 * `—` and never `+0`: a zero is a claim, and this term is not making one.
 */
export const termLines=terms=>terms.map(x=>
 (x.claim==='no-evidence'?'—':'+'+x.points)+' '+TERM_LINE_LABEL[x.key]+' · '+x.why);
/**
 * One split, derived from the array the card renders, so the withheld count can
 * never come from a different list than the chips (invariant 15's shape at the
 * card's grain).
 */
export function evidenceSplit(terms=[]){
 const by=c=>terms.filter(x=>x.claim===c);
 return {scored:by('scored').slice().sort((a,b)=>b.points-a.points),
  zeros:by('zero'),withheld:by('no-evidence'),
  unevidenced:by('no-evidence').length,
  missing:[...new Set(by('no-evidence').map(x=>x.missing).filter(Boolean))]};
}
export function scoreJob(job,profile,people=[],events=[],now=new Date()){
 // Derived from WEIGHTS, never hardcoded: a weight change must not leave a
 // literal behind. (It did, on the first pass: authorization kept scoring 5
 // after the table moved it to 20, and the ranked floor silently broke.)
 const role=roleBand(job,profile),direct=role.basis==='lane',partial=role.basis==='adjacent';
 const roleFit=role.points;
 const eligibility=job.eligibility==='eligible'?WEIGHTS.eligibility:0;
 const authorization=job.authorization==='confirmed'?WEIGHTS.authorization:0;
 const tier=tierFor(job.company,people,events,now);
 const fresh=freshness(job,now);
 const folio=portfolioMatch(job,profile);
 const loc=locationTerm(job,profile);
 const location=loc.points;
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
 const terms=evidencedTerms({role,roleFit,job,eligibility,authorization,tier,people,fresh,folio,loc});
 return {total,rankable,gate:gate.state,missingChecks:gate.missing,roleFit,
  // §9.6: the band and the lane that produced it, so a surface can say "no lane
  // matched this title" rather than implying the role is wrong.
  roleFitBasis:role.basis,roleLane:role.lane,roleLaneTerm:role.laneTerm,roleField:role.field,
  // Invariant (23): C1's construction rides the score, as §9.6's band does, so
  // the row that stores the tier and the rate that segments on it see which.
  tier:tier.tier,tierBasis:tier.basis,contact:tier.contact,promoted,qualified,
  // The version travels with the score, not with whoever writes the row: a
  // score and the table that produced it are one fact (PRD §10.5 invariant 14).
  weightsVersion:WEIGHTS_VERSION,
  // The ranked range is 40–100, not 0–100: state it so the number is readable.
  scale:rankable?{min:RANKED_FLOOR,max:100}:null,
  portfolioProject:folio.project,
  // Structured breakdown so a surface can show WHY without parsing prose.
  // The panel led with a score box and buried all of this behind a disclosure,
  // which made a scored job and an unscored one look identical.
  terms,
  reason:closed?'Listing closed — no longer accepting applications':gate.state==='excluded'?gate.why:gate.state==='held'?gate.why:roleFit<ROLE_FLOOR?'Below '+ROLE_FLOOR+'/'+WEIGHTS.role+' role-fit floor':!promoted?'Below priority threshold':'Qualified',
  // One array, two renderings: the chips and the evidence lines cannot disagree
  // about what a term claimed, and neither can the withheld count.
  lines:termLines(terms)};
}
// PRD §7.1's caps, in one place: the panel used to print "/ 3" as a literal
// beside a list this module sliced, which is invariant (13)'s least-derived
// consumer one surface over. `[assumption]` the 3 and the 5 specifically.
export const BRIEF_CAPS={conversations:3,promoted:5};
/**
 * Every conversation that qualifies this morning, ordered, and NOT capped —
 * §7.3's block states how many it did not show, so the cap cannot live in here
 * (invariant 21). `expires` marks a reason that is gone tomorrow rather than
 * waiting: a reply, a due follow-up and an open role at their company all
 * persist until she acts, while the cooling row is alive for exactly the last
 * COOLING_LEAD_DAYS mornings of §9.2's clock and is then spent for good
 * (invariant 19). So an expiring reason outranks a persistent one of lower
 * priority — the cooling row above "role at their company", which is the only
 * purely opportunistic type.
 */
export function conversationBrief(state,now=new Date()){
 const items=[];
 for(const p of state.people){
  const sends=state.events.filter(e=>e.kind==='outreach'&&e.contactId===p.id);
  const replies=state.events.filter(e=>e.kind==='reply'&&e.contactId===p.id);
  const lastSend=sends.at(-1),lastReply=replies.at(-1);
  const clock=decayClock(p.id,state.events,now);
  let why=null,priority=9,expires=false;
  // Invariant (24) on the brief: "reply waiting" claims a response is OWED, and
  // a decline owes none — three of them held block 1's top priority for ever
  // (C3 never decays) and dropped the one expiring row beneath them.
  const answer=latestAnswer(p.id,state.events);
  if(answer&&answer.step==='declined'){why=null;priority=9;}
  else if(lastReply&&(!lastSend||new Date(lastReply.at)>new Date(lastSend.at))){why='Reply waiting for your response';priority=0;}
  else if(lastSend&&!lastReply&&sends.length===1&&(now-new Date(lastSend.at))/86400000>=7){why='Follow-up due · 7+ days since your message';priority=1;}
  // §7.3's decaying row reads §9.2's clock rather than her last keystroke: before
  // invariant (19) this fired on the most recent send, so following up on day 20
  // moved the warning to day 38 and the tier never dropped. The window is the
  // last three days the claim is alive, measured on the earliest unanswered thread.
  else if(!clock.replied&&clock.first&&clock.days>=DECAY_DAYS-COOLING_LEAD_DAYS&&!clock.spent){
   why='Connection cooling · no reply since '+shortDate(clock.first.at);priority=2;expires=true;}
  // Invariant (28): this row took a CASE-SENSITIVE equality while the tier took
  // a case-folded one, so a contact could score C2 at a company and raise no
  // row for an open role there — the brief and the score disagreeing about
  // whether she knows anyone. One join, one answer.
  else if(!lastSend&&state.jobs.some(j=>companyMatch(j.company,p.currentEmployer||p.company).match&&j.listingState!=='closed')){why='Role at their company';priority=3;}
  if(why&&p.name&&p.origin)items.push({contact:p,why,priority,expires});
 }
 // Expiring first at equal priority, so the tiebreak never costs a claim either.
 return items.sort((a,b)=>a.priority-b.priority||(b.expires?1:0)-(a.expires?1:0));
}
/**
 * §7.3's block 1: the capped rows, plus the number the cap did not show and how
 * many of those expire today. Invariant (21): both counts come from the same
 * predicate that built the list (invariant 15's shape at the brief's grain), so
 * no figure here can describe a set it did not select.
 */
export function conversationsBlock(state,now=new Date()){
 const all=conversationBrief(state,now),cap=BRIEF_CAPS.conversations;
 const rows=all.slice(0,cap),dropped=all.slice(cap);
 return {rows,cap,qualified:all.length,notShown:dropped.length,
  expiringNotShown:dropped.filter(r=>r.expires).length};
}
export function morningBrief(state,now=new Date()){
 const block=conversationsBlock(state,now),conversations=block.rows;
 const ranked=state.jobs.map(job=>({job,score:scoreJob(job,state.profile,state.people,state.events,now)})).filter(x=>x.job.listingState!=='closed');
 const promoted=ranked.filter(x=>x.score.promoted).sort((a,b)=>b.score.total-a.score.total||POINTS[b.score.tier]-POINTS[a.score.tier]||a.job.company.localeCompare(b.job.company)).slice(0,BRIEF_CAPS.promoted);
 // §9.6: block 3 states how many open jobs left the ranked set because no saved
 // lane was found in the title, as a number (§10.3 rule 6's shape). A silent
 // exclusion only has to be countable — not listed, and never scored.
 return {conversations,promoted,alsoOpen:ranked.filter(x=>!x.score.promoted).length,
  // §7.3 invariant (21): block 2's overflow falls to block 3 and is counted
  // there; block 1's fell nowhere, so the fourth person due this morning was
  // dropped in silence while the header read "3 / 3".
  conversationsNotShown:block.notShown,conversationsExpiring:block.expiringNotShown,
  unmatchedTitles:ranked.filter(x=>x.score.roleFitBasis==='unmatched').length};
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
  contacts:(state.people||[]).filter(p=>companyMatch(job.company,p.currentEmployer||p.company).match).length,
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
 const p=typeof key==='string'?POPULATION[key]:key;
 if(!p?.label)throw Error('A rate needs a population that can name itself (invariant 15)');
 const own=rows.filter(p.of),k=own.filter(hit).length;
 return {...rate(k,own.length,'Of '+p.label),population:typeof key==='string'?key:p.label,k,n:own.length,skew};
}
// PRD §10.3 rule 12 and invariant (25), added 2026-11-20. Rules 8 to 11 and
// invariant (15) all govern the DENOMINATOR, because that is where the
// population lives — and the claim lives in the numerator, where no rule was
// pointed. `outcome.stage` has carried `rejected` since 2026-10-16 and nothing
// in §10 read it, so a hit test written as the inclusion list
// `['response','screen','interview']` dropped it into the negative branch by
// default: 40 matured submissions holding 18 rejections and 2 screens rendered
// `2 of 40 · 5%` under the label 'A response'. That is honesty rule 9's own
// sentence — absence of an outcome means not yet, not no — violated one half of
// the fraction along, and it discards exactly the rows that confirm a
// submission landed (§10.5).
//
// So a numerator is DERIVED from the enum it reads and has to partition it: a
// value is counted, or it is named as excluded, and there is no third option.
// A value added to the enum later then fails here rather than landing silently
// on the `no` side — which is what would have happened to `declined` on
// 2026-11-18 had reply rate been written as an inclusion list.
export function namedNumerator(values,{of,label,excludes={}}){
 const hit=values.filter(of),missed=values.filter(v=>!of(v));
 if(!hit.length)throw Error('A numerator that counts no value of the enum is not a numerator (invariant 25)');
 if(!label)throw Error('A rate needs a numerator that can name itself (invariant 25)');
 const unnamed=missed.filter(v=>!excludes[v]);
 if(unnamed.length)throw Error('invariant (25): '+unnamed.join(', ')+' would be counted as a no without being named');
 const spurious=Object.keys(excludes).filter(v=>!missed.includes(v));
 if(spurious.length)throw Error('invariant (25): '+spurious.join(', ')+' is named as excluded and is counted anyway');
 return Object.freeze({of,label,hit:Object.freeze(hit),missed:Object.freeze(missed),
  exclusion:missed.length?Object.freeze(missed.map(v=>excludes[v])).join('; '):null});
}
// The two quantities that were wearing one label. `answered` is the rate rules
// 9, 10 and 11 are written over; `advanced` is what the old inclusion list was
// actually computing, and it is the quantity §1's 40–65% names, so it is the one
// §10.2's by-tier set carries.
export const NUMERATORS=Object.freeze({
 answered:()=>namedNumerator(OUTCOME_STAGES,{of:()=>true,
  label:'Counting any answer from the employer, a rejection included — an outcome row is also the only thing that confirms the application landed.'}),
 advanced:()=>namedNumerator(OUTCOME_STAGES,{of:s=>s==='screen'||s==='interview',
  label:'Counting a screen or an interview.',
  excludes:{response:'a bare response is not an advance',rejected:'a rejection is an answer, not an advance'}}),
 anyReply:()=>namedNumerator(REPLY_STEPS,{of:()=>true,
  label:'Counting every answer, a decline included — this measures whether outreach gets answered, never whether it helped (§10.5).'})
});
export function outcomeJobs(events,key){
 const n=NUMERATORS[key]();
 return {numerator:n,jobs:new Set(events.filter(x=>x.kind==='outcome'&&n.of(x.stage)).map(x=>x.jobId))};
}
// PRD §10.2 and §10.4, added 2026-11-13 (B-27). A tier population is built from
// the same predicate that names it, so a tier label cannot describe a bucket it
// did not select — invariant (15) at the tier grain. Hoshi's arm only: her own
// entries carry no tier (invariant 9), so they are filtered out here rather
// than becoming a fifth untiered bucket.
export const TIERS=Object.freeze(['C3','C2','C1','C0']);
// Invariant (23) at the rate's grain: C1 is two constructions, so one C1 arm
// would pool "a path she never used" with "a path she used and nothing came
// back" — opposite evidence about the thesis under one label, which is rule 11's
// own prohibition one dimension over. The arms are DERIVED from the tiers and
// the bases, so a third construction would appear here without being listed.
export const TIER_ARMS=Object.freeze(TIERS.flatMap(t=>t==='C1'?C1_BASES.map(b=>'C1·'+b):[t]));
export function tierPopulation(arm){
 const [t,basis]=String(arm).split('·');
 if(t==='C1'&&!C1_BASES.includes(basis))throw Error('C1 names '+C1_BASES.length+' constructions; a tier population must name which (invariants 23, 24)');
 return Object.freeze({of:x=>x.source==='hoshi'&&(x.personAttached?.tier||'C0')===t
   &&(!basis||x.personAttached?.tierBasis===basis),
  label:t+' applications Hoshi filled'+(basis==='alum'?', where the person was an alum you had not saved'
   :basis==='spent'?', where you had messaged them and no reply came'
   :basis==='declined'?', where they answered and could not help':'')});
}
// The by-tier response rate IS displayable, and the figure §10.4 refused it
// with was the wrong one. 141 is the n for a 5% → 15% move; the gap §9.1's
// weight is sized against is §1's 40–65% against 2–8%, where two 95% intervals
// separate at 7–27 rows per arm at equal n and at 1–4 C3 rows against an
// abundant C0 arm. So rule 1's floor of 10 is what binds, and it is a display
// rule rather than a power calculation. What is unavailable is ATTRIBUTION: she
// chose which applications carried a person, so rule 3's disjointness test
// clears exactly when the thesis is being measured and licenses nothing causal.
// Invariant (20): no comparison is computed here, and the refusal is attached
// to the set rather than left to the copy.
export function byTier(rows,hit,skew,numerator){
 if(!numerator?.label)throw Error('A rate set needs a numerator that can name itself (invariant 25)');
 // A C1 row written before the basis existed cannot be put in either arm, and
 // the store is append-only, so that is permanent: it is stated as a number
 // (rule 6's shape) rather than pooled back into one C1 bucket.
 const unbased=rows.filter(x=>x.source==='hoshi'&&x.personAttached?.tier==='C1'
  &&!C1_BASES.includes(x.personAttached?.tierBasis)).length;
 return {metric:'A screen or an interview, by connection tier as recorded at submit',kind:'self-selected',
  pooled:null,comparison:null,numerator:numerator.label,numeratorExclusion:numerator.exclusion,
  excluded:unbased?unbased+(unbased===1?' C1 row carries':' C1 rows carry')+' no construction and '+(unbased===1?'is':'are')+' in neither C1 arm — written before Hoshi distinguished the two, and an append-only row cannot be reclassified.':null,
  attribution:'You chose which applications carried a person, so a gap between these tiers is a difference and never the effect of the connection. Only a cohort could separate the two (§10.4).',
  note:'Hoshi’s rows only — your own entries carry no tier (invariant 9), while a row for a job that was held carries one and no score (invariant 29). C1 is two arms, because an alum you never wrote to and a thread that went unanswered are not the same evidence.',
  segments:TIER_ARMS.map(a=>populationRate(tierPopulation(a),rows,hit,skew))};
}
// PRD §10.3 rule 11, amended 2026-11-06. Segmentation by `source` binds exactly
// two rates — person-attached, and response over `submission` rows — and neither
// may be shown pooled. Where an arm falls under rule 1's floor of 10 the
// fallback is rule 1's own: that arm shows its fraction, which is exact about
// what was recorded. It is never a pooled percentage with a caveat under it,
// because the caveat arrives after the number has been read.
function bySource(metric,rows,hit,skews,note,numerator){
 return {metric,kind:'segmented',pooled:null,note,
  // Rule 12: a rate over an enumerated value names its hit test beside the
  // population. A rate over a plain boolean (person attached, yes or no) reads
  // no enum, so there is nothing to partition and nothing to name.
  numerator:numerator?.label||null,numeratorExclusion:numerator?.exclusion||null,
  segments:[['hoshi',skews.hoshi],['user',skews.user]].map(([k,s])=>populationRate(k,rows,hit,s))};
}
export function activity(state,now=new Date()){
 const e=state.events,sub=e.filter(x=>x.kind==='submission'),out=e.filter(x=>x.kind==='outreach'&&x.step==='sent'),replies=e.filter(x=>x.kind==='reply');
 const responded=new Set(replies.map(x=>x.threadId));
 const matured=x=>(now-new Date(x.at))/86400000>=21;
 const mature=sub.filter(matured);
 // Rule 12: both hit tests are derived from the `outcome` enum and partition it,
 // so neither can quietly drop a value the way the old inclusion list dropped
 // `rejected`. Two numerators, two rates — the label was doing two jobs.
 const answered=outcomeJobs(e,'answered'),advanced=outcomeJobs(e,'advanced');
 const anyReply=NUMERATORS.anyReply();
 // §10.5: Activity segments by `weightsVersion` or states that it did not. It
 // states that it did not, and names how many tables the denominator spans,
 // which is the fact a reader needs. Pooling two scales widens a number; it
 // does not leave the direction unknown, which is why rule 11's harder fallback
 // is for `source` and not for this.
 const hoshiRows=sub.filter(x=>x.source==='hoshi');
 const tables=[...new Set(hoshiRows.map(x=>x.weightsVersion).filter(Boolean))];
 // Invariant (29): a held row has no score to name a table with, so the span is
 // over scored rows and the rest are STATED as a number rather than dropped by
 // a `.filter(Boolean)` nobody reads (rule 6's shape). They are in every other
 // Hoshi rate and in the by-tier set, because they carry a tier.
 const held=hoshiRows.filter(x=>x.totalScore==null);
 return {counts:{submissions:sub.length,withPerson:sub.filter(x=>x.personAttached?.contactId).length,
   outreach:out.length,replies:replies.length,interviews:e.filter(x=>x.kind==='outcome'&&x.stage==='interview').length},
  rates:[
   bySource('A person attached before you submitted',sub,x=>!!x.personAttached?.contactId,
    {hoshi:'Reads high: the applications you send around Hoshi are mostly the cold ones.',
     user:'Reads high: you remember the application you cared about, not the midnight one.'},
    'Your own rows belong in this denominator — having a person attached is a fact about your behaviour, not about Hoshi. They are not pooled with Hoshi’s, because the two arms are skewed by different things (rule 11).'),
   bySource('A response, 21+ days after submitting',mature,x=>answered.jobs.has(x.jobId),
    {hoshi:'Reads low: a row written at review for an application never sent can only ever look like a failure.',
     user:'Reads high: the same entry selection, on the other side of the funnel.'},
    'These two point in opposite directions, so a pooled percentage would have no direction left to state.',
    answered.numerator),
   bySource('A screen or an interview, 21+ days after submitting',mature,x=>advanced.jobs.has(x.jobId),
    {hoshi:'Reads low: for the same reason as the rate above, and most applications legitimately do not advance.',
     user:'Reads high: the same entry selection, on the other side of the funnel.'},
    'This is the quantity §1 compares across the referral and cold paths. It was the number the rate above was computing until 2026-11-20, under the other one’s name.',
    advanced.numerator),
   byTier(mature,x=>advanced.jobs.has(x.jobId),
    'Reads low: a row written at review for an application never sent can only ever look like a failure.',
    advanced.numerator),
   {metric:'A reply to outreach you sent',kind:'single',pooled:null,
    numerator:anyReply.label,numeratorExclusion:anyReply.exclusion,
    note:'One regime: every outreach and reply row is yours to assert, so there is nothing here to segment (rule 11).',
    segments:[populationRate('marked',out,x=>responded.has(x.threadId),
     'Upper bound: the denominator is the sends you remembered to mark.')]}],
  immature:{hoshi:sub.filter(x=>x.source==='hoshi'&&!matured(x)).length,
   user:sub.filter(x=>x.source==='user'&&!matured(x)).length},
  weightTables:tables,heldRows:held.length,
  heldChecks:[...new Set(held.flatMap(x=>x.heldFor||[]))],stageFor:id=>jobStage(e,id)};
}
