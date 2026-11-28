// PRD §9.2 invariant (23), added 2026-11-17 (B-28).
//
// C1's table row has said "a ranked alum at the company, from your own list,
// whom she has not saved — one source only" since 2026-10-20, and two invariants
// enforce exactly that construction: (5) a resolvable alum record whose `origin`
// resolves with it, (10) a non-null `employerAsOf`. But §9.2's decay rule has
// sent a *C2* to C1 since 2026-09-29, and a C2 may be a hand-typed contact with
// no alum record at all — so decay produced a tier whose own invariants refuse
// to construct it, and invariant (19) made that permanent rather than transient.
//
// Both routes are C1 because both are the same claim about today. What differs
// is the evidence, and therefore what the line can honestly print — which is
// why the basis is derived and travels with the tier instead of the tier
// standing for both.
import test from 'node:test';
import assert from 'node:assert/strict';
import {tierFor,scoreJob,POINTS,C1_BASES,TIER_ARMS,tierPopulation,byTier,WEIGHTS_VERSION,NUMERATORS} from '../src/scoring.js';
import {mayMarkApplied,stateFrom} from '../src/model.js';

const NOW=new Date('2026-11-17T09:00:00Z');
const ago=n=>new Date(NOW.getTime()-n*86400000).toISOString();
// (a) the construction the invariants were written for.
const alum={id:'p1',name:'Dana Patel',currentEmployer:'Northline',rankSource:'alumni',saved:false,
 origin:'user-imported CareerLink CSV',employerCheck:'Verified current',employerAsOf:'2025-03-01',
 sharedContext:"UMSI '20"};
// (b) the construction decay produces: saved, hand-typed, no alum record.
const recruiter={id:'p2',name:'Marcus Lee',currentEmployer:'Southbank',rankSource:'manual',saved:true,
 origin:'typed by you',employerAsOf:null};
const sent=(id,n)=>({kind:'outreach',threadId:'t-'+id+n,contactId:id,step:'sent',at:ago(n),channel:'email'});

test('invariant 23: both constructions are C1, and each names its own evidence',()=>{
 const a=tierFor('Northline',[alum],[],NOW);
 const b=tierFor('Southbank',[recruiter],[sent('p2',40)],NOW);
 assert.equal(a.tier,'C1');assert.equal(a.basis,'alum');
 assert.equal(b.tier,'C1');assert.equal(b.basis,'spent');
 // The same points, because it is the same claim about what she can do today.
 // A fall to C0 would cost a decayed contact every point for one unanswered
 // message, and C0 reads "nobody found at this company", which is false of
 // someone she wrote to.
 assert.equal(POINTS[a.tier],POINTS[b.tier]);
 assert.ok(POINTS.C2>POINTS.C1&&POINTS.C1>POINTS.C0);
 // Neither line may be printable for the other's reason.
 assert.match(a.reason,/alumni list, not saved/);
 assert.match(a.reason,/employer last confirmed/,'invariant 10 prints the date rather than implying it is current');
 assert.match(b.reason,/no reply since/);
 assert.doesNotMatch(b.reason,/alumni list/);
});

test('invariant 23: invariants 5 and 10 bind the alum construction only',()=>{
 // Undated, and the record is all Hoshi has: unconstructible, not scored low,
 // and nothing upgrades on failure.
 const undated={...alum,employerAsOf:null};
 assert.equal(tierFor('Northline',[undated],[],NOW).tier,'C0');
 const unprovenanced={...alum,origin:''};
 assert.equal(tierFor('Northline',[unprovenanced],[],NOW).tier,'C0');
 // The spent construction owes neither: its evidence is the thread, and the
 // employer is a fact she asserted herself by saving the contact.
 assert.equal(tierFor('Southbank',[recruiter],[sent('p2',40)],NOW).basis,'spent');
 // And it is not a way around invariant 5 either — with no thread there is no
 // spent claim, so a thin record earns nothing.
 assert.equal(tierFor('Southbank',[{...recruiter,saved:false}],[],NOW).tier,'C2');
});

test('invariant 23: the construction is written with the row, or the row is refused',()=>{
 const job={id:'j1',company:'Southbank',title:'UX Researcher',location:'Remote',eligibility:'eligible',
  authorization:'confirmed',listingState:'live',descriptionText:'ux research',descriptionSourceChars:11,
  publishedAt:ago(1),provider:'lever'};
 const profile={roleLanes:['ux researcher'],locations:['Remote'],portfolioProjects:[]};
 const score=scoreJob(job,profile,[recruiter],[sent('p2',40)],NOW);
 assert.equal(score.tier,'C1');assert.equal(score.tierBasis,'spent');
 const state=stateFrom({jobs:[job],profile,events:[]});
 const after=mayMarkApplied(state,'j1',{confirm:true,score});
 assert.equal(after.events[0].personAttached.tierBasis,'spent');
 // Append-only: a C1 row with no construction can never be reclassified, so it
 // is refused at the write rather than stamped with a likely one (invariant 14's
 // shape, one field over).
 assert.throws(()=>mayMarkApplied(state,'j1',{confirm:true,score:{...score,tierBasis:null}}),
  /construction that produced the tier/);
});

test('invariant 23: a tier-segmented rate does not pool the two constructions',()=>{
 assert.deepEqual(TIER_ARMS,['C3','C2',...C1_BASES.map(b=>'C1·'+b),'C0']);
 assert.throws(()=>tierPopulation('C1'),/must name which/,'a tier value is not a population');
 for(const b of C1_BASES)assert.ok(tierPopulation('C1·'+b).label.includes('C1 applications Hoshi filled, where'));
 const row=(id,tier,basis)=>({kind:'submission',source:'hoshi',jobId:id,at:ago(40),
  roleFit:20,totalScore:80,weightsVersion:WEIGHTS_VERSION,
  personAttached:{contactId:'c-'+id,tier,...(basis?{tierBasis:basis}:{})}});
 const set=byTier([row('a','C1','alum'),row('b','C1','spent'),row('c','C1','spent'),row('d','C1')],
  x=>x.jobId==='b',' ',NUMERATORS.advanced(),()=>false);
 const n=Object.fromEntries(set.segments.map(s=>[s.population,s.n]));
 assert.equal(n['C1 applications Hoshi filled, where the person was an alum you had not saved'],1);
 assert.equal(n['C1 applications Hoshi filled, where you had messaged them and no reply came'],2);
 // The pre-basis row is stated, never redistributed and never pooled back.
 assert.equal(set.segments.reduce((t,s)=>t+s.n,0),3);
 assert.match(set.excluded,/1 C1 row carries no construction/);
 assert.equal(set.comparison,null);
});
