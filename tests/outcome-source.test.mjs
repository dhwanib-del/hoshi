// PRD §10.5 invariant (30), added 2026-11-28.
//
// `outcome.source` is coverage — what put the row in front of her — and never
// whether the row is true, which is invariant (29)'s correction on the sibling
// kind in the same schema. The `import` arm has sat in the schema since
// 2026-10-16 with no producer, no rule and no reader, while rule 12 made every
// outcome row a numerator member, so an unaccepted match would have entered the
// thesis' own measurement as a fact.
//
// Four things are asserted here, and none of them is a wording:
//   1. an imported row carries the message it matched and when she accepted it,
//      or the write is refused (fail closed is writing nothing);
//   2. suggestions are accepted one at a time — the approval is the whole
//      guarantee, so a bulk accept hands it back to the matcher;
//   3. a rate whose numerator reads the outcome enum must state how many of its
//      hits arrived by match, and the count comes off the same rows the hit
//      count does (invariant 15's shape on the numerator);
//   4. Hoshi does not read the stage out of the message: a suggestion with no
//      stage she picked is not acceptable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markOutcome, acceptOutcomeSuggestion, OUTCOME_SOURCES, appendEvent } from '../src/model.js';
import { activity, byTier, NUMERATORS, outcomeJobs, populationRate } from '../src/scoring.js';

const base = () => ({ jobs: [{ id: 'j1', company: 'Stripe', title: 'UX Researcher' }], events: [], answers: [], contacts: [] });

test('an imported outcome without its match or its acceptance is refused, not stamped', () => {
  const s = base();
  assert.throws(() => markOutcome(s, 'j1', 'rejected', { source: 'import' }), /invariant 30/);
  assert.throws(() => markOutcome(s, 'j1', 'rejected', { source: 'import', messageId: 'm1' }), /invariant 30/);
  assert.throws(() => markOutcome(s, 'j1', 'rejected', { source: 'import', acceptedAt: '2026-11-28T09:00:00Z' }), /invariant 30/);
  const ok = markOutcome(s, 'j1', 'rejected', { source: 'import', messageId: 'm1', acceptedAt: '2026-11-28T09:00:00Z' });
  const row = ok.events.at(-1);
  assert.equal(row.source, 'import');
  assert.equal(row.messageId, 'm1');
  assert.ok(row.acceptedAt, 'an accepted row records when she accepted it');
  // And the default arm is still hers, with no match fields invented for it.
  const mine = markOutcome(s, 'j1', 'screen').events.at(-1);
  assert.equal(mine.source, 'user');
  assert.equal(mine.messageId, undefined);
  assert.deepEqual([...OUTCOME_SOURCES], ['user', 'import']);
  assert.throws(() => markOutcome(s, 'j1', 'screen', { source: 'gmail' }), /user \| import/);
});

test('suggestions are accepted one at a time, and the stage is hers to pick', () => {
  const s = base();
  assert.throws(() => acceptOutcomeSuggestion(s, [
    { jobId: 'j1', stage: 'rejected', messageId: 'm1' },
    { jobId: 'j1', stage: 'rejected', messageId: 'm2' }
  ]), /one at a time/);
  // No stage means Hoshi would have to read it out of the message, which is
  // Principle 2 (invariant 24's refusal one funnel over).
  assert.throws(() => acceptOutcomeSuggestion(s, { jobId: 'j1', messageId: 'm1' }), /stage you chose/);
  assert.throws(() => acceptOutcomeSuggestion(s, { jobId: 'j1', stage: 'rejected' }), /message it matched/);
  const after = acceptOutcomeSuggestion(s, { jobId: 'j1', stage: 'rejected', messageId: 'm1' });
  assert.equal(after.events.length, 1);
  assert.equal(after.events[0].source, 'import');
});

test('a rate over outcome rows refuses to render without its by-match count', () => {
  const advanced = NUMERATORS.advanced();
  assert.equal(advanced.overOutcomes, true, 'the outcome numerators declare that they read outcome rows');
  assert.equal(NUMERATORS.anyReply().overOutcomes, false, 'reply rate is one regime and has nothing to split');
  const rows = [{ source: 'hoshi', jobId: 'j1', at: '2026-01-01T00:00:00Z', personAttached: { contactId: 'c1', tier: 'C2' } }];
  assert.throws(() => byTier(rows, () => true, 'skew', advanced), /invariant 30/);
  assert.doesNotThrow(() => byTier(rows, () => true, 'skew', advanced, () => false));
});

test('the by-match count comes off the same rows the hit count does', () => {
  const rows = [
    { source: 'hoshi', jobId: 'j1' }, { source: 'hoshi', jobId: 'j2' }, { source: 'hoshi', jobId: 'j3' }
  ];
  const hit = x => x.jobId !== 'j3';            // two hits
  const matched = x => x.jobId === 'j1' || x.jobId === 'j3';  // one of them matched, one is not a hit at all
  const r = populationRate('hoshi', rows, hit, 'skew', matched);
  assert.equal(r.k, 2);
  assert.equal(r.byMatch, 1, 'a matched row that is not a hit is not counted as one');
  assert.equal(populationRate('hoshi', rows, hit, 'skew').byMatch, null,
    'a rate with nothing to split states no count rather than a zero');
});

test('Activity reports imported hits per segment, and only for the outcome rates', () => {
  let s = base();
  const old = '2026-01-01T00:00:00Z';
  s = { ...s, events: [
    { id: 'e1', kind: 'submission', source: 'hoshi', jobId: 'j1', at: old, personAttached: { contactId: 'c1', tier: 'C2' }, roleFit: 25, totalScore: 80, weightsVersion: 'v1' },
    { id: 'e2', kind: 'submission', source: 'hoshi', jobId: 'j2', at: old, personAttached: null, roleFit: 25, totalScore: 70, weightsVersion: 'v1' }
  ] };
  // One rejection she entered, one an inbox match surfaced and she approved.
  s = markOutcome(s, 'j1', 'rejected');
  s = { ...s, jobs: [...s.jobs, { id: 'j2', company: 'Figma', title: 'Designer' }] };
  s = acceptOutcomeSuggestion(s, { jobId: 'j2', stage: 'rejected', messageId: 'm9' });
  const a = activity(s, new Date('2026-06-01T00:00:00Z'));
  const response = a.rates.find(r => /A response/.test(r.metric));
  const advance = a.rates.find(r => /A screen or an interview, 21/.test(r.metric));
  const reply = a.rates.find(r => /A reply to outreach/.test(r.metric));
  assert.equal(response.segments[0].k, 2, 'both rejections are answers (rule 12)');
  assert.equal(response.segments[0].byMatch, 1, 'one of the two arrived by match');
  // The same rejection is an answer and not an advance, which is why the two
  // rates move in opposite directions off the imported rows.
  assert.equal(advance.segments[0].k, 0);
  assert.equal(advance.segments[0].byMatch, 0);
  assert.equal(reply.segments[0].byMatch, null, 'reply rate has no match arm to report');
  const tiers = a.rates.find(r => r.kind === 'self-selected');
  assert.ok(tiers.segments.every(x => x.byMatch === 0), 'the by-tier set carries the count too');
});

test('an outcome row still refuses an unknown stage, and the log stays append-only', () => {
  const s = base();
  assert.throws(() => markOutcome(s, 'j1', 'ghosted'), /Invalid outcome/);
  assert.throws(() => appendEvent(s, { kind: 'rumour' }), /Unknown event kind/);
});
