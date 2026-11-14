// PRD §10.2, §10.3 rule 3 and §10.4, with invariant (20). Added 2026-11-13 (B-27).
//
// §10.2 enumerated a response rate *by connection tier* while honesty rules 9
// and 10 were written over an *un-tiered* one that the enumeration never named
// — so the rate the rules govern had no entry and the rate with an entry was
// governed by nothing. Both are real, and both are now named.
//
// The arithmetic is why the by-tier set is displayable at all. §10.4 refused it
// against §10.1's 141, which is the n for a 5% → 15% move; the gap §9.1's
// weight is sized against is §1's 40–65% against 2–8%, where two 95% Wilson
// intervals separate at 7–27 rows per arm at equal n, and at 1–4 C3 rows
// against an abundant C0 arm. Rule 1's floor of 10 is therefore what binds, and
// it is a display rule and not a power calculation.
//
// Which means rule 3's guard — no comparative language unless the intervals are
// disjoint — clears *early*, exactly when the thesis is being measured. These
// tests assert what rule 3 cannot: that a disjoint pair still licenses no
// attribution, because the buckets are self-selected rather than assigned.
import test from 'node:test';
import assert from 'node:assert/strict';
import { activity, byTier, tierPopulation, TIERS, WEIGHTS_VERSION } from '../src/scoring.js';

const day = 86400000;
const now = new Date('2026-11-13T09:00:00Z');
const ago = d => new Date(now.getTime() - d * day).toISOString();

const row = (id, tier, { source = 'hoshi', days = 40 } = {}) => ({
  kind: 'submission', source, jobId: id, at: ago(days),
  ...(source === 'hoshi'
    ? { roleFit: 20, totalScore: 80, weightsVersion: WEIGHTS_VERSION }
    : { recordedAt: ago(1) }),
  personAttached: tier ? { contactId: 'c-' + id, ...(source === 'hoshi' ? { tier } : {}) } : null
});
const responded = id => ({ kind: 'outcome', jobId: id, source: 'user', stage: 'response' });
const tiered = a => a.rates.find(r => r.kind === 'self-selected');

test('invariant (9): a tier bucket never holds a row she entered herself', () => {
  const set = byTier([
    row('h1', 'C3'), row('h2', 'C0'),
    row('u1', 'C3', { source: 'user' }), row('u2', null, { source: 'user' })
  ], () => false, 'skew');
  const n = Object.fromEntries(set.segments.map(s => [s.label, s.n]));
  assert.equal(n['Of C3 applications Hoshi filled'], 1);
  assert.equal(n['Of C0 applications Hoshi filled'], 1);
  assert.equal(set.segments.reduce((t, s) => t + s.n, 0), 2);
});

test('invariant (15) at the tier grain: each label names the bucket its own filter selected', () => {
  const rows = [row('a', 'C2'), row('b', 'C2'), row('c', 'C1')];
  for (const t of TIERS) {
    const p = tierPopulation(t);
    assert.equal(p.label, t + ' applications Hoshi filled');
    const seg = byTier(rows, () => false, 'skew').segments.find(s => s.label === 'Of ' + p.label);
    assert.equal(seg.n, rows.filter(p.of).length);
  }
});

test('invariant (20): disjoint intervals still license no attribution', () => {
  // C3 at 8/12 and C0 at 4/150 is the cheap corner §10.4 had refused as
  // unreachable: the two 95% intervals are disjoint at this volume.
  const rows = [];
  for (let i = 0; i < 12; i++) rows.push(row('c3-' + i, 'C3'));
  for (let i = 0; i < 150; i++) rows.push(row('c0-' + i, 'C0'));
  const hits = new Set([...Array(8).keys()].map(i => 'c3-' + i)
    .concat([...Array(4).keys()].map(i => 'c0-' + i)));
  const set = byTier(rows, x => hits.has(x.jobId), 'skew');
  const c3 = set.segments.find(s => s.label.startsWith('Of C3'));
  const c0 = set.segments.find(s => s.label.startsWith('Of C0'));
  assert.ok(c3.visible && c0.visible, 'both arms clear rule 1’s floor at this volume');
  assert.ok(c3.k / c3.n > c0.k / c0.n, 'the gap is real in the recorded data');
  assert.equal(set.comparison, null, 'no comparison is computed');
  assert.match(set.attribution, /difference and never the effect/);
  for (const s of set.segments) {
    assert.ok(!/because|caused|thanks to|proves/i.test(s.summary + s.label));
  }
});

test('rule 1 is what binds a tier arm, and its fallback is a fraction', () => {
  const rows = [row('x', 'C3'), row('y', 'C3'), row('z', 'C3')];
  const c3 = byTier(rows, () => true, 'skew').segments.find(s => s.label.startsWith('Of C3'));
  assert.equal(c3.visible, false);
  assert.match(c3.summary, /3 of 3/);
  assert.match(c3.summary, /7 more/);
});

test('§10.2 names four rates: the un-tiered response rate and the by-tier one both appear', () => {
  const a = activity({ events: [row('h1', 'C3'), responded('h1')] }, now);
  const metrics = a.rates.map(r => r.metric);
  assert.ok(metrics.includes('A response, 21+ days after submitting'),
    'the rate rules 9, 10 and 11 are written over');
  assert.ok(metrics.includes('A response, by connection tier as recorded at submit'),
    'the rate §10.2 enumerated');
  assert.equal(a.rates.filter(r => r.attribution).length, 1,
    'only the self-selected set carries the attribution refusal');
});
