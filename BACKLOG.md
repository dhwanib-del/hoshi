# Hoshi — Improvement Backlog

Pulled from by the daily loop. Items move Open → Done or Open → Rejected, and never come back.

Priority is by thesis fit: does this increase *conversations*, or only *submissions*?

---

## Open — high priority

**B-02 · Daily Brief leads with the wrong thing**
Spec §7 shows a brief that is a list of jobs. Under the thesis it should lead with people and warm paths, with jobs as the second section. Rewrite §7 with the conversation-first ordering and a concrete example. Now also has to place the discovery output defined in PRD §8.1 — promoted jobs inline, everything else in the collapsed "also open" list — and honour PRD §9.3 invariant 1: a job below the role-fit floor never enters the brief, whatever its connection tier. PRD §10.3 adds one more: any number the brief shows is bound by the honesty rules, so a brief that says "your reply rate is up" without disjoint intervals is a spec violation, not a copy choice.

**B-11 · Verify CORS on the four discovery endpoints**
PRD §8.6 assumes Greenhouse, Lever, Ashby and Workday send permissive CORS headers, so a Manifest V3 service worker can fetch them directly with `host_permissions` and no backend hop. This is tagged `[assumption]` and is unverified — the loop's sandbox refuses egress to all four hosts. One `curl -I` per host with an `Origin: chrome-extension://…` header from an ordinary network settles it. Blocks writing any adapter, because a refusal on a documented provider forces a proxy and changes the cost profile of the whole engine. **Dhwani can close this in about two minutes; the loop cannot close it at all.**

---

## Open — medium

**B-05 · Sponsorship should probably be a scoring term, not a gate**
Currently a pass/fail eligibility check, and left at 5 points in the PRD §9.1 weight table pending this. For an international student, a role that is silent on sponsorship is not the same as one that explicitly refuses it, and treating both as hard rejections loses real opportunities. Needs Q4 answered first.

**B-06 · Generic-draft detection**
Simplify and Jobright are both criticised for output that needs heavy editing. Hoshi already warns when a contact has no shared context. Extend: if a generated draft could be sent to any company at that job title, say so before the user sends it.

**B-07 · Freshness is specified but unused**
Spec §4 defines four freshness bands and says job age should feed ranking. Nothing consumes it, and PRD §9.1 left it at 5 points unchanged rather than resolve it by stealth. Either wire it into scoring or cut it and redistribute the 5. PRD §8.4 adds a constraint: Greenhouse gives `updated_at`, not a posted date, so a reposted role reads as fresh. Any band built on it must record which date it actually got.

**B-08 · The two backends are load-bearing and do not exist**
Blocks generation entirely and caps classification coverage. Needs Q2 answered. Until then, specify precisely what a local-only Hoshi can and cannot do, so the degraded mode is a designed product rather than an accident.

**B-12 · Connection tier needs a source for C1**
PRD §9.2 awards 8 points for a named person the user has not contacted — typically the recruiter on the posting. Nothing in the current build extracts that person. Either specify where C1 evidence comes from (posting metadata, ATS response fields, the ranked alum list) or the tier is unreachable in practice and should collapse into C0.

**B-13 · Activity has to render counts and rates differently**
PRD §10.3 rule 7 says a count is a fact and a rate is an estimate, and that if the Activity tab renders them identically the interval rule is decoration. That is a design task inside the fixed Material 3 / 360px system, not a spec task: it needs a treatment for "exact" versus "estimated, here is the range" that survives at side-panel width and does not read as two unrelated widgets. Also owns the insufficient-data state from rule 6, which is a real component and not an empty state — it carries a computed number.

**B-14 · Pushes work, so decide what the loop is allowed to build**
LOOP.md carried a hard constraint saying `github.com/dhwanib-del/hoshi` was empty and pushes were refused for this org. Tested 2026-10-02: false. The four spec docs are now committed and pushed to `master` ([88dbb01](https://github.com/dhwanib-del/hoshi/commit/88dbb01aca67ef84f6ae77bfc450a1d3d664f950)). That removes the mechanical reason this is a spec-only loop, but not the substantive one — **the extension codebase still is not in this repo**, so there is nothing to write against. Dhwani's decision, two parts: (a) push the real Hoshi source here, and (b) say whether the loop should write code against it or keep specifying and leave implementation to her. Until she answers, runs commit spec docs only. Not an engineering question and the loop should not answer it by starting.

---

## Open — low

**B-09 · Interview mode is specified but far down the build order**
Unlocks at Recruiter Screen. Under the thesis this matters more than it looks — it is the end of the conversation funnel.

**B-10 · No onboarding**
A user with an empty Career Search Profile gets empty views. The profile is the input to everything else.

---

## Done

**B-01 · Fit score has no warm-connection term** — specified 2026-09-29 in PRD §9. Connection enters at 20 of 100, displacing 5 each from role match, experience match, company and narrative — the terms that predict fit but not conversation, and in the case of role/experience were double-counting one signal. Tiers are scored by **what the person can do today** (C3 replied-or-will-refer 20 / C2 saved alum or contact, no reply 14 / C1 named but unsaved 8 / C0 nobody 0), never by an inferred closeness score, with C2 decaying to C1 after 21 silent days. Two CI-blocking invariants bound the term: connection re-ranks the qualified set but cannot admit a job below the role-fit floor, and C3 outweighs company+narrative+location+freshness combined but stays smaller than role+experience. Explanation must name the person — if Hoshi cannot name them, it cannot award the points, which puts Principle 2 on the score itself. Weights and tier spacing tagged `[assumption]`: no public dataset resolves outcomes by connection strength, and B-04 has since established that one user's analytics cannot retire the tag either (PRD §10.4). No code written.

**B-03 · Discovery engine** — specified 2026-09-28 in PRD §8. Adapter interface, fail-closed result shape, per-provider field map onto `ExtractedJob`, dedup order reusing `identityKeys` with the page path winning over discovery, and the permission surface. Providers tiered: Greenhouse, Lever and Ashby are documented and unauthenticated; Workday is reverse-engineered and ships declaring `complete: false`. The design decision that makes it a Hoshi feature rather than a volume feature: **discovery is seeded by companies the user has a person at, not by keywords** — which is also the only shape available, since every documented provider endpoint is per-company with no cross-company search. LinkedIn and Indeed deliberately get no adapter. No code written; see B-11 before any is.

**B-04 · No answer to "why did my response rate change?"** — specified 2026-10-02 in PRD §10. The finding that shaped it: **a single user cannot A/B test the application funnel at all.** Detecting a 5%→15% move in cold response rate needs 141 applications per arm, and a seeker reaching one interview per ~40 applications never gets there in a season. So the metric set leans to the warm path, where §1's base rate is an order of magnitude higher and therefore needs an order of magnitude fewer events, and the headline metric is **person-attached rate** — a proportion of the user's own behaviour rather than the market's, so it moves the same week. Metrics split into counts (exact, no interval) and rates (estimates, always with a 95% Wilson interval). Seven honesty rules replace "do not claim causality without enough data": no percentage under n=10, intervals at the same type size as the number, no comparative language unless two intervals are disjoint, no unsourceable external benchmark, and insufficient-data states that give the shortfall as a computed number. B-04's assigned job of falsifying §9.1's connection weight is **conceded as impossible at single-user scale** and recorded as such in §10.4, with two weaker substitutes. Spawned B-13. No code written.

---

## Rejected

_(nothing yet — with the reason, so it is not re-proposed)_
