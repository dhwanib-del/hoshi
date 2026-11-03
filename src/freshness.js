// Posting age, verified rather than guessed.
//
// Four timestamp kinds are kept distinct and never conflated (2026-11-03 spec §3):
//   publishedAt  — the employer's original publication time
//   modifiedAt   — an edit; Greenhouse's updated_at is this, not a posting date
//   discoveredAt — when Hoshi first saw the row. Never a substitute for the above.
//   repostedAt   — a previously delisted requisition that came back
//
// Two classifications come off the same verified instant, because they answer
// different questions and the PRD is explicit that they are not the same claim:
//   recency  — "is this newly posted?"  Drives the Fresh Jobs sections and filters.
//   poolBand — "how full is the applicant pool already?"  PRD §9.5, the scored term.
// Neither is a probability of being hired.

export const UNVERIFIED_LABEL = 'Posting age unverified';

// Recency edges, in minutes (2026-11-03 spec §3).
export const RECENCY_EDGES = Object.freeze({ hour: 60, sixHours: 360, day: 1440 });

// PRD §9.5 edges, in hours, measured from DHI/St. Louis Fed arrival data.
export const POOL_EDGES = Object.freeze({ fresh: 48, warm: 96, full: 240 });

// Share of the freshness weight each pool band earns. PRD §9.5's 5/3/1/0 spacing
// expressed as a share so the weight itself stays a single constant: at a 5-point
// term this yields exactly 5/3/1/0, at a 15-point term 15/9/3/0.
export const POOL_SHARE = Object.freeze({ fresh: 1, warm: 0.6, full: 0.2, stale: 0, none: 0 });

// PRD §9.5 invariant (4): a modification date can never earn the top band.
export const MODIFIED_CAP_SHARE = 0.6;

/**
 * Pick the instant that may be used as the posting's age, and say what it is.
 * Returns basis 'none' when the only thing Hoshi has is its own sighting —
 * discovery time is not evidence about when the employer posted.
 */
export function ageBasis(job) {
  const t = job?.timestamps || {};
  const pick = (value, basis) => {
    const ms = value ? Date.parse(value) : NaN;
    return Number.isFinite(ms) ? { at: new Date(ms).toISOString(), ms, basis } : null;
  };
  // A repost is the live requisition's own start; it outranks the original.
  return pick(t.repostedAt, 'reposted')
    || pick(t.publishedAt, 'posted')
    || pick(t.modifiedAt, 'modified')
    || { at: null, ms: NaN, basis: 'none' };
}

/** Her bands: how new is this, really. */
export function recencyOf(job, now = new Date()) {
  const basis = ageBasis(job);
  if (basis.basis === 'none') return { band: 'unverified', minutes: null, basis: 'none' };
  const minutes = (now.getTime() - basis.ms) / 60000;
  if (minutes < -90) return { band: 'unverified', minutes: null, basis: 'none' }; // future-dated: refuse it
  const m = Math.max(0, minutes);
  const band = m <= RECENCY_EDGES.hour ? 'hour'
    : m <= RECENCY_EDGES.sixHours ? 'sixHours'
      : m <= RECENCY_EDGES.day ? 'day'
        : 'older';
  return { band, minutes: m, basis: basis.basis, at: basis.at };
}

/** PRD §9.5: how full the applicant pool already is. */
export function poolBandOf(job, now = new Date()) {
  const r = recencyOf(job, now);
  if (r.band === 'unverified') return { band: 'none', hours: null, basis: 'none' };
  const hours = r.minutes / 60;
  const band = hours <= POOL_EDGES.fresh ? 'fresh'
    : hours <= POOL_EDGES.warm ? 'warm'
      : hours <= POOL_EDGES.full ? 'full'
        : 'stale';
  return { band, hours, basis: r.basis };
}

/**
 * The scored freshness term. `max` is the weight the scoring table gives
 * freshness — one constant, so changing the weight table changes nothing here.
 */
export function freshnessScore(job, { max = 5, now = new Date() } = {}) {
  const pool = poolBandOf(job, now);
  const rec = recencyOf(job, now);
  if (pool.basis === 'none') {
    return { points: 0, band: 'none', recency: 'unverified', basis: 'none', line: `+0 freshness · ${UNVERIFIED_LABEL}` };
  }
  const share = pool.basis === 'modified'
    ? Math.min(MODIFIED_CAP_SHARE, POOL_SHARE[pool.band])
    : POOL_SHARE[pool.band];
  const points = Math.round(share * max);
  return {
    points,
    band: pool.band,
    recency: rec.band,
    basis: pool.basis,
    at: rec.at,
    capped: pool.basis === 'modified' && POOL_SHARE[pool.band] > MODIFIED_CAP_SHARE,
    line: `+${points} freshness · ${describeAge(job, now)}`
  };
}

/** Human-readable age that always names which timestamp it used. */
export function describeAge(job, now = new Date()) {
  const r = recencyOf(job, now);
  if (r.band === 'unverified') return UNVERIFIED_LABEL;
  const m = Math.round(r.minutes);
  const span = m < 60 ? `${m} min ago`
    : m < 1440 ? `${Math.round(m / 60)}h ago`
      : `${Math.round(m / 1440)}d ago`;
  const which = r.basis === 'posted' ? 'posted'
    : r.basis === 'reposted' ? 'reposted'
      : 'last edited (not a posting date)';
  return `${which} ${span}`;
}

/** True only for the three bands the spec allows to be called newly posted. */
export const isFresh = (job, now = new Date()) =>
  ['hour', 'sixHours', 'day'].includes(recencyOf(job, now).band);

/**
 * Fold a provider's timestamps into a job record without ever overwriting a
 * real publication date with a weaker one, and detect a repost: a requisition
 * Hoshi had already observed as closed that is live again.
 */
export function mergeTimestamps(existing, incoming, { now = new Date() } = {}) {
  const prev = existing?.timestamps || {};
  const next = { ...prev };
  for (const key of ['publishedAt', 'modifiedAt', 'repostedAt']) {
    const value = incoming?.[key];
    if (!value || !Number.isFinite(Date.parse(value))) continue;
    if (key === 'modifiedAt' || !prev[key]) next[key] = new Date(Date.parse(value)).toISOString();
  }
  next.discoveredAt = prev.discoveredAt || now.toISOString();
  if (existing?.listingState === 'closed' && !next.repostedAt) {
    // Back on the board after a verified delisting. We know it is live again now;
    // we do not know when it went back up, so the repost instant is this sighting
    // and the field says so by being distinct from publishedAt.
    next.repostedAt = now.toISOString();
  }
  return next;
}
