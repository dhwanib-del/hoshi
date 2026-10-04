# Hoshi Loop — operating doc

Read this first, every run. It decides what today's run does.

Hoshi is Dhwani's Chrome extension (Manifest V3) for job search: it recognises job pages, extracts postings, fills applications without ever submitting them, and tracks the people worth talking to. She is a UX Research & Design master's student at UMSI targeting product design and UX research roles, and she needs visa sponsorship.

**The job of this loop is to make the PRD sharper every day, and to make Hoshi the best job-finding tool by the definition in PRD §5.**

---

## Run order

1. **Read `claude/hoshi/PRD.md`.** This is the product. Everything answers to its §1 thesis.
2. **Read `claude/hoshi/BACKLOG.md`.** Never re-propose anything under Done or Rejected.
3. **Read the two most recent briefs** in `claude/hoshi/briefs/` if any exist. Do not repeat yesterday's work.
4. **Check for Dhwani's answers.** If she has answered any Open Question in PRD §6, or left a note in a brief, treat her answer as a decision: fold it into the PRD, remove it from §6, and say so in today's brief.
5. **Do today's work** (below).
6. **Write today's brief** to `claude/hoshi/briefs/YYYY-MM-DD.md`.
7. **Update the PRD and BACKLOG** with what changed.
8. **Finish with a SendUserMessage**: what changed today in one line each, and the single most useful thing she could answer.

---

## Today's work — pick ONE

One substantive change per run. Not three, not ten. A loop that touches everything daily produces a document nobody can read by week three.

Choose in this order:

1. **If an Open Question got answered** → fold it in. That is the whole run.
2. **If a high-priority backlog item is ready** → do that one. Take it from Open to Done with the actual specification written into the PRD, not a note saying it should be.
3. **Otherwise** → the weekly rotation:

| Day | Focus |
| --- | --- |
| Mon | Discovery and sourcing (B-03 and descendants) |
| Tue | Fit scoring and ranking |
| Wed | Networking and outreach — the thesis lives here |
| Thu | Application flow, autofill, answer bank |
| Fri | Analytics, honesty rules, measurement |
| Sat | Competitive research — find one thing a competitor does well or badly, with a source |
| Sun | Cut. Find the weakest section and make it shorter or delete it. |

Sunday is not optional. It is the only thing keeping this document usable.

---

## What "improve the PRD" means

**It means sharper, not longer.**

- A run that deletes a vague paragraph and replaces it with a testable sentence is a good run.
- A run that adds a section nobody asked for is a bad run, even if the section is well written.
- Every factual claim needs a source link or an explicit `[assumption]` tag. Untagged assumptions are the failure mode that makes a spec feel authoritative when it is guessing.
- If two sections say the same thing, merge them.
- If a requirement cannot be tested, either make it testable or cut it.

**Target length: under 400 lines.** If the PRD is over that, Sunday's cut is mandatory regardless of what else is queued.

---

## Hard constraints

