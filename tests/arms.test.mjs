// PRD §10.5 invariant (29), added 2026-11-27. `source` is COVERAGE — who filled
// the application — and never whether a score existed. Invariant (12) (11-03)
// created a third case the two arms had no shape for: Hoshi filled and reviewed
// an application whose gate it could not establish, so there was no score to
// copy in — and with no source for the sponsorship gate (invariant 26) that is
// EVERY job. The write path resolved it on the only axis it had, `score.rankable`,
// and wrote her arm: a held application landed under "applications you entered
// yourself", its C2 contact unattached, the by-tier table empty on every arm and
// the weight-table span empty.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stateFrom,addJob,mayMarkApplied,markOutcome} from '../src/model.js';
import {scoreJob,activity} from '../src/scoring.js';

const profile={roleLanes:['ux researcher'],locations:['US'],priorityThreshold:70,
 projects:[{name:'Atlas',tags:['design systems']}]};
const people=[{id:'p1',name:'Priya Raman',company:'Example',rankSource:'manual',
 origin:{how:'manual',at:'2026-10-01'},employerAsOf:'2026-10-01'}];
const posting={title:'UX Researcher',company:'Example',location:'US',
 applyUrl:'https://jobs.lever.co/example/abc',origin:'page',
 descriptionText:'design systems research',descriptionSourceChars:30,
 eligibility:'eligible',dateKind:'posted'};

function held(){
 let s={...stateFrom(),profile,people};
 s=addJob(s,{...posting,authorization:'unverified',datePosted:new Date().toISOString()});
 const score=scoreJob(s.jobs[0],s.profile,s.people,s.events);
 assert.equal(score.rankable,false,'an unverified gate is held (invariant 12)');
 assert.equal(score.total,null);
 assert.equal(score.tier,'C2','the tier is nameable whatever the gates say');
 return {s,score};
}

test('a held application Hoshi filled is Hoshi’s row, with the tier and no score',()=>{
 const {s,score}=held();
 const after=mayMarkApplied(s,s.jobs[0].id,{confirm:true,source:'hoshi',score});
 const row=after.events.at(-1);
 assert.equal(row.source,'hoshi','the arm is coverage, not whether a score existed');
 assert.equal(row.totalScore,undefined,'invariant 12 refuses a total');
 assert.equal(row.weightsVersion,undefined,'and the table that produced no score');
 assert.deepEqual([...row.heldFor],['sponsorship policy'],'the row names what was unestablished');
 assert.equal(row.recordedAt,undefined,'it was written inside the flow, not asserted about the past');
 assert.equal(row.personAttached.tier,'C2');
 assert.equal(row.personAttached.contactId,'p1','§5.2 counts a person attached before submit');
});

test('a held row with no named check is refused rather than written scoreless',()=>{
 const {s,score}=held();
 assert.throws(()=>mayMarkApplied(s,s.jobs[0].id,{confirm:true,source:'hoshi',
  score:{...score,missingChecks:[]}}),/invariant 29/,
  'fail closed means writing nothing, not a row whose silence has to be guessed at');
 assert.throws(()=>mayMarkApplied(s,s.jobs[0].id,{confirm:true,source:'hoshi',
  score:{...score,total:null,tier:'C1',tierBasis:null}}),/construction/,
  'invariant 23 binds the held arm too');
});

test('no fill flow inside Hoshi writes the user arm',()=>{
 const bg=readFileSync(new URL('../src/background.js',import.meta.url),'utf8');
 const mark=bg.slice(bg.indexOf("case 'MARK_SUBMITTED'"),bg.indexOf("case 'OUTCOME'"))
  .split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n');
 assert.ok(!/source:\s*'user'/.test(mark),'MARK_SUBMITTED must not write her arm for a job Hoshi filled');
 assert.ok(!/rankable\s*\n?\s*\?/.test(mark)&&!/score\.rankable/.test(mark),
  'and must not pick the arm on the score axis (invariant 29)');
});

test('the held rows are in every Hoshi rate, out of the weight-table span, and counted',()=>{
 const {s,score}=held();
 let after=mayMarkApplied(s,s.jobs[0].id,{confirm:true,source:'hoshi',score});
 after=markOutcome(after,s.jobs[0].id,'rejected');
 after={...after,events:after.events.map(x=>x.kind==='submission'
  ?{...x,at:new Date(Date.now()-30*86400000).toISOString()}:x)};
 const a=activity(after);
 assert.equal(a.counts.withPerson,1,'the headline count sees the person');
 const person=a.rates.find(r=>r.metric.startsWith('A person attached'));
 const hoshiArm=person.segments.find(x=>x.population==='hoshi');
 assert.equal(hoshiArm.n,1,'the row is in the population whose label names Hoshi');
 assert.equal(person.segments.find(x=>x.population==='user').n,0,'and not in hers');
 const tiers=a.rates.find(r=>r.kind==='self-selected');
 assert.equal(tiers.segments.find(x=>x.population.startsWith('C2')).n,1,
  'the by-tier set is not empty on day one');
 assert.deepEqual(a.weightTables,[],'a held row names no weight table');
 assert.equal(a.heldRows,1,'so the shortfall is stated as a number, not dropped silently');
 assert.deepEqual(a.heldChecks,['sponsorship policy']);
});

test('a row she asserts about an application Hoshi did not fill is still her arm',()=>{
 let s={...stateFrom(),profile,people};
 s=addJob(s,{...posting,authorization:'confirmed'});
 s=mayMarkApplied(s,s.jobs[0].id,{confirm:true,source:'user',at:'2026-10-01T00:00:00.000Z',contactId:'p1'});
 const row=s.events.at(-1);
 assert.equal(row.source,'user');
 assert.ok(row.recordedAt&&row.at==='2026-10-01T00:00:00.000Z','`at` is hers, `recordedAt` is the write');
 assert.equal(row.totalScore,undefined);
 assert.equal(row.heldFor,undefined,'invariant 9: her row carries no Hoshi field at all');
 assert.equal(row.personAttached.tier,undefined,'and no tier');
});
