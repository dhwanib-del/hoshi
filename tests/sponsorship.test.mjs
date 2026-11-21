import test from 'node:test';import assert from 'node:assert/strict';
import {sponsorshipNote,DATASETS,LOOKUP_STATES} from '../src/sponsorship.js';
import {scoreJob} from '../src/scoring.js';

// PRD §9.1, invariant (26), 2026-11-21 (B-31). §9.1 promised "a count of
// petitions in a named year" beside a held job, and the figure it promised is
// not available: the petitions dataset (USCIS) is unreachable from this loop,
// and the reachable one (DOL OFLC's LCA file) counts positions requested on
// applications, decides them with a certification 91.8% of filings receive, and
// identifies an employer only by a legal-name string because the FEIN is
// withheld as PII — while DOL's own statistics aggregate on that FEIN and warn
// one name may span several of them. So a company-level total is unconstructible
// and the figure must be per filer string, never summed.
//
// The reason none of this was caught: the figure SCORES NOTHING, and every
// invariant in this product guards a value that scores, is stored or is counted.
const AMZN = {
 state: 'matched', dataset: 'oflc-lca', fiscalYear: 2026,
 filers: [{filer: 'AMAZON.COM SERVICES LLC', positions: 1204},
          {filer: 'AMAZON WEB SERVICES, INC.', positions: 611}]
};

test('a lookup never performed is the no-claim state, never "not found"', () => {
 for (const l of [undefined, null, {}, {state: 'not-looked-up'}, {state: 'nonsense'}]) {
  const n = sponsorshipNote(l);
  assert.equal(n.state, 'not-looked-up');
  assert.equal(n.dataset, null, 'a lookup that did not happen names no dataset');
  assert.doesNotMatch(n.line, /not sponsor|no history|none/i,
   'the no-claim state must not read as a claim about the employer');
 }
 assert.deepEqual([...LOOKUP_STATES], ['not-looked-up', 'not-found', 'matched'],
  'three states, and the first is the one everything fails closed to');
});

test('invariant 26: several filers of one name are several rows and are never summed', () => {
 const n = sponsorshipNote(AMZN);
 assert.equal(n.state, 'matched');
 assert.equal(n.filers.length, 2, 'one row per filer string');
 for (const key of ['positions', 'total', 'sum', 'score', 'points']) {
  assert.equal(n[key], undefined,
   'a company-level ' + key + ' would be a corporate-structure claim: DOL aggregates on the FEIN it withholds');
 }
 assert.match(n.line, /never added up/, 'the refusal is on the surface, not only in the schema');
 // And the figures are still individually readable.
 assert.deepEqual(n.filers.map(f => f.positions), [1204, 611]);
});

test('every row names its dataset, its fiscal year, its unit and the exact filer string', () => {
 const row = sponsorshipNote(AMZN).filers[0];
 const ds = DATASETS['oflc-lca'];
 assert.match(row.line, /AMAZON\.COM SERVICES LLC/, 'the filer string it matched');
 assert.ok(row.line.includes(ds.unit), 'the unit is the file\'s, not "petitions"');
 assert.match(row.line, /FY2026/, 'the year the figure is true of');
 assert.ok(row.line.includes(ds.name), 'the dataset that produced it');
 assert.doesNotMatch(row.line, /petition/i, 'the reachable file does not count petitions');
});

test('a name that matched nothing names the key it matched on and refuses to mean absence', () => {
 const n = sponsorshipNote({state: 'not-found', dataset: 'oflc-lca', fiscalYear: 2026});
 assert.equal(n.state, 'not-found');
 assert.match(n.line, /EMPLOYER_NAME/, 'a legal-name match is the whole of the claim');
 assert.match(n.line, /not evidence they do not sponsor/,
  'a failure to look a name up is not an observation of absence (§8.8, §9.6)');
});

test('a claim that cannot be made honestly fails closed to no claim, not to "not found"', () => {
 const cases = [
  [{...AMZN, filers: [{positions: 900}]}, 'a figure with no filer string'],
  [{...AMZN, filers: [{filer: '  ', positions: 900}]}, 'a blank filer string'],
  [{...AMZN, filers: [{filer: 'ACME LLC', positions: null}]}, 'a filer with no finite figure'],
  [{...AMZN, fiscalYear: undefined}, 'a figure with no year'],
  [{state: 'matched', dataset: 'uscis-hub', fiscalYear: 2026, filers: [{filer: 'ACME', positions: 9}]},
   'a dataset this loop cannot reach']
 ];
 for (const [lookup, why] of cases) {
  assert.equal(sponsorshipNote(lookup).state, 'not-looked-up', why + ' must withdraw the claim');
 }
 assert.equal(DATASETS['uscis-hub'].reachable, false,
  'no adapter may be written against a schema nobody has read');
});

test('the history scores nothing and satisfies no gate', () => {
 const job = {title: 'UX Researcher', company: 'Amazon', eligibility: 'eligible',
  authorization: 'unverified', sponsorshipLookup: AMZN};
 const score = scoreJob(job, {roleLanes: ['ux researcher']}, [], []);
 assert.equal(score.gate, 'held', 'an unverified sponsorship gate is held, history or no history');
 assert.equal(score.total, null, 'a held job carries no total (invariant 12)');
 assert.ok(score.missingChecks.length >= 1, 'and still names the check it is missing');
});