- **Do not guess the Open Questions in PRD §6.** They are hers. Guessing produces a spec built on a foundation she never agreed to. Ask in the brief instead.
- **Do not weaken the six principles in PRD §3.** They are enforced by tests in the codebase. If a proposal requires breaking one, the proposal is wrong.
- **Do not redesign the UI.** The design system is Material 3 with Quicksand and Nunito Sans, fixed at a 360px side panel, with a four-destination bottom nav (Orbit, Jobs, People, Activity). Work within it.
- **Do not invent build status.** The codebase is not attached to these runs. Report what previous briefs and the PRD say is built; do not claim a test passed that you did not run.
- **Pushes work now — but this is still a spec loop until Dhwani says otherwise.** The old constraint here said `github.com/dhwanib-del/hoshi` was empty and pushes were refused for this org. That was tested on 2026-10-02 and is false: a commit to `master` went through ([88dbb01](https://github.com/dhwanib-del/hoshi/commit/88dbb01aca67ef84f6ae77bfc450a1d3d664f950)), and the repo now holds the four spec docs. What has *not* changed: the extension codebase is still not attached to these runs, so there is nothing to write code against. A run may commit and push **spec docs**. A run must not start writing extension code into this repo — whether the loop does that is B-14, and it is hers to decide. If a run produces code worth keeping, it still goes in the brief as a fenced block.
- **The loop's sandbox cannot reach non-allowlisted hosts.** Web search and fetch work; `curl` to an arbitrary API does not. If a claim needs a live request to verify, tag it `[assumption]`, say in the PRD that it is unverified, and put the verification step in the backlog for Dhwani. Do not quietly assert it.
- **WebFetch needs Dhwani to approve the URL, and these runs are unattended.** Added 2026-10-04 after a fetch of an already-cited source timed out waiting for a permission prompt nobody was awake to answer. Web *search* returns results without approval; fetching a specific page may not. So a run cannot count on reading a page end-to-end. Plan research around search results and pages already quoted in the PRD, and when a claim cannot be verified, tag it rather than citing a link the run never opened.

---

## Brief format

Keep it short. She reads these on a phone.

```markdown
# YYYY-MM-DD

**Focus:** <one line>

## What changed
- <one line per change, naming the PRD section or backlog item>

## What I found
<only if research happened — the finding and its source link>

## Needs from Dhwani
- <the single most useful thing she could answer, or "nothing — keep going">
```

Do not pad a quiet day. "Cut §4 from eleven lines to four, no other changes" is a complete brief.

---

## Changelog

Append one line per run. Never rewrite history.

- **2026-09-27** — Loop created. PRD written from the v3.0 Hoshi PRD, the Job Search Agent spec, the architecture audit, and competitive research. Thesis established: optimize for conversations, not submissions, on 40–65% vs 2–8% interview-rate evidence. Backlog seeded with 10 items. Four Open Questions raised, none guessed.
- **2026-09-28** — B-03 done: discovery engine specified as PRD §8 (adapter interface, fail-closed result shape, field map onto `ExtractedJob`, dedup via `identityKeys` with the page path winning, permission surface). Providers tiered from their docs — Greenhouse, Lever, Ashby documented and unauthenticated; Workday reverse-engineered and shipping `complete: false`. Discovery seeded by companies the user has a person at, not keywords, since no documented provider offers cross-company search anyway. CORS assumption tagged unverified (sandbox egress refused all four hosts) and raised as B-11.
- **2026-09-29** — B-01 done: fit scoring specified as PRD §9. Connection takes 20 of 100, displacing 5 each from role, experience, company and narrative. Tiers score what the person can do today (C3/C2/C1/C0) rather than inferred closeness, because no public data resolves outcomes by connection strength — weights and spacing tagged `[assumption]`, and the one study that looks like a rate is cited with its authors' own warning that it is not. Two CI-blocking invariants bound the term: it re-ranks the qualified set but cannot admit a job below the role-fit floor, and C3 beats company+narrative+location+freshness combined but stays under role+experience. Explanation must name the person or the points are not awarded. B-12 opened (C1 has no evidence source yet). PRD at 287 lines.
- **2026-10-02** — B-04 done: analytics and honesty rules specified as PRD §10. The run's finding is a refusal: at a 5% cold response rate, detecting a move to 15% needs 141 applications per arm, so a single user can never A/B test the application funnel — which is why the metric set leans to the warm path, where §1's base rate is ten times higher, and why the headline metric is person-attached rate (a proportion of her own behaviour, not the market's). Metrics split into counts (exact) and rates (estimates, always with a 95% Wilson interval). Seven honesty rules replace "do not claim causality without enough data", including no percentage under n=10 and insufficient-data states that name the shortfall as a number. §5 point 5 rewritten: it promised Hoshi could show which change moved the response rate, which the arithmetic says it cannot. §10.4 concedes that B-04 cannot falsify §9.1's connection weight at single-user scale and records the two weaker substitutes, so no later run claims the `[assumption]` was retired. B-13 opened (Activity must render counts and rates differently). No run on 09-30 or 10-01. PRD at 368 lines. **Also: the "pushes are refused" hard constraint was tested and is false** — the four spec docs are now committed and pushed to `master` (88dbb01). The constraint above is rewritten to match; B-14 raises whether the loop should start writing extension code, which is Dhwani's call and not the loop's.
- **2026-10-03** — B-02 done: the Daily Brief specified as PRD **§7**, taking the slot of the old four-line backlog pointer and moving ahead of §8–§10, because the brief is the only surface opened daily and the engines exist to fill it. Three blocks, fixed order, hard caps: conversations (3), promoted jobs with their §9.4 score line (5), one collapsed "also open" line. The caps are the substantive half, not the ordering: a Monster survey of 1,006 US job seekers found 48% apply without reading the full description and 32% spend under a minute on a posting, so reordering an unbounded feed only moves the thirty-second applying further down it — the caps are tagged `[assumption]`, the evidence for bounding the list is not. Promotion requires role fit ≥ 15 of 25 **and** either the priority threshold or tier ≥ C1; block 3 carries no score, since a number beside an unpromoted job is an invitation to apply in thirty seconds. Block 1 rows must name a person and a stored reason or they do not render. The brief shows counts and never rates (§10.3 rules 2 and 3 do not survive beside a CTA at 360px), which narrowed B-13 to Activity only. Promotion rules moved out of §8.1. **B-15 opened: the "priority threshold" is referenced in §5.2 and §7.2 and defined nowhere**, so today the cap filters and the score does not. Saturday's competitive-research slot was skipped under run-order rule 2 — B-02 was high priority and all three of its dependencies now existed — though the Monster finding is competitive evidence in substance. PRD at 398 lines.
- **2026-10-04** — Sunday cut, and nothing else. Neither high-priority item was available to the loop (B-11 needs a request the sandbox cannot make, B-15 needs a judgment that is Dhwani's), so the rotation stood. **§2 "Where the category fails" cut from thirteen lines to three**, 398 → 388. It was the weakest section by the only test that matters here: it produced no requirement. Three of its five rows went, recorded as **R-01** in the backlog so no Saturday run re-adds them — the Teal paywall row and the Jobright billing row each had "not a monetization question yet" written into the answer column, which is a row that costs lines and buys nothing until Q3 says what Hoshi ships as; the LazyApply row restated §1's citation and Principle 1 verbatim. The two survivors (no discovery at Huntr, generic output at Simplify and Jobright) are now prose, and newly tagged: they come from review aggregation rather than a citable study, so at the per-tool level they are `[assumption]` and carry direction, not measurement. The old table asserted all five flatly under one unsourced header line, which is the exact failure mode the "untagged assumption" rule exists to catch — so the cut made the section more honest as well as shorter. Also added a hard constraint: **WebFetch requires an approval these unattended runs cannot get**, learned when a fetch of the already-cited RemoteHunt comparison timed out waiting for a prompt; the run tagged the claim instead of citing a page it never opened.
