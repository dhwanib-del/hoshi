# Hoshi — Improvement Backlog

Pulled from by the daily loop. Items move Open → Done or Open → Rejected, and never come back.

Priority is by thesis fit: does this increase *conversations*, or only *submissions*?

---

## Open — high priority

**B-11 · Verify CORS on the four discovery endpoints**
PRD §8.6 assumes Greenhouse, Lever, Ashby and Workday send permissive CORS headers, so a Manifest V3 service worker can fetch them directly with `host_permissions` and no backend hop. This is tagged `[assumption]` and is unverified — the loop's sandbox refuses egress to all four hosts. One `curl -I` per host with an `Origin: chrome-extension://…` header from an ordinary network settles it. Blocks writing any adapter, because a refusal on a documented provider forces a proxy and changes the cost profile of the whole engine. **Dhwani can close this in about two minutes; the loop cannot close it at all.**

**B-15 · "Priority threshold" is load-bearing and has no number**
PRD §5.2 and §7.2 both gate on a job clearing the *priority threshold*, and §9 never defines one. It is the dial that decides how many jobs reach the brief at all, so an undefined threshold means §7's cap of 5 is doing all the work and the score is doing none. Two parts: pick a value on the 0–100 scale of §9.1, and decide whether it is fixed or adaptive (a fixed 70 produces empty days early on, when the watchlist is small; a rank-based "top 5 of today's qualified set" never does, but also never says no). Surfaced by B-02 on 2026-10-03. Asked of Dhwani on 2026-10-03 and again on 2026-10-04 — it is a judgment about what she wants to open at 8am, so the loop is holding rather than picking.

---

## Open — medium

**B-05 · Sponsorship should probably be a scoring term, not a gate**
Currently a pass/fail eligibility check, and left at 5 points in the PRD §9.1 weight table pending this. For an international student, a role that is silent on sponsorship is not the same as one that explicitly refuses it, and treating both as hard rejections loses real opportunities. Needs Q4 answered first.

**B-06 · Generic-draft detection**
Simplify and Jobright are both criticised for output that needs heavy editing. Hoshi already warns when a contact has no shared context. Extend: if a generated draft could be sent to any company at that job title, say so before the user sends it. PRD §2 now carries this as one of the two live competitive constraints, so B-06 is the whole of Hoshi's answer to it.

**B-07 · Freshness is specified but unused**
Spec §4 defines four freshness bands and says job age should feed ranking. Nothing consumes it, and PRD §9.1 left it at 5 points unchanged rather than resolve it by stealth. Either wire it into scoring or cut it and redistribute the 5. PRD §8.4 adds a constraint: Greenhouse gives `updated_at`, not a posted date, so a reposted role reads as fresh. Any band built on it must record which date it actually got. PRD §7.2 now also uses freshness as the second tiebreak inside the brief, so cutting it means picking a different one.

**B-08 · The two backends are load-bearing and do not exist**
Blocks generation entirely and caps classification coverage. Needs Q2 answered. Until then, specify precisely what a local-only Hoshi can and cannot do, so the degraded mode is a designed product rather than an accident.

**B-12 · Connection tier needs a source for C1**
PRD §9.2 awards 8 points for a named person the user has not contacted — typically the recruiter on the posting. Nothing in the current build extracts that person. Either specify where C1 evidence comes from (posting metadata, ATS response fields, the ranked alum list) or the tier is unreachable in practice and should collapse into C0. Now also gates promotion: PRD §7.2 lets C1 lift a job into the brief, so an unreachable C1 narrows the brief as well as the score.

**B-13 · Activity has to render counts and rates differently**
PRD §10.3 rule 7 says a count is a fact and a rate is an estimate, and that if the Activity tab renders them identically the interval rule is decoration. That is a design task inside the fixed Material 3 / 360px system, not a spec task: it needs a treatment for "exact" versus "estimated, here is the range" that survives at side-panel width and does not read as two unrelated widgets. Also owns the insufficient-data state from rule 6, which is a real component and not an empty state — it carries a computed number. Scope narrowed on 2026-10-03: PRD §7.4 keeps rates out of the brief entirely, so this treatment is needed in Activity only.

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

