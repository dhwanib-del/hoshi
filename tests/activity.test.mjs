// PRD §10.3 rules 10 and 11, and invariant (15). Added 2026-11-06 (B-26).
//
// Activity built every rate over `events.filter(x => x.kind === 'submission')`
// — both `source` arms and every weight table in one denominator — and then
// labelled the result 'Of applications marked submitted in Hoshi'. So the one
// component whose job is to state its population stated the wrong one, in the
// component rule 10 exists for, and B-13's own rule says the population label
// outranks every number in the set.
//
// These tests assert the RELATIONS, in the 2026-11-04 shape: that a label comes
// from the filter that built the denominator, that no segmented rate is ever
// shown pooled, and that an arm under rule 1's floor falls back to rule 1's own
// fraction rather than to a pooled percentage with a caveat under it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { activity, populationRate, POPULATION, WEIGHTS_VERSION } from '../src/scoring.js';

const day = 86400000;
const now = new Date('2026-11-06T09:00:00Z');
const ago = d => new Date(now.getTime() - d * day).toISOString();

const hoshiRow = (id, { attached = false, days = 40, version = WEIGHTS_VERSION } = {}) => ({
  kind: 'submission', source: 'hoshi', jobId: id, at: ago(days),
  roleFit: 20, totalScore: 80, weightsVersion: version,
  personAttached: attached ? { contactId: 'c-' + id, tier: 'C2' } : null
});
const userRow = (id, { attached = false, days = 40 } = {}) => ({
  kind: 'submission', source: 'user', jobId: id, at: ago(days),
  recordedAt: ago(1), personAttached: attached ? { contactId: 'c-' + id } : null
});
const state = events => ({ events });

test('invariant (15): the label is derived from the denominator it describes', () => {
  const a = activity(state([
    hoshiRow('h1', { attached: true }), hoshiRow('h2'),
    userRow('u1'), userRow('u2'), userRow('u3')
  ]), now);
  const [hoshi, user] = a.rates[0].segments;
  assert.equal(hoshi.label, 'Of applications Hoshi filled');
  assert.equal(user.label, 'Of applications you entered yourself');
  // The denominators are the filters, not the pool: 2 and 3, never 5.
  assert.equal(hoshi.n, 2);
  assert.equal(user.n, 3);
  assert.ok(!a.rates[0].segments.some(s => s.n === 5), 'no segment holds both arms');
  // And the label cannot name Hoshi over rows Hoshi never filled.
  assert.equal(user.k, 0, 'the attached row is in the Hoshi arm, where it was recorded');
  assert.equal(hoshi.k, 1);
});

test('invariant (15): a population that cannot name itself is refused, not labelled', () => {
  assert.throws(() => populationRate('made-up', [], () => true, 'x'), /name itself/);
  for (const [key, p] of Object.entries(POPULATION)) {
    assert.ok(p.label && typeof p.of === 'function', key + ' carries both a test and a label');
  }
});

test('rule 11: a segmented rate is never shown pooled', () => {
  const a = activity(state([hoshiRow('h1', { attached: true }), userRow('u1')]), now);
  for (const r of a.rates) assert.equal(r.pooled, null, r.metric + ' has no pooled percentage');
  // Found by metric rather than by position: 2026-11-13 added the by-tier set
  // between the response rate and the reply rate, and a positional assertion
  // would have read as a rule-11 failure.
  const by = m => a.rates.find(r => r.metric === m);
  assert.equal(by('A person attached before you submitted').kind, 'segmented');
  assert.equal(by('A response, 21+ days after submitting').kind, 'segmented');
  // Reply rate is one regime: outreach and reply rows carry no `source`
  // discriminator, because every one of them is hers to assert.
  const reply = by('A reply to outreach you sent');
  assert.equal(reply.kind, 'single');
  assert.equal(reply.segments.length, 1);
});

test('rule 11 falls back to rule 1, not to a pooled percentage with a caveat', () => {
  const events = [];
  for (let i = 0; i < 12; i++) events.push(hoshiRow('h' + i, { attached: i < 4 }));
  for (let i = 0; i < 3; i++) events.push(userRow('u' + i));
  const [hoshi, user] = activity(state(events), now).rates[0].segments;
  assert.equal(hoshi.visible, true);
  assert.match(hoshi.summary, /%.*\(.*–.*\)/, 'an arm over the floor still gets its interval');
  assert.equal(user.visible, false);
  assert.match(user.summary, /0 of 3/, 'an arm under the floor shows the fraction');
  assert.match(user.summary, /7 more/, 'and states the shortfall as a number (rule 6)');
});

test('the smaller arm is what gates a percentage, and that is why the escape hatch was the default', () => {
  // PRD §10.3 rule 11's arithmetic, asserted rather than quoted. Both arms clear
  // rule 1's floor of 10 only once the SMALLER arm reaches 10, so the pooled
  // volume needed is 10 / (hand-entry share).
  const bothClear = (n, share) => Math.floor(n * share) >= 10 && Math.round(n * (1 - share)) >= 10;
  assert.equal([...Array(400).keys()].find(n => bothClear(n, 0.25)), 40);
  assert.equal([...Array(400).keys()].find(n => bothClear(n, 0.10)), 100);
  assert.ok(!bothClear(30, 0.25), 'thirty submissions at a one-in-four share is not enough');
});

test('rule 10: the skew direction belongs to the segment, not to the rate', () => {
  const a = activity(state([hoshiRow('h1'), userRow('u1')]), now);
  const [attachedRate, responseRate] = a.rates;
  // Both arms of person-attached read high, for different reasons.
  for (const s of attachedRate.segments) assert.match(s.skew, /reads high/i);
  // The response rate's two arms point opposite ways, which is the whole reason
  // a pooled number would have no direction left to state.
  assert.match(responseRate.segments[0].skew, /reads low/i);
  assert.match(responseRate.segments[1].skew, /reads high/i);
  for (const r of a.rates) for (const s of r.segments) assert.ok(s.skew, r.metric + ' states a direction');
});

test('§10.5: Activity says how many weight tables the Hoshi arm spans', () => {
  const one = activity(state([hoshiRow('h1'), userRow('u1')]), now);
  assert.deepEqual(one.weightTables, [WEIGHTS_VERSION]);
  const two = activity(state([hoshiRow('h1'), hoshiRow('h2', { version: 'rol30-con20' })]), now);
  assert.equal(two.weightTables.length, 2, 'two tables in one denominator is a fact it must carry');
  // A user row carries no version and cannot add one (invariant 9).
  assert.deepEqual(activity(state([userRow('u1')]), now).weightTables, []);
});

test('rule 9: the maturation exclusion is counted per arm, not once for the pool', () => {
  const a = activity(state([
    hoshiRow('h1', { days: 40 }), hoshiRow('h2', { days: 2 }),
    userRow('u1', { days: 1 }), userRow('u2', { days: 3 })
  ]), now);
  assert.deepEqual(a.immature, { hoshi: 1, user: 2 });
  // The response rate runs over matured rows only, per arm.
  const [hoshi, user] = a.rates[1].segments;
  assert.equal(hoshi.n, 1);
  assert.equal(user.n, 0);
});
