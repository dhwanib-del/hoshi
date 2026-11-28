// PRD §10.3 rule 12 and invariant (25). Added 2026-11-20.
//
// Honesty rules 8 to 11 and invariant (15) all govern the DENOMINATOR, because
// that is where the population lives. The claim lives in the numerator, and no
// rule was pointed there — so `outcome.stage`'s `rejected`, carried since
// 2026-10-16 and read by nothing, fell into the negative branch of a hit test
// written as the inclusion list `['response','screen','interview']`, and the
// rate labelled 'A response' counted the employer's own answer as silence.
//
// These tests assert the RELATIONS, in the 2026-11-04 shape: that a numerator
// partitions the enum it reads, that an unnamed value is a failure rather than a
// `no`, and that each rate names its hit test beside the population it names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { activity, namedNumerator, NUMERATORS, byTier, WEIGHTS_VERSION } from '../src/scoring.js';
import { OUTCOME_STAGES, REPLY_STEPS } from '../src/model.js';

const day = 86400000;
const now = new Date('2026-11-20T09:00:00Z');
const ago = d => new Date(now.getTime() - d * day).toISOString();
const sub = id => ({
  kind: 'submission', source: 'hoshi', jobId: id, at: ago(40),
  roleFit: 20, totalScore: 80, weightsVersion: WEIGHTS_VERSION, personAttached: null
});
const outcome = (id, stage) => ({ kind: 'outcome', jobId: id, source: 'user', stage, at: ago(20) });
const named = metric => a => a.rates.find(r => r.metric === metric);
const responseRate = named('A response, 21+ days after submitting');
const advanceRate = named('A screen or an interview, 21+ days after submitting');

// A season of 40 matured applications: 18 answered with a rejection, 2 reached a
// screen, 20 silent. Before today the single rate read `2 of 40 · 5%` with 18
// rows in the log saying the employer had replied.
const season = () => {
  const e = [];
  for (let i = 0; i < 40; i++) e.push(sub('j' + i));
  for (let i = 0; i < 18; i++) e.push(outcome('j' + i, 'rejected'));
  for (let i = 18; i < 20; i++) e.push(outcome('j' + i, 'screen'));
  return { events: e };
};

test('rule 12: a rejection is the employer answering, and the response rate counts it', () => {
  const hoshi = responseRate(activity(season(), now)).segments[0];
  assert.equal(hoshi.n, 40);
  assert.equal(hoshi.k, 20, '18 rejections plus 2 screens — every outcome row is an answer');
  // The 20 silent rows are the only ones rule 10's lower bound is about.
  assert.equal(hoshi.n - hoshi.k, 20);
});

test('rule 12: the advance rate is the other quantity, and it names what it leaves out', () => {
  const a = activity(season(), now);
  const hoshi = advanceRate(a).segments[0];
  assert.equal(hoshi.k, 2, 'only a screen or an interview is an advance');
  assert.equal(hoshi.n, 40, 'same denominator as the response rate');
  assert.match(advanceRate(a).numeratorExclusion, /rejection is an answer, not an advance/);
  assert.match(advanceRate(a).numeratorExclusion, /bare response is not an advance/);
  // And the rate that counts everything has nothing to exclude.
  assert.equal(responseRate(a).numeratorExclusion, null);
});

test('rule 12: every rate that reads an enum names its hit test on the surface', () => {
  const a = activity(season(), now);
  for (const metric of ['A response, 21+ days after submitting',
    'A screen or an interview, 21+ days after submitting',
    'A screen or an interview, by connection tier as recorded at submit',
    'A reply to outreach you sent']) {
    const r = a.rates.find(x => x.metric === metric);
    assert.ok(r, metric + ' is rendered');
    assert.ok(r.numerator && r.numerator.length > 10, metric + ' names what counts as a hit');
  }
  // Person-attached reads a boolean, not an enum: there is nothing to partition.
  assert.equal(a.rates.find(r => /person attached/i.test(r.metric)).numerator, null);
});

test('invariant (25): a value the numerator does not count has to be named', () => {
  assert.throws(() => namedNumerator(OUTCOME_STAGES, {
    of: s => s === 'screen' || s === 'interview', label: 'Counting an advance.'
  }), /would be counted as a no without being named/);
  // Naming them both is what makes it legal.
  assert.ok(namedNumerator(OUTCOME_STAGES, {
    of: s => s === 'screen' || s === 'interview', label: 'Counting an advance.',
    excludes: { response: 'not an advance', rejected: 'not an advance' }
  }).label);
});

test('invariant (25): a value added to the enum fails here rather than landing on the no side', () => {
  // This is `declined` arriving in REPLY_STEPS on 2026-11-18, replayed one enum
  // over: an existing numerator that does not mention the new value breaks.
  const withOffer = Object.freeze([...OUTCOME_STAGES, 'offer']);
  assert.throws(() => namedNumerator(withOffer, {
    of: s => s === 'screen' || s === 'interview', label: 'Counting an advance.',
    excludes: { response: 'not an advance', rejected: 'not an advance' }
  }), /offer would be counted as a no/);
});

test('invariant (25): an exclusion must name a value the numerator really drops', () => {
  assert.throws(() => namedNumerator(OUTCOME_STAGES, {
    of: () => true, label: 'Counting everything.', excludes: { rejected: 'dropped' }
  }), /named as excluded and is counted anyway/);
  assert.throws(() => namedNumerator(OUTCOME_STAGES, { of: () => false, label: 'Nothing.' }),
    /counts no value of the enum/);
  assert.throws(() => namedNumerator(OUTCOME_STAGES, { of: () => true }),
    /numerator that can name itself/);
});

test('invariant (25): a rate set cannot be built without a numerator that names itself', () => {
  const rows = [{ ...sub('a'), personAttached: { contactId: 'c', tier: 'C3' } }];
  assert.throws(() => byTier(rows, () => true, 'skew'), /numerator that can name itself/);
  assert.ok(byTier(rows, () => true, 'skew', NUMERATORS.advanced(), () => false).numerator);
});

test('rule 12: reply rate counts a decline on purpose, and says so', () => {
  const n = NUMERATORS.anyReply();
  assert.deepEqual([...n.hit].sort(), [...REPLY_STEPS].sort(), 'every answer counts');
  assert.equal(n.exclusion, null);
  assert.match(n.label, /decline included/);
});
