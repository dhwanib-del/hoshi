// Employer sponsorship history — shown beside a HELD job, scoring nothing.
//
// PRD §9.1, invariant (26), 2026-11-21 (B-31). This module exists because
// "scores nothing" is not "claims nothing". Every invariant in this product
// guards a value that scores, is stored, or is counted, and §10.3's rules guard
// counts and rates in Activity — so a display-only figure sits outside all of
// them. That is how §9.1 came to name this figure's unit, "a count of petitions
// in a named year", with nothing in the loop having read a dataset that
// produces one.
//
// What the two public datasets actually hold:
//
//  · USCIS's H-1B Employer Data Hub counts petitions and their approvals. It is
//    what the category's "H1B Sponsor Likely" labels are built on, and this
//    loop CANNOT REACH IT — every uscis.gov path is refused by the sandbox's
//    fetch allowlist — so nothing here is written against its field names or
//    its caveats, and its entry below is marked unreachable rather than
//    guessed at.
//
//  · DOL OFLC's LCA disclosure file IS reachable, and it is three steps away
//    from a petition count. A row is an APPLICATION, and TOTAL_WORKER_POSITIONS
//    is "Total number of foreign workers requested by the Employer", so rows
//    and positions are different numbers — 2.4x apart across FY2026 to date
//    (478,508 positions requested on 198,149 applications received). Its
//    decision is a wage-and-conditions CERTIFICATION, not a visa, granted to
//    91.8% of processed applications against 0.47% denied (191,095 and 977 of
//    208,171, through 2026-03-31) — so `certified` is true of nearly every
//    employer that files and discriminates nothing. Only the volume carries
//    information, and the volume is in positions.
//
//  · And the public file has NO EMPLOYER IDENTIFIER. The record layout withholds
//    the FEIN as PII, leaving EMPLOYER_NAME, "Legal business name of the
//    employer submitting the Labor Condition Application". Meanwhile DOL's own
//    statistics are "aggregated based on the unique FEIN submitted by the
//    employer" and warn that "Multiple appearances of the same employer name
//    may occur when associated with multiple FEINs". The publisher states that
//    the name is not the employer, and then publishes only the name — so a
//    company-level TOTAL is unconstructible from this file, and summing matched
//    filers would be a corporate-structure claim nobody checked (Principle 2).
//
// Hence the shape below: a figure per matched filer string, never a sum; the
// dataset, the fiscal year and the unit named with it; and three states where
// `not-looked-up` is the no-claim state everything else fails closed to.

export const DATASETS = Object.freeze({
 'oflc-lca': Object.freeze({
  id: 'oflc-lca',
  name: 'DOL OFLC LCA disclosure data',
  unit: 'positions requested on certified applications',
  filerKey: 'EMPLOYER_NAME',
  reachable: true
 }),
 'uscis-hub': Object.freeze({
  id: 'uscis-hub',
  name: 'USCIS H-1B Employer Data Hub',
  unit: 'petitions approved',
  filerKey: 'Employer',
  // Not reachable from this loop. Left here so no future run writes an adapter
  // against a schema nobody has read; flipping this needs a response body.
  reachable: false
 })
});

// `not-looked-up` is the no-claim state. Nothing fails closed to `not-found`,
// because that is a claim ABOUT the dataset — §8.8's rule (a failure to observe
// is not an observation of absence) and §9.6's 0 band, one surface over.
export const LOOKUP_STATES = Object.freeze(['not-looked-up', 'not-found', 'matched']);

const NO_CLAIM = Object.freeze({
 state: 'not-looked-up', dataset: null, fiscalYear: null, filers: [],
 line: 'Sponsorship history not looked up'
});

/**
 * Invariant (26): the note names its dataset, its fiscal year, its unit and the
 * exact filer string it matched; it is never summed across filer strings; it
 * scores nothing and satisfies no gate; and the three states are distinct, with
 * neither of the first two rendered as absence.
 *
 * Returns a frozen note. There is deliberately no `positions`, `total`, `score`
 * or `points` key on it: the absence of a company-level figure is the
 * requirement, not an omission to be tidied up later.
 */
export function sponsorshipNote(lookup) {
 if (!lookup || !LOOKUP_STATES.includes(lookup.state) || lookup.state === 'not-looked-up') return NO_CLAIM;
 const ds = DATASETS[lookup.dataset];
 // An unreachable dataset cannot have been looked up, whatever a caller says.
 // A missing year withdraws the claim too: the figure is about one year.
 if (!ds || !ds.reachable || !lookup.fiscalYear) return NO_CLAIM;
 const where = ds.name + ', FY' + lookup.fiscalYear;
 if (lookup.state === 'not-found') {
  return Object.freeze({
   state: 'not-found', dataset: ds.id, fiscalYear: lookup.fiscalYear, filers: [],
   line: 'No filer of that name in ' + where
    + ' — matched on ' + ds.filerKey + ', so this is not evidence they do not sponsor'
  });
 }
 // A match that cannot name the exact filer string it matched is not a match,
 // and a match with no finite figure is not a figure. Either way the claim is
 // withdrawn rather than weakened.
 const filers = (lookup.filers || []).filter(f =>
  f && typeof f.filer === 'string' && f.filer.trim() && Number.isFinite(f.positions));
 if (!filers.length) return NO_CLAIM;
 const rows = filers.map(f => Object.freeze({
  filer: f.filer,
  positions: f.positions,
  line: f.positions + ' ' + ds.unit + ' · filed as “' + f.filer + '” · ' + where
 }));
 return Object.freeze({
  state: 'matched', dataset: ds.id, fiscalYear: lookup.fiscalYear, filers: Object.freeze(rows),
  line: rows.length === 1 ? rows[0].line
   : rows.length + ' separate filers of that name in ' + where + ' — shown separately, never added up'
 });
}
