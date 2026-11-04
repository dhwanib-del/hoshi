// PRD §9.1 invariant (13): every term's points are a share of the weight table,
// never a literal. These tests assert the RELATIONS, not the numbers the table
// currently produces — so moving a weight is a one-line change, and a term that
// does not follow the table fails here instead of surviving in a comment or in
// a paragraph of the PRD.
//
// Written 2026-11-04, after the first weight change since 2026-09-29 left four
// figures behind in the spec. One of them was load-bearing: a freshness term
// that could award at most 5 of its 10 points makes the soft block 15, and
// §9.3 invariant 2's second clause then reads `15 < 15` rather than `15 < 20`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEIGHTS, POINTS, GATE_POINTS, RANKED_FLOOR, ROLE_FLOOR, ROLE_FLOOR_SHARE, SOFT_BLOCK
} from '../src/scoring.js';
import { freshnessScore, POOL_SHARE, MODIFIED_CAP_SHARE } from '../src/freshness.js';

const hoursAgo = (h, now) => new Date(now.getTime() - h * 3600000).toISOString();
const NOW = new Date('2026-11-04T09:00:00.000Z');

test('the weight table sums to 100', () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

test('connection tiers are shares of the connection weight, ordered', () => {
  // C3 is the whole term: the top tier is what the table pays for connection.
  assert.equal(POINTS.C3, WEIGHTS.connection);
  assert.equal(POINTS.C0, 0);
  assert.ok(POINTS.C3 > POINTS.C2 && POINTS.C2 > POINTS.C1 && POINTS.C1 > POINTS.C0,
    'tier ordering C3 > C2 > C1 > C0');
});

test('the gate constant and the ranked floor are derived, not written down', () => {
  assert.equal(GATE_POINTS, WEIGHTS.eligibility + WEIGHTS.authorization);
  assert.equal(ROLE_FLOOR, Math.round(ROLE_FLOOR_SHARE * WEIGHTS.role));
  assert.equal(RANKED_FLOOR, GATE_POINTS + ROLE_FLOOR);
  // The scale a threshold is a number on (PRD §9.1, B-15).
  assert.ok(RANKED_FLOOR > 0 && RANKED_FLOOR < 100);
});

test('PRD §9.3 invariant 2, both clauses, against the live table', () => {
  assert.ok(POINTS.C3 < WEIGHTS.role,
    'a clearly better-fitting job still beats a worse one with a friend attached');
  assert.equal(SOFT_BLOCK, WEIGHTS.freshness + WEIGHTS.portfolio + WEIGHTS.location);
  // Stated as the relation the PRD asserts. Under the 2026-11-03 table this is
  // 15 < 20; the document says so, and says the fix for either direction is a
  // weight change and therefore Dhwani's.
  assert.ok(POINTS.C3 < SOFT_BLOCK,
    'connection is not decisive on points alone; §7.2 tiebreak is where the tier still is');
});

test('the top pool band pays the whole freshness weight, at any weight', () => {
  const job = { timestamps: { publishedAt: hoursAgo(12, NOW) } };
  assert.equal(freshnessScore(job, { max: WEIGHTS.freshness, now: NOW }).points, WEIGHTS.freshness);
  assert.equal(POOL_SHARE.fresh, 1);
});

test('the pool bands follow the weight rather than a literal', () => {
  const at = h => ({ timestamps: { publishedAt: hoursAgo(h, NOW) } });
  const bands = max => [24, 72, 168, 400].map(h => freshnessScore(at(h), { max, now: NOW }).points);
  // The same shares at three different weights. If a future table moves
  // freshness, these are the numbers that move with it.
  assert.deepEqual(bands(5), [5, 3, 1, 0]);
  assert.deepEqual(bands(10), [10, 6, 2, 0]);
  assert.deepEqual(bands(15), [15, 9, 3, 0]);
});

test('invariant (4): an edit date caps at 0.6 of the term, never the top band', () => {
  const edited = { timestamps: { modifiedAt: hoursAgo(12, NOW) } };
  const scored = freshnessScore(edited, { max: WEIGHTS.freshness, now: NOW });
  assert.equal(scored.points, Math.round(MODIFIED_CAP_SHARE * WEIGHTS.freshness));
  assert.ok(scored.points < WEIGHTS.freshness, 'an updated_at can never earn the top band');
  assert.equal(scored.capped, true);
});

test('invariant (3): no date Hoshi can name means no points, at any weight', () => {
  const sightingOnly = { timestamps: { discoveredAt: hoursAgo(1, NOW) } };
  for (const max of [5, 10, 15]) {
    const scored = freshnessScore(sightingOnly, { max, now: NOW });
    assert.equal(scored.points, 0);
    assert.equal(scored.basis, 'none');
  }
});