**B-02 · Daily Brief leads with the wrong thing** — specified 2026-10-03 as PRD **§7**, and moved to the front of the document, ahead of the engines, because it is the only surface opened daily and §8–§10 exist to fill it. Three blocks in fixed order with hard caps: conversations (max 3), promoted jobs with their §9.4 score line (max 5), and one collapsed "also open" line. The caps are the substantive part — a Monster survey of 1,006 US job seekers found 48% apply without reading the full description and 32% spend under a minute on a posting ([HCAMag](https://www.hcamag.com/ca/specialization/recruitment/application-overload-half-of-job-seekers-doomjobbing/578466)), so an unbounded ranked feed is the input that behaviour runs on. Promotion requires role fit ≥ 15 of 25 (§9.3 invariant 1) **and** either the priority threshold or tier ≥ C1; block 3 shows no score at all, because a number beside an unpromoted job invites the one-minute apply. Block 1 rows are generated from Hoshi's own stores and must name a person and a stored reason or they do not render. **The brief shows counts and never rates** — an interval cannot sit beside a CTA at 360px, and a daily surface invites exactly the comparison §10.3 rule 3 forbids. Promotion rules moved out of §8.1, which should not have been specifying a surface. Spawned B-15. No code written.

**B-03 · Discovery engine** — specified 2026-09-28 in PRD §8. Adapter interface, fail-closed result shape, per-provider field map onto `ExtractedJob`, dedup order reusing `identityKeys` with the page path winning over discovery, and the permission surface. Providers tiered: Greenhouse, Lever and Ashby are documented and unauthenticated; Workday is reverse-engineered and ships declaring `complete: false`. The design decision that makes it a Hoshi feature rather than a volume feature: **discovery is seeded by companies the user has a person at, not by keywords** — which is also the only shape available, since every documented provider endpoint is per-company with no cross-company search. LinkedIn and Indeed deliberately get no adapter. No code written; see B-11 before any is.

**B-04 · No answer to "why did my response rate change?"** — specified 2026-10-02 in PRD §10. The finding that shaped it: **a single user cannot A/B test the application funnel at all.** Detecting a 5%→15% move in cold response rate needs 141 applications per arm, and a seeker reaching one interview per ~40 applications never gets there in a season. So the metric set leans to the warm path, where §1's base rate is an order of magnitude higher and therefore needs an order of magnitude fewer events, and the headline metric is **person-attached rate** — a proportion of the user's own behaviour rather than the market's, so it moves the same week. Metrics split into counts (exact, no interval) and rates (estimates, always with a 95% Wilson interval). Seven honesty rules replace "do not claim causality without enough data": no percentage under n=10, intervals at the same type size as the number, no comparative language unless two intervals are disjoint, no unsourceable external benchmark, and insufficient-data states that give the shortfall as a computed number. B-04's assigned job of falsifying §9.1's connection weight is **conceded as impossible at single-user scale** and recorded as such in §10.4, with two weaker substitutes. Spawned B-13. No code written.

---

## Rejected

**R-01 · Three of the five rows in PRD §2's competitor-failure table** — cut 2026-10-04 on the Sunday pass, which took §2 from thirteen lines to three. Reasons, so none of them is re-added by a later Saturday research run:

- *"AI locked behind paywall at the moment of need — Teal"* and *"Billing dark patterns (72% of Jobright 1-star reviews) — Jobright"*. Both had their own non-answer written into the PRD: "not a monetization question yet" and "not applicable yet". They generated no requirement and no decision, which made them the only rows in the document that cost lines and bought nothing. They are real complaints about real products; they are not Hoshi's problem until **Q3** says whether Hoshi ships to the Chrome Web Store at all. If Q3 comes back "ship", they belong in a pricing and onboarding section written then — not in the competitive read.
- *"Spray-and-pray risks platform bans, weak response — LazyApply → Never auto-submit"*. Pure duplication. The claim and its source already sit in §1, and the answer is Principle 1 verbatim. §2 was restating two sections it sits between.

The two surviving failures — no discovery (Huntr) and generic output (Simplify, Jobright) — are kept as prose, now with their sourcing weakness stated: they come from review aggregation rather than a citable study, so at the per-tool level they are `[assumption]` and carry direction, not measurement. That tag is new; the old table asserted all five rows flatly under one unsourced header line.
