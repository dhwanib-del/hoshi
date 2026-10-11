# Hoshi — Product Requirements

**Living document.** Improved daily by the Hoshi Loop. Last substantive revision: 2026-10-11.

---

## 1. The thesis

Every tool in this category optimizes the wrong number.

Simplify, Teal, Huntr, Jobright and LazyApply all compete on applications sent, forms filled, or resumes scanned. The evidence says that is the low-leverage end of the funnel:

| Path | Interview rate |
| --- | --- |
| Referred candidate | 40–65% |
| Cold application | 2–8% |

Referred candidates who reach an interview are also 2–4x more likely to receive an offer ([refer.me summary of NBER data](https://www.refer.me/blog/do-job-referrals-actually-work-data-behind-response-rates)). That is a 5–10x difference in the thing that actually matters. LazyApply's volume approach is documented as producing *weak* response rates despite high submission counts ([RemoteHunt comparison](https://remotehunt.app/blog/best-ai-job-search-tools-2026)).

**One competitor has noticed, and where it put the feature is the whole difference.** Jobright ships "Insider Connections": for a job it has already matched, it surfaces contacts at that company and drafts a referral email ([wobo review](https://www.wobo.ai/blog/jobright-review/)). It is **step five of its flow**, after matching, tailoring and autofill ([HiringReach](https://hiringreach.com/reviews/jobright-ai-review), which sells a competing product and discloses it — so its criticisms of the feature are `[assumption]`, but the position is corroborated by the wobo review above, which also describes the contacts as surfaced per already-matched job). So the claim this document can defend is not that nobody does referrals. It is that **nobody makes the person an input.** A connection step that runs after the job is chosen can only decorate a ranking that already happened — it cannot change which jobs were found, or which one is at the top this morning.

**Hoshi's position: optimize for conversations, not submissions.**

An application sent without a conversation is the 2–8% path. Hoshi's job is to make the 40–65% path the default one — find the role, find the person, make the message worth sending, and keep the application itself cheap enough that it stops being where the user's time goes.

This is the one sentence the rest of the document answers to. A feature that increases applications per week without increasing conversations per week is not a Hoshi feature.

### What this means concretely

- The Stardust economy already encodes this: outreach pays 40, a submission pays 15 and decays after five per day. That was the right instinct and it should extend to the whole product surface.
- The Daily Brief leads with *who to talk to*, not only *what to apply to*. Specified in §7.
- A job with a warm connection outranks a job with a higher raw fit score, up to a bounded limit. Specified in §9.
- The warm path is also the only part of the funnel a single user generates enough data to measure. §10.1.

---

## 2. Where the category fails

Two failures from the 2026-09-27 competitive read are live constraints on this build; the rest of that read is in §1. **Discovery** is the gap Hoshi has not filled — Huntr makes the user find every listing, and §8 is the answer. **Generic output** is the failure Principle 2 already prevents — Simplify and Jobright are both reviewed as needing heavy editing, extended by B-06. Both are review aggregation rather than a citable study ([RemoteHunt](https://remotehunt.app/blog/best-ai-job-search-tools-2026) is the closest), so at the per-tool level they are `[assumption]` and carry direction, not measurement. Monetization and billing practice — Teal's paywall, Jobright's billing complaints — are cut from this document until Q3 says what Hoshi ships as.

---

## 3. Product principles

These are enforced in code and covered by tests. They are not aspirations.

1. **Never auto-submit.** The final submit is the user's, always. Enforced by `mayMarkApplied`.
2. **Never fabricate.** No invented experience, no skill added because a posting mentions it, no unsupported keyword inserted. Unsupported keywords are labelled and left out.
3. **Never touch demographic fields.** The profile schema has no key for race, gender, disability or veteran status. A test walks the object at every depth to keep it that way.
4. **Never read a page outside scope.** Content scripts register only against granted job-site hosts. An out-of-scope page produces no DOM read at all.
5. **Fail closed.** Every model failure path — timeout, network error, malformed JSON, out-of-range confidence — resolves to no action, never to a guess.
6. **Show the work.** Every classification is inspectable; every extracted field records where it came from; every suggestion shows the shared context that produced it.

---

## 4. Current state

Verified by test run, not asserted. 241 tests passing as of 2026-09-27.

**Built and working:**

- Three-stage classification pipeline. 38-page labelled corpus reports 100% recall, 0% false positives, 100% resolved without a model call.
- Job recognition across nine ATS vendors by URL fingerprint, plus structured-data and DOM extraction with per-field provenance.
- Autofill with review-before-submit, including the protected-fields group that is left deliberately blank.
- Stardust economy with a CI-blocking balance invariant: a maximum-volume day (220) can never out-earn a quality day (265).
- Contacts, alumni ranking with visible shared context, outreach tracking and drafting.
- Durable storage — all four stores survive a service-worker restart.
- Career Search Profile with role lanes and explainable eligibility rejection.
- Side panel: Orbit, Jobs, People, Activity, plus the autofill review sub-page.

**Not built:**

- Specified, no code written: Daily Brief (§7), discovery engine (§8), fit scoring (§9), analytics and honesty rules (§10). Each section header carries its own date.
- Not yet specified: resume library and tailoring with diff, answer bank, interview mode.

**Blocked:**

- Classifier backend (`api.hoshi.app`) does not exist. Unfamiliar career pages surface for confirmation rather than resolving. Fails closed, so this costs coverage, not correctness.
- Generation backend does not exist. Cover letters, free-text answers and outreach drafts cannot run.

---

## 5. What "best" would mean

A definition worth measuring against, so the loop has a target rather than a direction.

Hoshi is the best job-finding tool when, for a user like its first one:

1. **Time from opening the browser to a submitted, tailored application is under 10 minutes** — and most of those minutes are the user reading, not typing.
2. **Every application above the priority threshold has at least one real person attached to it** before it is submitted.
3. **The user can answer "why this job?" for every job in their pipeline** without re-reading the posting, because Hoshi already told them.
4. **Nothing in the pipeline is a surprise** — no silently rewritten resume, no guessed answer, no application the user does not remember making.
5. **The user's response rate goes up over a season, and Hoshi is honest about how much of that it can and cannot attribute.**

Numbers 1–4 are testable today. Number 5 is specified in §10 — and §10.1 is why its original wording, "Hoshi can show which change moved it", was a promise one user's data cannot keep.

---

## 6. Open questions

Carried by the loop until answered. The loop must not guess these.

- **Q1.** Is Hoshi for Dhwani specifically, or for a cohort? This decides whether discovery can be hand-tuned to UX/PM new-grad roles or must stay career-agnostic. The code is currently career-agnostic by design. It also decides whether §9's connection weight is ever falsifiable at all (§10.4).
- **Q2.** Is there a budget for the two backends, or should Hoshi degrade permanently to local-only classification? A local-only Hoshi is a real product with a smaller footprint; a backend Hoshi is a bigger one with running costs.
- **Q3.** Does this ship to the Chrome Web Store, stay a personal tool, or become portfolio work? Each implies a different bar for onboarding, permissions copy, and polish.
- **Q4.** International-student constraints — should sponsorship filtering be a first-class scoring term rather than a pass/fail eligibility gate?

---

## 7. The Daily Brief

Specified 2026-10-03 (B-02). No code written. Renders in Orbit. It sits here, ahead of the engines, because it is the only surface the user opens every day: §8, §9 and §10 exist to fill it. (Backlog: `claude/hoshi/BACKLOG.md`.)

### 7.1 Three blocks, fixed order, hard caps

1. **Today's conversations** — people to message or follow up with. Max 3.
2. **Jobs worth your morning** — promoted jobs, each carrying its §9.4 score line. Max 5.
3. **Also open at companies you're watching** — one collapsed line with a count.

People first is §1 applied to the surface the user actually opens. The caps are the other half: in a Monster survey of 1,006 US job seekers, 48% applied without reading the whole description, 32% spent a minute or less on a posting and 16% under thirty seconds ([HCAMag summary](https://www.hcamag.com/ca/specialization/recruitment/application-overload-half-of-job-seekers-doomjobbing/578466)). An unbounded ranked feed is the input that behaviour runs on, and §5.1's ten minutes only mean something if they are spent reading. `[assumption]` the caps of 3 and 5 specifically.

### 7.2 What gets promoted, and what the brief never shows

A job enters block 2 only if role fit ≥ 15 of 25 (§9.3 invariant 1) **and** either total fit clears the priority threshold **or** connection tier is C1 or better. Everything else falls to block 3, ordered by company. Block 2 sorts by §9 score descending; ties break to the higher connection tier, then freshness (B-07). **Block 3 never shows a score or a fit label** — a number beside an unpromoted job invites exactly the one-minute apply the caps exist to prevent.

### 7.3 Block 1 rows come from Hoshi's stores, never from a model

Each row names a person, the shared context, and why today. Four types, in priority order: **reply waiting** (they answered, the user has not); **follow-up due** (sent ≥ 7 days ago, no reply, not yet followed up once — `[assumption]` the 7 days); **new role where a C2 or better already exists** (the job is the excuse, the conversation is the point); **decaying** (a C2 at day 18 of §9.2's 21-day clock — message now or the score stops claiming warmth). A row that cannot name a person *and* cite a stored reason is not shown, which puts Principles 2 and 6 on the brief itself and not only on generated text.

### 7.4 Counts only, and an empty state with a number in it

Rates stay in Activity. Two reasons, both from §10.3: a rate must carry its 95% interval at the same type size, which does not survive beside a CTA at 360px, and a daily surface invites the period-over-period comparison rule 3 forbids unless the intervals are disjoint. "Your reply rate is up" is a spec violation on this surface, not a copy choice. When both top blocks are empty the brief gives the shortfall as a number (rule 6) — `nothing today — 0 new postings across your 6 watched boards since yesterday, and no contact due before Tue` — never a filler suggestion, never a padded list.

```
Orbit · Sat 3 Oct
TODAY'S CONVERSATIONS
Priya Raman — UMSI '23 · replied 12 Sep, you haven't answered
Marcus Lee — UMSI '21 · sent 4 Sep, 24 days, no reply — follow up once
JOBS WORTH YOUR MORNING
Product Designer, Figma · 78 · +20 Priya Raman — replied 12 Sep
UX Researcher II, Duolingo · 71 · +14 Marcus Lee — no reply yet
▸ Also open at companies you're watching — 11
```

---

## 8. Discovery engine

Specified 2026-09-28 (B-03). No code written.

### 8.1 Discovery is seeded by companies, not keywords

Hoshi does not crawl the job market. It watches a list of boards the user has a reason to care about. A board source enters that list when a ranked alum or existing contact works there, or when the user adds it by hand.

This is the thesis applied to sourcing. A keyword crawl produces more applications; a company watchlist produces more conversations, because every source on the list already has a person attached to it. It is also the only version that is actually available: every documented provider in §8.2 is a *per-company* endpoint. None of them offers cross-company search, so a keyword crawl was never on the table regardless.

### 8.2 Providers

| Adapter | Endpoint | Auth | Coverage |
| --- | --- | --- | --- |
| Greenhouse | `GET boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | none — job board data is public and "authentication is not required for any GET endpoints" ([docs](https://docs.greenhouse.io/job-board.html)) | documented |
| Lever | `GET api.lever.co/v0/postings/{site}?mode=json` | none for listing; a key is needed only to POST an application ([docs](https://github.com/lever/postings-api/blob/master/README.md)) | documented |
| Ashby | `GET api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true` | none documented ([docs](https://developers.ashbyhq.com/docs/public-job-posting-api)) | documented |
| Workday | `POST {tenant}.{pod}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs` | none | **undocumented** |

Workday publishes no job-board API. The endpoint above is reverse-engineered, and it carries hard limits: `limit` caps at 20 per request, `total` is capped at 2,000 rather than being a true count, and only the first page returns `total` at all ([writeup](https://dev.to/dododata/scraping-workday-career-sites-without-a-browser-and-the-2000-job-ceiling-h2e)). B-03 required that this adapter "say so rather than degrade silently" — that is `complete: false` in §8.3, surfaced in the UI as **partial board** with the reason visible. An undocumented endpoint may also change without notice, so its adapter is the one allowed to fail permanently without that counting as a Hoshi bug.

LinkedIn and Indeed get no adapter. Scraping the platform the user's network lives on risks the account they need most, which is a bad trade under a thesis about conversations. `[assumption — a risk judgment, not a reading of either ToS]`

### 8.3 Adapter interface

```ts
type Coverage = 'documented' | 'undocumented';

interface DiscoveryAdapter {
  id: 'greenhouse' | 'lever' | 'ashby' | 'workday';
  coverage: Coverage;
  // Board handle as the provider spells it: Greenhouse token, Lever site,
  // Ashby board name, Workday {tenant, pod, site}.
  listJobs(source: BoardSource, opts: { since?: ISODate }): Promise<AdapterResult>;
}

interface AdapterResult {
  jobs: ExtractedJob[];          // §8.4 — identical shape to the page path
  complete: boolean;             // false = this is not the whole board
  truncated?: 'provider-cap' | 'page-limit' | 'rate-limit';
  errors: { stage: string; message: string }[];
}
```

**Fail closed (Principle 5).** A non-2xx, a timeout, or a response that does not match the provider's expected schema returns `jobs: []` with a populated `errors` array. An adapter never returns a partially-parsed job, and never infers a missing field. A board that errors shows as errored, not as empty.

### 8.4 Normalisation

Every adapter emits the same `ExtractedJob` shape that `extractJob` produces from a live page, so one normaliser serves both paths and downstream code cannot tell where a job came from except by reading its provenance.

| `ExtractedJob` field | Greenhouse | Lever | Ashby |
| --- | --- | --- | --- |
| `title` | `title` | `text` | `title` |
| `location` | `location.name` | `categories.location` | `location` |
| `applyUrl` | `absolute_url` | `applyUrl` | apply URL |
| `descriptionHtml` | `content` (needs `content=true`) | description variants | HTML description |
| `providerJobId` | `id` | `id` | posting id |
| `employmentType` | — | `categories.commitment` | employment type |
| `workplaceType` | — | `workplaceType` | workplace type |

Field names are taken from the linked docs; verify each against one live response before writing the adapter. Note for B-07: Greenhouse exposes `updated_at`, which is **not** a posted date — a reposted role looks fresh. Ashby exposes a publish date. Any freshness band built on these must record which of the two it got, or it will quietly lie.

`provenance` is populated for every field on this path as `{ source: 'discovery', adapter, path }`, where `path` is the response key the value came from — the same contract the DOM path satisfies with a selector (Principle 6).

### 8.5 Dedup

Reuse `identityKeys`. Match in order, first hit wins:

1. canonical `applyUrl` (strip query and fragment)
2. `{ adapter, providerJobId }`
3. normalised `{ company, title, location }`

**A page-extracted job always wins over a discovered one.** The page the user actually opened is the higher-fidelity record; discovery fills empty fields on the existing job and leaves populated ones alone, so provenance never degrades from a selector to a guess.

### 8.6 Permission surface

The four hosts go in `optional_host_permissions`, requested at the moment the user adds their first board source, never at install. This does not touch Principle 4: discovery runs `fetch` from the service worker against a public API. No content script is registered, no page DOM is read, and no tab the user opened is involved.

`[assumption]` These endpoints are built for browser-side embedding and are expected to send permissive CORS headers, in which case `host_permissions` covers the request without a proxy. **Unverified** — this sandbox's egress allowlist refuses all four hosts, so it could not be tested here. One `curl -I` with an `Origin` header from an ordinary network settles it, and it should be settled before any adapter is written, because a CORS refusal on a documented provider would force a backend hop and change §8's cost profile entirely (Backlog B-11).

---

## 9. Fit scoring

Specified 2026-09-29 (B-01). No code written.

### 9.1 The connection term

The earlier model had no term for whether the user knows anyone at the company, which contradicts §1: a ranking that cannot see the referral path ranks for the wrong funnel. **Connection enters at 20 of 100**, taken from the four terms that predict fit but not conversation — role match, because above the role-fit floor the distribution is dense and the top points do little separating; experience match, which is heavily correlated with role match, so the pair was double-counting one signal; and company and narrative, which overlap role match and were partly proxying for "the user has a person there" — the thing connection now says outright.

Role 25 · eligibility 20 · **connection 20** · experience 10 · company 5 · narrative 5 · location 5 · authorization 5 · freshness 5. Sums to 100. Eligibility is a hard gate; authorization is one too, pending Q4 / B-05; freshness is scored and still unconsumed (B-07).

`[assumption]` The specific weights. No public dataset breaks hiring outcomes down by connection strength, so 20 is a judgment sized against the evidence in §1, not derived from it. §10.4 is the finding that one user's analytics cannot retire this tag — only a cohort can.

### 9.2 Tiers — scored by what the person can do

Connection is tiered by the action available to the user today, not by an inferred closeness score. A closeness score would be a guess about a relationship Hoshi cannot see.

| Tier | Definition | Points |
| --- | --- | --- |
| **C3** | A contact at the company who has replied to the user, or is recorded as willing to refer | 20 |
| **C2** | A ranked alum or saved contact at the company, contacted or not, no reply yet | 14 |
| **C1** | A named person at the company that Hoshi surfaced but the user has not saved — the recruiter on the posting, an alum in the ranked list | 8 |
| **C0** | No named person | 0 |

`[assumption]` The tier boundaries and their spacing. The sourced claim is the referral-vs-cold gap in §1; the interior gradient is not sourced, because the data does not exist at that resolution. An observational study of 79 published outreach accounts is the closest public thing, and its authors state plainly that its numbers are not rates — the corpus is self-selected toward unusually good and unusually bad outcomes ([dearhiringmanager.io](https://dearhiringmanager.io/hiring-manager-outreach-study)). It is not a basis for a weight, and is cited here so nobody later mistakes it for one.

**Decay.** A C2 with no reply after 21 days degrades to C1: an unanswered message is information about the path, and the score should stop claiming a warmth that did not materialise. C3 never decays — the reply already happened. `[assumption]` the 21 days. Because the tier therefore changes without the user doing anything, it cannot be read back from current state when measuring (§10.3 rule 8, §10.5).

### 9.3 Two invariants

These are the testable part. Both should be CI-blocking, in the shape of the existing Stardust balance test.

1. **Connection re-ranks the qualified set; it does not admit to it.** A job below the role-fit floor (role < 15 of 25) never enters the Daily Brief, whatever its connection tier. Knowing someone at a company whose roles the user cannot do is not an opportunity, and a scoring model that lets C3 drag unqualified jobs upward would produce exactly the pipeline §5.4 forbids.
2. **Connection is decisive among comparable jobs and nowhere else.** `C3 (20) == company + narrative + location + freshness (20)` and `C3 (20) < role + experience (35)`. So among jobs of similar role fit, a job with a replied-to contact cannot be *outscored* on the four soft terms — at worst it ties, and §7.2's first tiebreak is the higher connection tier, so it still leads — while a clearly better-fitting job still beats a clearly worse one with a friend attached. The equality is deliberate and the test is `==`, not `>`: this clause read *exceeds* until 2026-10-11, which is false arithmetic and a test written from it would have failed.

Together these two bound the term: strong enough to change the daily ordering, too small to corrupt it.

### 9.4 Explanation

Under Principle 6 the connection term must name its evidence, in the line the user reads:

```
+20 · Priya Raman — UMSI '23, Design Systems, replied 12 Sep
+14 · Marcus Lee — UMSI '21, no reply yet (sent 4 Sep)
 +8 · Dana Patel, UMSI '20 — from your ranked alum list, not yet saved
 +0 · nobody found at this company
```

Never `+20 · strong connection`. **If Hoshi cannot name the person, it cannot award the points** — which makes the no-fabrication rule (Principle 2) enforceable on the score itself, not only on generated text. The same display is what makes §5.3 true: "why this job?" is answered by the score line, without reopening the posting.

**C1 alone must also name where the person came from**, as in the third line above, because C1 is the one tier Hoshi sources instead of the user: the same `provenance` contract as §8.4's fields, applied to a person rather than a string. The shipped competitor version of this tier states no data source and no verification standard (§1), which is the failure Principle 6 exists to prevent, so an unprovenanced C1 awards 0 and not 8. That turns B-12 from "find a source for C1" into "find one Hoshi can name in that line" — and it rules out the easy answer, since §8.2 gives LinkedIn no adapter.

---

## 10. Analytics and honesty rules

Specified 2026-10-02 (B-04), extended 2026-10-09 with rule 8 and §10.5. No code written. Renders in the Activity destination; the Daily Brief surface is §7.

### 10.1 The sample size decides the metric set

One user is a small sample, and that fact has to come before the choice of metrics rather than after it. To detect a change in a rate at conventional 80% power and α = 0.05 (two-sided two-proportion test), the events needed in *each* arm:

| Rate | Change to detect | n per arm |
| --- | --- | --- |
| Application → response | 5% → 10% | 435 |
| Application → response | 5% → 15% | 141 |
| Outreach → reply | 25% → 50% | 58 |

Computed, not sourced — the standard normal-approximation two-proportion formula; the script is in the 2026-10-02 brief, so the numbers can be rechecked rather than trusted.

A job seeker does not send 282 applications in a season, and if she did, the season would end before the comparison resolved. **Hoshi cannot A/B test its own application funnel for a single user. Not slowly — not at all.** Any dashboard that implies otherwise is misreporting its sample size, and that is the specific failure this section exists to prevent.

What one user *can* measure is a rate with a high base. §1 puts the warm path at 40–65% against 2–8% cold; a base rate an order of magnitude higher needs roughly an order of magnitude fewer events for the same relative change. That is the difference between impossible and by December — and it is a second, independent reason the metric set leans toward conversations, on top of §1: conversations are the only stretch of the funnel where one person's numbers ever mean anything.

### 10.2 Metric set

Two kinds, and the difference must be visible in the UI.

**Counts — exact, no interval.** These record what happened.

| Metric | Why it is here |
| --- | --- |
| Outreach sent, replies received, per week | the thesis' numerator |
| Applications submitted | the number every competitor leads with; here it is context, not a score |
| Applications submitted **with a named person attached before submit** (§10.5) | §5.2 is pass/fail per application, and this is the count |
| Screens and interviews reached | the end of the funnel |
| Median time from job page opened to submit | §5.1's ten-minute target |

**Rates — estimates, always with an interval.** These are inferences about a true value from a small n.

| Rate | Denominator |
| --- | --- |
| Reply rate | outreach sent |
| Person-attached rate | applications submitted |
| Response rate by connection tier **as recorded at submit** (§10.5) | applications in that tier |

**Person-attached rate goes at the top.** It is a proportion of the user's own behaviour rather than the market's response, so it moves the same week, it is entirely under her control, and it measures whether she is running the thesis or merely agreeing with it.

### 10.3 Honesty rules

Concrete, replacing the earlier spec's "do not claim causality without enough data".

1. **No percentage below n = 10.** Show `3 of 7`, never `43%`. The floor is not where precision starts, either: 3 of 10 is `30% (11–60%)`.
2. **Every rate carries its 95% Wilson interval, same line, same type size.** A bare rate is a false claim of precision. Six replies from twenty sends is `30% (15–52%)`, and that width *is* the finding. Twelve of forty is still `30% (18–45%)`.
3. **No causal or comparative language unless the two intervals are disjoint.** Otherwise the copy reads `30% → 45%, inside the range chance produces at this volume`. No "because", no "up", no arrow.
4. **No trend line or sparkline over fewer than four periods that each clear n = 10.**
5. **No external benchmark Hoshi cannot source.** No "top 20% of applicants", no percentile against users Hoshi has never seen.
6. **Insufficient data states the shortfall as a number** (Principle 5): `not enough yet — 14 more sends before this rate means anything`. Never a blank, a zero, or a greyed-out 0%.
7. **Counts and rates never share a visual treatment.** A count is a fact and a rate is an estimate; if Activity renders them identically, rule 2 is decoration.
8. **No count or rate may read a value that can change after the event it describes.** Connection tier decays and upgrades (§9.2), person-attached status can be earned late, and the weights themselves are `[assumption]` and will move — so a metric derived from current state describes today's contacts, not the submission it claims to. §10.5 is the record this rule requires. Without it, the tier table above and the headline rate above it are not computable honestly and must not be shown at all.

### 10.4 What this does, and does not do, for §9

B-04 was given one specific job: make the 20-of-100 connection weight in §9.1 falsifiable. **For a single user it cannot.** A season's applications split four ways leaves every tier far under the 141 of §10.1, and the two tiers that matter most, C3 and C2, are the rarest.

The weight gets two weaker tests instead, each honest about which it is:

1. **Behavioural, available immediately.** Of the jobs the connection term lifted to the top of the brief, which did the user act on, and did she reach out before applying? If the term reorders her day and she follows the new order, it is working as a prioritisation device whatever its effect on outcomes. This is a count, not a rate, so §10.3 rule 1 does not block it.
2. **Outcome, available only at cohort scale.** Comparing response rate across tiers needs many users' applications pooled. Whether that is ever possible is **Q1 and Q3** — a personal tool cannot run this test and a Chrome Web Store product can. It is not an engineering question.

So §9.1's weights keep their `[assumption]` tag, and no future run should claim analytics retired it. Recorded here to stop exactly that.

### 10.5 What has to be recorded at the event

Rule 8 is a schema requirement, not a display rule, and the reason is that the error it prevents has a direction: it flatters §9.1. If Activity builds §10.2's tier table by joining each application to its contact's *current* tier, then a C2 whose alum replies after the application — including a reply the application itself caused — becomes a C3, so that submission is counted in the C3 bucket precisely because it worked. Meanwhile a C2 that went nowhere decays to C1 at day 21 (§9.2). C2's successes leave upward, its failures leave downward, and applications where a person was only saved afterwards leave C0 entirely. The gradient C3 > C2 > C1 > C0 then appears whether or not connection does anything — and that gradient is exactly what §9.1's weight predicts. A metric that cannot fail to confirm the hypothesis it is testing is worse than no metric, and this is the one outcome-flavoured measurement §10.4 left available at single-user scale.

The same error hits the headline metric. §5.2's bar is a person attached **before** the application is submitted; person-attached rate read from current state counts a contact saved a week later, so it reads high while measuring something §5 does not ask for.

So: one append-only record, written once at `mayMarkApplied` (Principle 1) and never recomputed or backfilled.

```ts
interface SubmissionRecord {
  jobId: string;
  at: ISODate;
  personAttached: { contactId: string; tier: 'C3' | 'C2' | 'C1' } | null;
  roleFit: number;         // of 25 — §9.1, and §7.2's promotion gate
  totalScore: number;      // of 100
  weightsVersion: string;  // §9.1's weights are [assumption]; they will change
}
```

Outcomes — response, screen, interview — attach by `jobId` with their own timestamps and never rewrite a field above; that append-only store is B-16. `weightsVersion` is here because a rate pooled across two weight tables is two rates: Activity segments by version or states that it did not. §10.4's behavioural test needs the same treatment — "the jobs the connection term lifted" is a property of the brief on the morning it rendered, not of today's scores, so the promoted set is recorded with the brief.

---

## Sources

- [Do Job Referrals Actually Work? Data Behind Response Rates — refer.me](https://www.refer.me/blog/do-job-referrals-actually-work-data-behind-response-rates)
- [Why Job Referrals Beat Cold Applications According to Data — refer.me](https://refer.me/blog/why-job-referrals-beat-cold-applications-according-to-data)
- [Does Emailing the Hiring Manager Work? 79 Outcomes Analyzed — dearhiringmanager.io](https://dearhiringmanager.io/hiring-manager-outreach-study)
- [Best AI Job Search Tools in 2026: Honestly Compared — RemoteHunt](https://remotehunt.app/blog/best-ai-job-search-tools-2026)
- [Jobright AI Review 2026: We Tested It — wobo.ai](https://www.wobo.ai/blog/jobright-review/)
- [Jobright AI Review 2026 — HiringReach (a disclosed Jobright competitor)](https://hiringreach.com/reviews/jobright-ai-review)
- [Cold applying is still the No. 1 way to get a new job — CNBC](https://www.cnbc.com/2026/01/12/cold-applying-is-still-the-no-1-way-to-get-a-new-job-but-this-method-is-quickly-getting-more-common.html)
- [Application overload: half of job seekers 'doomjobbing' (Monster, n=1,006) — HCAMag](https://www.hcamag.com/ca/specialization/recruitment/application-overload-half-of-job-seekers-doomjobbing/578466)
- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html)
- [Lever Postings API](https://github.com/lever/postings-api/blob/master/README.md)
- [Ashby Public Job Posting API](https://developers.ashbyhq.com/docs/public-job-posting-api)
- [Scraping Workday career sites without a browser, and the 2,000-job ceiling](https://dev.to/dododata/scraping-workday-career-sites-without-a-browser-and-the-2000-job-ceiling-h2e)
