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
  WEIGHTS, POINTS, GATE_POINTS, RANKED_FLOOR, ROLE_FLOOR, ROLE_FLOOR_SHARE, SOFT_BLOCK,
  WEIGHTS_VERSION, scoreJob, ROLE_BANDS, ROLE_ADJACENT_SHARE, roleBand, morningBrief
} from '../src/scoring.js';
import { freshnessScore, POOL_SHARE, MODIFIED_CAP_SHARE } from '../src/freshness.js';
import { stateFrom, addJob, mayMarkApplied } from '../src/model.js';

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

// PRD §10.5 invariant (14). `weightsVersion` is the one field on a submission
// row that nothing in the product reads — it exists for a future segmentation —
// so a literal there goes stale without a single test failing, which is exactly
// what happened between 2026-11-03 and today. The row is append-only, so the
// damage is permanent rather than a display bug a release fixes.
const version = table => Object.keys(table).sort().map(k => k.slice(0, 3) + table[k]).join('-');

test('invariant (14): the weights version is derived from the table', () => {
  assert.equal(WEIGHTS_VERSION, version(WEIGHTS));
  // Fault injection: move one weight and the version must move with it. A
  // version that survives a table change is the defect this invariant exists
  // to make impossible.
  assert.notEqual(version({ ...WEIGHTS, connection: WEIGHTS.connection + 5 }), WEIGHTS_VERSION);
  // Order is not identity: the same weights written in another order are the
  // same table, and must not look like a second regime to a segmented rate.
  const reordered = Object.fromEntries(Object.entries(WEIGHTS).reverse());
  assert.equal(version(reordered), WEIGHTS_VERSION);
  // And it is not a date. A date is a thing someone remembers to change.
  assert.ok(!/^\d{4}-\d{2}-\d{2}$/.test(WEIGHTS_VERSION));
});

test('invariant (14): a Hoshi submission row carries the live table, not a literal', () => {
  const state = addJob(stateFrom(null), {
    title: 'Product Designer', company: 'Figma', location: 'United States',
    eligibility: 'eligible', authorization: 'confirmed',
    timestamps: { publishedAt: hoursAgo(12, NOW) }
  });
  const job = state.jobs[0];
  const score = scoreJob(job, state.profile, [], [], NOW);
  assert.equal(score.rankable, true, 'both gates verified, so this row is the hoshi arm');
  const after = mayMarkApplied(state, job.id, { confirm: true, source: 'hoshi', score });
  const row = after.events.find(e => e.kind === 'submission');
  assert.equal(row.weightsVersion, WEIGHTS_VERSION);
  assert.equal(row.weightsVersion, version(WEIGHTS));
});

test('invariant (14): a score with no weight table is refused, not stamped', () => {
  const state = addJob(stateFrom(null), {
    title: 'UX Researcher', company: 'Stripe', location: 'United States',
    eligibility: 'eligible', authorization: 'confirmed'
  });
  const job = state.jobs[0];
  const { weightsVersion, ...noVersion } = scoreJob(job, state.profile, [], [], NOW);
  assert.ok(weightsVersion, 'the score carried one to strip');
  // Fail closed (Principle 5): on an append-only store a guessed row is forever.
  assert.throws(
    () => mayMarkApplied(state, job.id, { confirm: true, source: 'hoshi', score: noVersion }),
    /weight table/
  );
});

test('invariant (3): no date Hoshi can name means no points, at any weight', () => {
  const sightingOnly = { timestamps: { discoveredAt: hoursAgo(1, NOW) } };
  for (const max of [5, 10, 15]) {
    const scored = freshnessScore(sightingOnly, { max, now: NOW });
    assert.equal(scored.points, 0);
    assert.equal(scored.basis, 'none');
  }
});

// PRD §9.6 invariant (16), added 2026-11-07. Role is the largest term — 25 of
// the 45-wide ranked range, the majority of what separates two ranked jobs —
// and the document carried a weight for it with no scoring rule at all. The
// bands are shares of the term and the RELATION is what is asserted: the floor
// and the adjacent band are one decision, one point apart today, so either one
// moved alone either empties the brief of every adjacent-title role or admits
// every title Hoshi half-recognised.
test('invariant (16): unmatched < floor <= adjacent < lane, as shares of role', () => {
  assert.ok(0 < ROLE_FLOOR_SHARE, 'the unmatched band is below the floor');
  assert.ok(ROLE_FLOOR_SHARE <= ROLE_ADJACENT_SHARE, 'an adjacent title still clears the floor');
  assert.ok(ROLE_ADJACENT_SHARE < 1, 'an adjacent title is worth less than a saved lane');
  assert.equal(ROLE_BANDS.lane, WEIGHTS.role);
  assert.equal(ROLE_BANDS.adjacent, Math.round(ROLE_ADJACENT_SHARE * WEIGHTS.role));
  assert.equal(ROLE_BANDS.unmatched, 0);
  assert.ok(ROLE_BANDS.unmatched < ROLE_FLOOR, 'an unmatched title cannot be ranked');
  assert.ok(ROLE_BANDS.adjacent >= ROLE_FLOOR, 'an adjacent title can be');
  assert.ok(ROLE_BANDS.adjacent < ROLE_BANDS.lane);
});

test('invariant (16): the band is named, and 0 says "not found" rather than "not yours"', () => {
  const profile = { roleLanes: ['UX Researcher'], locations: [], portfolioProjects: [] };
  assert.deepEqual(roleBand({ title: 'Senior UX Researcher' }, profile),
    { points: ROLE_BANDS.lane, basis: 'lane', lane: 'UX Researcher', field: 'title' });
  assert.equal(roleBand({ title: 'Product Designer II' }, profile).basis, 'adjacent');
  const miss = roleBand({ title: 'Member of Technical Staff' }, profile);
  assert.equal(miss.basis, 'unmatched');
  assert.equal(miss.points, 0);
  // A score line for an unmatched title must not read as a verdict on the role.
  const line = scoreJob({ title: 'Member of Technical Staff', company: 'Acme', location: '',
    eligibility: 'eligible', authorization: 'confirmed' }, profile, [], [], NOW).lines[0];
  assert.match(line, /no saved lane/);
  assert.doesNotMatch(line, /not matched$/);
});

test('§9.6: block 3 counts the titles no saved lane matched', () => {
  const profile = { roleLanes: ['UX Researcher'], locations: [], portfolioProjects: [] };
  const state = { profile, people: [], events: [], boards: [], jobs: [
    { id: 'a', title: 'Member of Technical Staff', company: 'Acme', location: '',
      eligibility: 'eligible', authorization: 'confirmed' },
    { id: 'b', title: 'Experience Strategist', company: 'Beta', location: '',
      eligibility: 'eligible', authorization: 'confirmed' },
    { id: 'c', title: 'UX Researcher', company: 'Gamma', location: '',
      eligibility: 'eligible', authorization: 'confirmed' }
  ] };
  const brief = morningBrief(state, NOW);
  assert.equal(brief.unmatchedTitles, 2, 'both unrecognised titles are counted, not swallowed');
  assert.ok(brief.alsoOpen >= brief.unmatchedTitles);
});
