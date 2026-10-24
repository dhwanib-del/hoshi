# Hoshi — Product Requirements

**Living document.** Improved daily by the Hoshi Loop. Last substantive revision: 2026-10-24.

---

## 1. The thesis

Every tool in this category optimizes the wrong number.

Simplify, Teal, Huntr, Jobright and LazyApply all compete on applications sent, forms filled, or resumes scanned. The evidence says that is the low-leverage end of the funnel: a referred candidate interviews at **40–65%** against a cold application's **2–8%**, and referred candidates who reach an interview are 2–4x more likely to receive an offer ([refer.me summary of NBER data](https://www.refer.me/blog/do-job-referrals-actually-work-data-behind-response-rates)). That is a 5–10x difference in the thing that actually matters. LazyApply's volume approach is documented as producing *weak* response rates despite high submission counts ([RemoteHunt comparison](https://remotehunt.app/blog/best-ai-job-search-tools-2026)).

**One competitor has noticed, and where it put the feature is the whole difference.** Jobright ships "Insider Connections": for a job it has already matched, it surfaces contacts at that company and drafts a referral email ([wobo review](https://www.wobo.ai/blog/jobright-review/)). It is **step five of its flow**, after matching, tailoring and autofill ([HiringReach](https://hiringreach.com/reviews/jobright-ai-review), which sells a competing product and discloses it — so its criticisms of the feature are `[assumption]`, but the position is corroborated by the wobo review above, which also describes the contacts as surfaced per already-matched job). So the claim this document can defend is not that nobody does referrals. It is that **nobody makes the person an input.** A connection step that runs after the job is chosen can only decorate a ranking that already happened — it cannot change which jobs were found, or which one is at the top this morning.

**Hoshi's position: optimize for conversations, not submissions.**

An application sent without a conversation is the 2–8% path. Hoshi's job is to make the 40–65% path the default one — find the role, find the person, make the message worth sending, and keep the application itself cheap enough that it stops being where the user's time goes.

This is the one sentence the rest of the document answers to. A feature that increases applications per week without increasing conversations per week is not a Hoshi feature.

Applied: the Stardust economy already pays outreach 40 against a submission's 15, decaying after five a day; the Daily Brief leads with *who to talk to* (§7); a job with a warm connection outranks a job with a higher raw fit score, up to a bounded limit (§9); and the warm path is the only stretch of the funnel a single user generates enough data to measure (§10.1).

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
- Durable storage — all four stores survive a service-worker restart. All four hold *current* state; the event log in §10.5 is a fifth with different rules.
- Career Search Profile with role lanes and explainable eligibility rejection.
- Side panel: Orbit, Jobs, People, Activity, plus the autofill review sub-page.

**Not built:**

- Specified, no code written: Daily Brief (§7), discovery engine (§8), fit scoring (§9), analytics, honesty rules and the event log (§10), answer bank (§11). Each section header carries its own date.
- Not yet specified: resume library and tailoring with diff, interview mode.

**Blocked:**

- Classifier backend (`api.hoshi.app`) does not exist. Unfamiliar career pages surface for confirmation rather than resolving. Fails closed, so this costs coverage, not correctness.
- Generation backend does not exist. Cover letters, free-text answers and outreach drafts cannot run.

---

## 5. What "best" would mean

Hoshi is the best job-finding tool when, for a user like its first one:

1. **Time from opening the browser to a tailored application reviewed and ready to submit is under 10 minutes** — and most of those minutes are the user reading, not typing. The interval ends at review because that is the last moment Hoshi observes (§10.5).
2. **Every application above the priority threshold has at least one real person attached to it** before it is submitted.
3. **The user can answer "why this job?" for every job in their pipeline** without re-reading the posting, because Hoshi already told them.
4. **Nothing in the pipeline is a surprise** — no silently rewritten resume, no guessed answer, no application the user does not remember making.
5. **The user's response rate goes up over a season, and Hoshi is honest about how much of that it can and cannot attribute.**

Numbers 1–4 are testable today. Number 5 is specified in §10, and bounded by §10.1: one user's data cannot show which change moved a response rate.

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

A job enters block 2 only if role fit ≥ 15 of 25 (§9.3 invariant 1) **and** either total fit clears the priority threshold **or** connection tier is C1 or better. Everything else falls to block 3, ordered by company. Block 2 sorts by §9 score descending; ties break to the higher connection tier, then to freshness under §9.5's narrowing. **Block 3 never shows a score or a fit label** — a number beside an unpromoted job invites exactly the one-minute apply the caps exist to prevent. The promoted set is recorded as it rendered (§10.5).

### 7.3 Block 1 rows come from Hoshi's stores, never from a model

Each row names a person, the shared context, and why today. Four types, in priority order: **reply waiting** (they answered, the user has not); **follow-up due** (sent ≥ 7 days ago, no reply, not yet followed up once — `[assumption]` the 7 days); **new role where a C2 or better already exists** (the job is the excuse, the conversation is the point); **decaying** (a C2 at day 18 of §9.2's 21-day clock — message now or the score stops claiming warmth). A row that cannot name a person *and* cite a stored reason is not shown, which puts Principles 2 and 6 on the brief itself and not only on generated text.

### 7.4 Counts only, and an empty state with a number in it

Rates stay in Activity. Two reasons, both from §10.3: a rate must carry its 95% interval at the same type size, which does not survive beside a CTA at 360px, and a daily surface invites the period-over-period comparison rule 3 forbids unless the intervals are disjoint. "Your reply rate is up" is a spec violation on this surface, not a copy choice. When both top blocks are empty the brief gives the shortfall as a number (rule 6) — `nothing today — 0 new postings across your 6 watched boards since yesterday, and no contact due before Tue` — never a filler suggestion, never a padded list.

---

## 8. Discovery engine

Specified 2026-09-28 (B-03). No code written.

### 8.1 Discovery is seeded by companies, not keywords

Hoshi does not crawl the job market. It watches a list of boards the user has a reason to care about: a board source enters that list when a ranked alum or existing contact works there, or when the user adds it by hand (§8.7). That is the thesis applied to sourcing — a keyword crawl produces more applications, a company watchlist produces more conversations, because every source on it already has a person attached — and it is also the only shape available, since every documented provider in §8.2 is a *per-company* endpoint with no cross-company search.

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

Field names are taken from the linked docs; verify each against one live response before writing the adapter. Dates are the exception that needed its own rule: Greenhouse exposes `updated_at`, which is **not** a posted date, and Ashby exposes a publish date, so every job records which of the two it got — §9.5 is the term that consumes it and the cap that keeps it honest.

`provenance` is populated for every field on this path as `{ source: 'discovery', adapter, path }`, where `path` is the response key the value came from — the same contract the DOM path satisfies with a selector (Principle 6).

### 8.5 Dedup

Reuse `identityKeys`. Match in order, first hit wins: canonical `applyUrl` with query and fragment stripped, then `{ adapter, providerJobId }`, then normalised `{ company, title, location }`.

**A page-extracted job always wins over a discovered one.** The page the user actually opened is the higher-fidelity record; discovery fills empty fields on the existing job and leaves populated ones alone, so provenance never degrades from a selector to a guess.

### 8.6 Permission surface

The four hosts go in `optional_host_permissions`, requested at the moment the user adds their first board source, never at install. This does not touch Principle 4: discovery runs `fetch` from the service worker against a public API. No content script is registered, no page DOM is read, and no tab the user opened is involved.

`[assumption]` These endpoints are built for browser-side embedding and are expected to send permissive CORS headers, in which case `host_permissions` covers the request without a proxy. **Unverified** — this sandbox's egress allowlist refuses all four hosts, so it could not be tested here. One `curl -I` with an `Origin` header from an ordinary network settles it, and it should be settled before any adapter is written, because a CORS refusal on a documented provider would force a backend hop and change §8's cost profile entirely (Backlog B-11).

### 8.7 Resolving a company to a board handle

Added 2026-10-12. §8.1 seeds the watchlist from companies where the user has a person. A person gives a company *name*; every adapter in §8.2 takes a provider *handle* — Greenhouse token, Lever site, Ashby board name, Workday `{tenant, pod, site}` — and no documented provider offers a name→handle lookup. So §8.1's rule does not by itself produce a fetchable board, and Hoshi never closes the gap by trying candidate handles against the API: a request sent to find out whether a handle exists is a guess wearing HTTP's clothes (Principle 5). Three sources, in order:

1. **Harvested from a page the user already opened.** Hoshi fingerprints nine ATS vendors by URL to recognise job pages (§4), and a hosted board URL carries the handle in its path, so the fingerprint that classifies the page yields the handle at no extra cost — no new permission, no second read. Opening one job subscribes the whole board.
2. **A careers URL the user pastes.** Same parse, same rules, and the only route for the case below.
3. **Nothing.** The company stays on the watchlist as **person-only**: it still seeds people and §9's connection term, contributes 0 jobs, and says which it is. It is not dropped and not guessed at.

**The common failure is the embedded board.** Greenhouse tells companies to paste a script tag and *"replace 'bcg' with your job board token"*, and to set the Job Board URL to *"the base URL of the page your job board is embedded on"* — the company's own careers page ([Greenhouse support](https://support.greenhouse.io/hc/en-us/articles/46365908766875-Embed-a-Greenhouse-job-board-on-your-career-site)). The handle is then in the page's script and not in the URL, so rule 1 returns nothing. Hoshi does not go looking for it there: a careers page is out of scope unless granted (Principle 4), and lifting a token out of page JS is exactly the inference §8.4's provenance contract forbids. Embedded boards resolve by rule 2 or stay person-only.

Every `BoardSource` records `handleSource: 'harvested' | 'pasted'` and the URL it was parsed from, so a board that has stopped returning jobs can be told apart from a handle that was never right. `[assumption]` that the handle in a hosted board URL is byte-identical to the API handle for all four providers: it follows from §8.2's endpoint shapes, but no provider documents the equivalence, and the two provider docs that would confirm it could not be opened from this sandbox. Verify it against one live board per provider alongside B-11's CORS check — the same four requests answer both.

### 8.8 Delisting: absence is evidence, but only from a complete response

Added 2026-10-17. Nothing notifies a crawler when a role closes, which is why *"expired postings linger on so many sites"*, while *"the ATS record is what the employer edits, so it reflects status changes fastest"* ([JobsPipe](https://jobspipe.dev/blog/job-aggregator-sites), a vendor of ATS feed data, so tagged `[assumption]` where it praises feeds — the mechanism is not in dispute and Greenhouse's own boards corroborate it by leaving a tombstone page behind). §8.1 already polls those records, so Hoshi gets for free the one signal an aggregator cannot buy, and until today it threw the signal away: §9.5's `> 10 days → 0` band was Hoshi ageing listings out on a timer, which is the same guess by a shorter route. A board poll is therefore a closure observation, on one condition:

- **`complete === true`** → every stored job for that board whose `providerJobId` is absent from the response becomes `closed`, recording `closedAt` and `closedReason: 'delisted'`.
- **`complete === false`, `truncated` set, or `errors` non-empty** → **nothing closes.** A Workday board past its 2,000-job cap (§8.2), a rate-limited page, a schema mismatch or a timeout is a failure to observe and not an observation of absence. This is Principle 5 applied to a negative: failing closed means drawing no conclusion from silence.
- **No board to be absent from** — a page-extracted job at a person-only company (§8.7) — stays `unknown` indefinitely. Three states, never two: `live | closed | unknown`, and `unknown` is never rendered as either of the others.

A closed job leaves both job blocks of the brief (§7.1) and is never promoted, scored or re-ranked; a `live` job whose freshness is 0 is still a job. **Delisting writes no `outcome` event** (§10.5): a posting coming down says nothing about the user's application, the listing's state is not the application's stage, and logging it as `rejected` would invent a result the market never gave — Principle 2 on the event log, where the append-only rule means a fabricated row can never be taken back.

### 8.9 Polling cadence: once a day, bounded by the brief and by the service worker

Added 2026-10-19 (B-18). §8.8 made delisting latency equal to the polling interval, and nothing specified one. The rule is to fetch the documented limit before designing around it, so: **no provider publishes a read limit for these endpoints.** Greenhouse *"publishes no rate limit for its GET endpoints"*, Ashby *"publishes no rate limit for the public job posting endpoint"*, and Lever *"publishes no rate limit for reading postings"* — its only published figure, 2 requests per second, governs application POSTs ([JobsPipe source notes](https://jobspipe.dev/sources/lever.md), a seller of ATS feed data, so tagged where it advises; Workday documents no API at all, §8.2). The interval is therefore not provider-bound, and the absent number is not permission: the ceiling is enforced as behaviour rather than as a rate, so on a 429 or 5xx that board backs off exponentially and that poll closes nothing (§8.8). Volume never came close to binding it either — the arithmetic is in B-18.

**What binds is the brief.** §7 renders once a morning, so a job fetched at noon reaches the user next morning either way, and an interval shorter than the brief's buys latency she cannot see. **One poll per board per day, scheduled to complete before the brief is composed**, plus an immediate poll the moment a handle is harvested or pasted (§8.7) so a new board is not empty for a day. Freshness tolerates that interval: §9.5's date comes from the provider, not from when Hoshi first saw the job, so polling adds no error to the band — only delay before the job can appear, at worst one interval, which still leaves 24 of the top band's 48 hours.

**A failed poll leaves a stale `live`, and it has to say so.** §8.8 closes nothing on an incomplete response, so a board erroring for a week would hold every job `live` on week-old evidence. Each `BoardSource` records `lastCompleteAt` — its last response with `complete === true` — and a job whose board has gone **more than two intervals** without one returns to `unknown`, which is never rendered as `live` or `closed`. A board nobody can reach withdraws its jobs' listing claim instead of asserting one Hoshi stopped checking.

**The limit that does bind is the service worker.** An MV3 worker is terminated after 30 seconds of inactivity, if a single request takes longer than 5 minutes, or if one `fetch` takes more than 30 seconds to respond ([Chrome docs](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)), and `chrome.alarms` will not honour a period under 0.5 minutes in a packed extension ([alarms reference](https://developer.chrome.com/docs/extensions/mv2/reference/alarms)). A cycle is therefore not one loop over the watchlist: boards are fetched one at a time with each result persisted as it lands, so a worker death resumes at the next board rather than restarting, and one hanging board costs its own fetch and nothing else.

---

## 9. Fit scoring

Specified 2026-09-29 (B-01). No code written.

### 9.1 The connection term

The earlier model had no term for whether the user knows anyone at the company, which contradicts §1: a ranking that cannot see the referral path ranks for the wrong funnel. **Connection enters at 20 of 100**, taken from the four terms that predict fit but not conversation — role match, because above the role-fit floor the distribution is dense and the top points do little separating; experience match, which is heavily correlated with role match, so the pair was double-counting one signal; and company and narrative, which overlap role match and were partly proxying for "the user has a person there" — the thing connection now says outright.

Role 25 · eligibility 20 · **connection 20** · experience 10 · company 5 · narrative 5 · location 5 · authorization 5 · freshness 5. Sums to 100. Eligibility is a hard gate; authorization is one too, pending Q4 / B-05; freshness is scored by §9.5.

`[assumption]` The specific weights. No public dataset breaks hiring outcomes down by connection strength, so 20 is a judgment sized against the evidence in §1, not derived from it. §10.4 is the finding that one user's analytics cannot retire this tag — only a cohort can.

### 9.2 Tiers — scored by what the person can do

Connection is tiered by the action available to the user today, not by an inferred closeness score. A closeness score would be a guess about a relationship Hoshi cannot see. `[assumption]` the tier boundaries and their spacing: the sourced claim is §1's referral-vs-cold gap, the interior gradient is not sourced because no public data resolves outcomes at that resolution, and the closest public corpus — 79 self-selected published outreach accounts whose own authors state its numbers are not rates ([dearhiringmanager.io](https://dearhiringmanager.io/hiring-manager-outreach-study)) — is not a basis for a weight and must not later be mistaken for one.

| Tier | Definition | Points |
| --- | --- | --- |
| **C3** | A contact at the company who has replied to the user, or is recorded as willing to refer | 20 |
| **C2** | A ranked alum or saved contact at the company, contacted or not, no reply yet | 14 |
| **C1** | A ranked alum at the company, from the user's own list, whom she has not saved — one source only, below | 8 |
| **C0** | No named person | 0 |

**C1 has exactly one source, and it is not the recruiter on the posting.** Added 2026-10-20 (B-12). No endpoint in §8.2 returns the recruiter named on a posting. The Greenhouse board API's job object carries no person field at all ([Apify's field list for the official Job Board API](https://apify.com/usestring/greenhouse-jobs.md)), and the two providers that do hold the person keep it behind the employer's own credentials: Ashby's `hiringTeam` and `author` sit on the authenticated job endpoints, while the public posting endpoints return title, department, location, workplace and employment type, published date and `descriptionHtml` — and no person ([Truto](https://truto.one/integrations/detail/ashby.md)); Lever's `hiring_managers` and `followers` likewise appear only through an authenticated connection ([Apideck](https://www.apideck.com/integrations/lever/postings)). `[assumption]` on each reading, since the three provider docs refuse to open from the loop's sandbox and these are third-party pages with integration products to sell — but three independents agree, and listing a field they cannot reach would serve them better than omitting it. **The contrast is the finding: the field exists, and Hoshi will never hold the key** — §8.6's permission surface is built on these endpoints being unauthenticated, so there is no version of Hoshi that reaches the authenticated one. The other two routes are closed on principle rather than on availability: a name lifted out of `descriptionHtml` has no response key to record as its `path` (§8.4) and reading a person out of prose is the inference Principle 2 forbids, and §8.2 gives LinkedIn no adapter. **So C1 is a ranked alum at the company whom the user has not saved, and nothing else** — which the build already has (§4), so the tier keeps its 8 points and no weight moves. Its row prints that origin, as the third line of §9.4 shows — *your* ranked alum list, which is the accurate word and not a turn of phrase. **Hoshi sources the match, not the person.** Added 2026-10-24. No endpoint in §8.2 returns a person of any kind, §8.6's permission surface is four unauthenticated *job* endpoints, and LinkedIn has no adapter — so nothing can put a person into the alum list except the user, and "Hoshi surfaced them" was a capability claim this document refuses itself three times over. What Hoshi contributes is the match: her people against a watched company, ranked, with the shared context shown (§4). The shipped version of the other claim runs on a people database the vendor holds — Jobright surfaces *"past colleagues, classmates and more within a hiring team for any Job"* and sells *"unique email addresses"* for them, while assuring users it will *"not access contact lists or any other areas of your account"* ([Jobright's own page](https://jobright.ai/job-referral), the vendor advertising its own product, so `[assumption]` on anything beyond what it claims to do) — which is precisely the capability §8.6 is built on not having, and §1 already records that it names no source for those contacts. **So the person record owes what §8.4 makes an extracted field owe** (Principle 6): every contact and alum carries an `origin` — how it entered Hoshi and when — and **invariant (5)**, in §9.3's CI-blocking shape, is that `tier === 'C1'` requires a resolvable alum record *whose `origin` resolves with it*. An unprovenanced C1 is then unconstructible rather than scored 0, and the one tier Hoshi asserts on the user's behalf cannot become the unsourced one it was written against.

**C1 therefore adds ordering, not reach.** §8.1 seeds the watchlist from companies where a ranked alum or saved contact works, so every company that can produce a C1 is already a watched company: §7.2's `tier ≥ C1` promotion clause is not a second route into the brief, only a second reason a job at a company already on the list clears it. That is narrower than §7.2 reads as claiming, and it is the honest version — C1 cannot surface an employer the user has no path to, and a tier that could would be the inferred-closeness guess the top of this section refuses.

**Decay.** A C2 with no reply after 21 days degrades to C1: an unanswered message is information about the path, and the score should stop claiming a warmth that did not materialise. C3 never decays — the reply already happened. `[assumption]` the 21 days. Because the tier therefore changes without the user doing anything, it cannot be read back from current state when measuring (§10.3 rule 8, §10.5). **Both ends of that clock are read from the log, not from a flag.** Added 2026-10-21: C3 requires a `reply` or `refer-offered` row for that contact — **invariant (6)**, in §9.3's CI-blocking shape — and *no reply after 21 days* means no such row within 21 days of the thread's `outreach` row (§10.5). The largest award in the tier table was otherwise a boolean the user could set and clear, which is the one thing §9.4's naming rule cannot catch: Hoshi can name the person correctly and still be wrong about what they did.

### 9.3 Two invariants

These are the testable part. Both should be CI-blocking, in the shape of the existing Stardust balance test.

1. **Connection re-ranks the qualified set; it does not admit to it.** A job below the role-fit floor (role < 15 of 25) never enters the Daily Brief, whatever its connection tier. Knowing someone at a company whose roles the user cannot do is not an opportunity, and a scoring model that lets C3 drag unqualified jobs upward would produce exactly the pipeline §5.4 forbids.
2. **Connection is decisive among comparable jobs and nowhere else.** `C3 (20) == company + narrative + location + freshness (20)` and `C3 (20) < role + experience (35)`. So among jobs of similar role fit, a job with a replied-to contact cannot be *outscored* on the four soft terms — at worst it ties, and §7.2's first tiebreak is the higher connection tier, so it still leads — while a clearly better-fitting job still beats a clearly worse one with a friend attached. The equality is deliberate and the test is `==`, not `>`: this clause read *exceeds* until 2026-10-11, which is false arithmetic and a test written from it would have failed.

### 9.4 Explanation

Under Principle 6 the connection term must name its evidence, in the line the user reads:

```
+20 · Priya Raman — UMSI '23, Design Systems, replied 12 Sep
+14 · Marcus Lee — UMSI '21, no reply yet (sent 4 Sep)
 +8 · Dana Patel, UMSI '20 — from your ranked alum list, not yet saved
 +0 · nobody found at this company
```

Never `+20 · strong connection`. **If Hoshi cannot name the person, it cannot award the points** — which makes the no-fabrication rule (Principle 2) enforceable on the score itself, not only on generated text. The same display is what makes §5.3 true: "why this job?" is answered by the score line, without reopening the posting.

### 9.5 Freshness scores competition, not odds

Added 2026-10-13 (B-07). §9.1 had carried freshness at 5 of 100 since 2026-09-29 with nothing computing it. It now scores exactly one thing: **how full the applicant pool already is** — the only part of a posting's age that has a source behind it. DHI Group, linking nearly 80 million applications to almost 10 million postings, reports that **41% of applications arrive within the first 48 hours and 56% within 96**, against a mean life of **9.8 days** for a single-position posting ([St. Louis Fed](https://www.stlouisfed.org/on-the-economy/2017/november/how-quickly-people-apply-jobs)). Those three figures are the band edges, so the bands are measured rather than invented: **≤ 48h → 5** (~59% of the eventual pool has not arrived yet), **48–96h → 3** (~44%), **4–10 days → 1** (inside mean posting life, the pool substantially full), **> 10 days → 0** (past it — the pool is full and the posting has probably stopped being worth a morning; whether the role is *closed* is observed, not inferred from age — §8.8). `[assumption]` the 5/3/1/0 spacing: the edges are sourced, but how those shares map onto five points is a judgment.

**Freshness does not score the user's chances, and the score line must never imply that it does.** The category's "apply within 24 hours" evidence does not survive its own sourcing — the 2–3x-interviews figure is one unpublished survey by a vendor that sells application speed, and the quoted "90% of candidates who got interviews applied in the first 24 hours" is a share of the successes rather than a rate, which against 41% of applications arriving inside 48 hours is largely the arrival distribution ([jobstrack](https://jobstrack.io/blog/first-mover-advantage-applying-early-tech-jobs) collects both; neither publishes a method). That is §10.5's self-confirming measurement in a second place, so Hoshi scores the queue length it can source and stays silent about the odds it cannot.

**No freshness points without a date Hoshi can name (Principles 5 and 6).** §8.4 is where the problem starts: Greenhouse exposes `updated_at`, which moves on an edit or a repost, Ashby exposes a publish date, and a DOM-extracted page may carry neither. So every job records `dateKind: 'posted' | 'updated' | 'none'` beside the field it came from. `none` scores 0 and prints `+0 · no posting date available` — not a default, not half marks. `updated` caps at 3, because an `updated_at` twelve hours old is equally consistent with a June posting edited yesterday, which makes the top band's claim about the pool simply false; the line names the field, as in `+3 · updated 12 Oct — Greenhouse updated_at, not a posting date`. Two more invariants, in §9.3's CI-blocking shape: **(3)** `freshness > 0` requires `dateKind !== 'none'`; **(4)** `dateKind === 'updated'` requires `freshness <= 3`.

**§7.2's second tiebreak is narrowed by the same problem.** It compares raw timestamps rather than bands, and only between jobs of the same `dateKind` — a posting date and an `updated_at` are not the same quantity, and ordering one against the other ranks by which ATS the company bought. Across kinds freshness does not break the tie, and block 2 falls through to company order.

---

## 10. Analytics and honesty rules

Specified 2026-10-02 (B-04), extended 2026-10-09 with rule 8 and §10.5, 2026-10-16 with rule 9 and the event log, 2026-10-21 with the outreach kinds, and 2026-10-23 with rule 10. No code written. Renders in the Activity destination; the Daily Brief surface is §7.

### 10.1 The sample size decides the metric set

One user is a small sample, and that fact has to come before the choice of metrics rather than after it. To detect a change in a rate at conventional 80% power and α = 0.05 (two-sided two-proportion test), the events needed in *each* arm are **435** for an application→response move of 5% → 10%, **141** for 5% → 15%, and **58** for an outreach→reply move of 25% → 50%. Computed, not sourced — the standard normal-approximation two-proportion formula; the script is in the 2026-10-02 brief, so the numbers can be rechecked rather than trusted.

A job seeker does not send 282 applications in a season, and if she did, the season would end before the comparison resolved. **Hoshi cannot A/B test its own application funnel for a single user. Not slowly — not at all.** Any dashboard that implies otherwise is misreporting its sample size, and that is the specific failure this section exists to prevent. What one user *can* measure is a rate with a high base, which is a second and independent reason the metric set leans toward conversations on top of §1: the warm path runs an order of magnitude above the cold one, so the same relative change needs an order of magnitude fewer events — the 58 above against the 435.

### 10.2 Metric set

Two kinds, and the difference must be visible in the UI.

**Counts — exact, no interval.** They are exact about what was recorded, which is not the same as exact about the world: every row below but the last is an assertion of the user's that Hoshi wrote down (§10.5).

| Metric | Why it is here |
| --- | --- |
| Outreach threads opened, replies received, per week (§10.5) | the thesis' numerator |
| Applications **marked** submitted | her assertion, never Hoshi's observation (§10.5); the number every competitor leads with, and here it is context, not a score |
| Applications marked submitted **with a named person attached before submit** (§10.5) | §5.2 is pass/fail per application, and this is the count |
| Screens and interviews reached | the end of the funnel |
| Median time from job page opened to **review complete** | §5.1's ten-minute target, and the one interval Hoshi witnesses both ends of |

**Rates — estimates, always with an interval.** These are inferences about a true value from a small n, and there are three: **reply rate** over outreach threads; **person-attached rate** over applications marked submitted; and **response rate by connection tier as recorded at submit** (§10.5) over applications in that tier. Every denominator is subject to rules 9 and 10.

**Person-attached rate goes at the top.** It is a proportion of the user's own behaviour rather than the market's response, so it moves the same week, it is entirely under her control, and it measures whether she is running the thesis or merely agreeing with it.

### 10.3 Honesty rules

1. **No percentage below n = 10.** Show `3 of 7`, never `43%`. The floor is not where precision starts, either: 3 of 10 is `30% (11–60%)`.
2. **Every rate carries its 95% Wilson interval, same line, same type size.** A bare rate is a false claim of precision. Six replies from twenty sends is `30% (15–52%)`, and that width *is* the finding. Twelve of forty is still `30% (18–45%)`.
3. **No causal or comparative language unless the two intervals are disjoint.** Otherwise the copy reads `30% → 45%, inside the range chance produces at this volume`. No "because", no "up", no arrow.
4. **No trend line or sparkline over fewer than four periods that each clear n = 10.**
5. **No external benchmark Hoshi cannot source.** No "top 20% of applicants", no percentile against users Hoshi has never seen.
6. **Insufficient data states the shortfall as a number** (Principle 5): `not enough yet — 14 more sends before this rate means anything`. Never a blank, a zero, or a greyed-out 0%.
7. **Counts and rates never share a visual treatment.** A count is a fact and a rate is an estimate; if Activity renders them identically, rule 2 is decoration.
8. **No count or rate may read a value that can change after the event it describes.** Connection tier decays and upgrades (§9.2), person-attached status can be earned late, and the weights themselves are `[assumption]` and will move — so a metric derived from current state describes today's contacts, not the submission it claims to. §10.5 is the record this rule requires. Without it, the tier table above and the headline rate above it are not computable honestly and must not be shown at all.
9. **A rate's denominator excludes events too recent to have produced an outcome.** Absence of an outcome means *not yet*, not *no*, so a response rate over every submission counts last Tuesday's as a failure — rule 8's bias running the other way, deflating rather than flattering. Submissions inside the maturation window are excluded and the exclusion is stated in rule 6's shape: `9 of 31 applications are too recent to count`. `[assumption]` the window is 21 days, set equal to §9.2's decay clock so there is one clock in the product and not two.
10. **A denominator Hoshi assembled out of its own participation is not the population the rate names, and the shortfall is stated with its direction.** Rules 8 and 9 catch mutation and maturation; this one catches *coverage*. Hoshi counts the applications it filled and the sends the user marked, never the application she typed by hand at midnight — and under §1 those are disproportionately the cold ones §5.2 exists to remove, so **person-attached rate reads high exactly when she goes around Hoshi**. Reply rate is an upper bound for the same reason one step along, its denominator being the sends she remembered to mark; response rate over `submission` rows is a *lower* bound, because a row written at `mayMarkApplied` for an application she never actually sent can only ever look like a failure (§10.5). So each rate names its population — *of the 24 applications Hoshi filled* — and none of them says "your applications". `[assumption]` the direction in each of the three cases; that the gap exists is not an assumption, and B-21 is the only thing that narrows it.

### 10.4 What this does, and does not do, for §9

B-04 was given one specific job: make the 20-of-100 connection weight in §9.1 falsifiable. **For a single user it cannot** — a season's applications split four ways leaves every tier far under the 141 of §10.1, and C3 and C2, the two that matter most, are the rarest. Two weaker tests stand in, each honest about which it is. **Behavioural, available immediately:** of the jobs the connection term lifted to the top of the brief, which did the user act on, and did she reach out before applying? If the term reorders her day and she follows the new order it is working as a prioritisation device whatever its effect on outcomes — and it is a count, not a rate, so §10.3 rule 1 does not block it. **Outcome, only at cohort scale:** comparing response rate across tiers needs many users' applications pooled, which is **Q1 and Q3** — a personal tool cannot run this test and a Chrome Web Store product can — rather than an engineering question. So §9.1's weights keep their `[assumption]` tag, and no future run should claim analytics retired it.

### 10.5 What has to be recorded at the event

Rule 8 is a schema requirement, not a display rule, and the reason is that the error it prevents has a direction: it flatters §9.1. If Activity builds §10.2's tier table by joining each application to its contact's *current* tier, then a C2 whose alum replies after the application — including a reply the application itself caused — becomes a C3, so that submission is counted in the C3 bucket precisely because it worked. Meanwhile a C2 that went nowhere decays to C1 at day 21 (§9.2). C2's successes leave upward, its failures leave downward, and applications where a person was only saved afterwards leave C0 entirely. The gradient C3 > C2 > C1 > C0 then appears whether or not connection does anything — and that gradient is exactly what §9.1's weight predicts. A metric that cannot fail to confirm the hypothesis it is testing is worse than no metric, and this is the one outcome-flavoured measurement §10.4 left available at single-user scale. The same error hits the headline metric: §5.2's bar is a person attached **before** submit, and person-attached rate read from current state counts a contact saved a week later.

So: an append-only **event log**, each row written once when the event happens and never recomputed or backfilled. It is a fifth store — §4's four all hold current state, this one holds history and has no update path — and it is one log with several kinds rather than several stores (B-16, resolved 2026-10-16). Rule 8's hazard is mutation, not heterogeneity, so stores that share a write rule are one store with a discriminator; and there is a `brief` kind, because §10.4's behavioural test asks which jobs the connection term lifted *on the morning it lifted them*, which is a property of the brief that rendered rather than of today's scores.

```ts
type HoshiEvent = { at: ISODate } & (
  | { kind: 'submission'; jobId: string; roleFit: number; totalScore: number;
      weightsVersion: string;                       // written at mayMarkApplied
      personAttached: { contactId: string; tier: 'C3' | 'C2' | 'C1' } | null }
  | { kind: 'outcome'; jobId: string; source: 'user' | 'import';
      stage: 'response' | 'screen' | 'interview' | 'rejected' }
  | { kind: 'brief'; conversations: { contactId: string; why: BriefRowType }[];
      promoted: { jobId: string; rank: number; totalScore: number; roleFit: number; tier: Tier }[] }
  | { kind: 'outreach'; threadId: string; contactId: string; jobId?: string;
      channel: 'email' | 'linkedin' | 'other'; step: 'sent' | 'followup' }
  | { kind: 'reply'; threadId: string; contactId: string; source: 'user';
      step: 'replied' | 'refer-offered';
      arrived: { kind: 'stated'; at: ISODate } | { kind: 'unknown' } }
);
```

`roleFit` and `totalScore` are copied in, not looked up later, and `weightsVersion` is there because a rate pooled across two weight tables is two rates: Activity segments by version or states that it did not.

**The thesis' own numerator had no record.** Added 2026-10-21. §10.2 counts outreach and replies and makes reply rate a headline rate, and all three would have been read off §4's outreach tracking, which is current state — so rule 8's closing sentence applied to them unchanged: not computable honestly, therefore not to be shown at all. Hence the last two kinds above, and three rules inside them. **The grain is the thread, not the contact.** One person messaged twice in a season is two threads, and a rate whose denominator is contacts-with-outreach is not a reply rate; it also means the rows outlive the contact record, so merging two alum entries or deleting a contact who went nowhere no longer takes sends out of a denominator while the replies she remembers stay in the numerator — rule 8's flattering direction again, arriving through the address book instead of through the tier. **Hoshi cannot witness a reply, and it cannot witness a send either.** The only places either happens are her mail and her LinkedIn, which Principle 4 and §8.2 refuse, so both rows are her assertions rather than Hoshi's observations. The asymmetry is in *when* she asserts them: a send is marked inside the drafting flow that produced it, so the row's `at` is a usable send date, while a reply is marked whenever she next opens the panel, which is why only `reply` carries `arrived` — §9.5's `dateKind` problem on a person instead of a posting, with the same consequence. **Reply latency is computed only over `arrived.kind === 'stated'` rows and states how many it excluded** (rule 9's shape); reply *rate* needs no arrival date and uses every row, and its denominator being the sends she remembered to mark is rule 10's coverage gap on the outreach side.

**`mayMarkApplied` is her assertion too, and it is Hoshi's last observable moment.** Added 2026-10-23 (B-20). Principle 1 puts the final submit on the employer's page and §4 ends autofill at review, so the `submission` row witnesses two things — the review Hoshi completed, and her statement that she is submitting — and not the third, that the application arrived. Its `at` is sound where `reply`'s is not, because it is written inside the flow that produced it, as `outreach` is; what is unobserved here is not *when* but *whether*. **Hoshi does not go looking for the missing third.** Reading a confirmation page is a DOM read on a granted host to witness something she has already said, and it would succeed only on the vendors that render one — two different metrics under one name, which is §7.2's *ranked by which ATS the company bought* arriving in the analytics. The category has not settled this in writing either: Simplify's tracker docs say *"Applying to a job using Copilot will automatically save the job to your Job Tracker"* and, in the same article, that *"you'll be prompted to add the application to your Job Tracker after submitting your application"* — observation or assertion, unresolved in the one shipped product with the flow — while automatic tracking is scoped to *"jobs you apply to that are in our database"*, which is rule 10's coverage gap in a competitor's own words ([using the job tracker](https://help.simplify.jobs/articles/2140179-using-the-job-tracker) · [adding custom applications](https://help.simplify.jobs/articles/9861158-adding-custom-applications)). So **an `outcome` event is the only confirmation that a submission landed**: a matured `submission` with none is ambiguous between a cold no-reply and an application never sent, which is why rule 10 makes response rate a lower bound rather than a rate. **And the funnel's clock stops where the observation does** — §10.2's median time runs to review complete, and §5.1's ten minutes with it. That is the one interval Hoshi witnessed both ends of, and it is also the number the target was always about: how much of her morning the flow costs, not how long she sat on the Submit button.

**A job's stage is derived from the log, never stored beside it.** A `status` field on the job record that the user flips to *Interviewing* can disagree with the log, which readmits rule 8 through the UI. There is no such field: the stage shown on a job is its latest `outcome` event, and the only write anywhere is appending one. A job's *listing* state (§8.8) is a different thing and is not an outcome.

**Nothing is ever deleted, and the arithmetic is the reason.** `chrome.storage.local` holds 10,485,760 bytes unless the `unlimitedStorage` permission lifts it ([Chrome docs](https://developer.chrome.com/docs/extensions/mv2/reference/storage)). A heavy year — 300 submissions, two outcome events each, 300 sends and follow-ups, 60 replies, and a brief every morning — serialises to about 400 KB, under 4% of that quota, so the log would take roughly 25 years to become a storage problem. A retention rule would cost code and a judgment call in order to delete the only record of last season. Where the quota does go is the job store, whose `descriptionHtml` fills the same 10 MB at a few hundred jobs (B-17).

---

## 11. The answer bank

Added 2026-10-22. §4 lists the answer bank as unspecified and the generation backend as absent, so free-text answers "cannot run" — but the part of them that needs no model is recall. The bank stores **answers the user wrote or edited**, never model output she never saw, which makes it buildable in the local-only mode Q2 may make permanent (B-08), unlike the cover letters and free-text generation listed beside it. Each stored answer records the question as the form asked it, the application it was first written for, its `scope`, and `editedAt`. `[assumption]` that free-text questions are where the remaining per-application minutes go now that autofill covers the structured fields (§4): §10.2's median-time metric is what would retire that tag, and the category's form-abandonment statistics do not — B-19 records which ones were read and why they were refused.

**Scope decides whether an answer may be filled at all, and a competitor's own documentation is why that needs saying.** Simplify saves custom answers — *"The fields below are automatically saved in this browser only"* — and then *"we'll automatically fill in inputs with corresponding labels using these values"*, which is label matching with no company scoping documented; with its AI setting on, *"Copilot will attempt to autofill unique questions using your profile"* ([Simplify help](https://help.simplify.jobs/article/18-saving-custom-questions) and [autofill settings](https://help.simplify.jobs/articles/8686025-manage-autofill-settings-in-the-simplify-extension)). The second is the inference Principle 2 forbids, and Hoshi does not do it with a backend or without one. The first is the trap that earns a rule: an answer to *"why do you want to work here"* is stable in form and false the moment it changes company, and a stale specific is worse than a generic one. So every answer carries `scope: 'employer-independent' | 'employer-specific'`. Employer-independent answers — work authorization, graduation date, notice period — are facts stated once and may be written to a field verbatim. Employer-specific answers are **offered as a seed and never written to a field**: **invariant (7)**, in §9.3's CI-blocking shape, is that no field may be filled from an `employer-specific` answer unless its `editedAt` is later than the application it was written for, and that no answer naming a company other than this application's may be filled in either scope — a refusal read off the user's own stored text, not a name extracted from it. (Review-before-submit is not the difference here: Simplify's docs say *"You still review the completed application and click the final Submit button yourself"* too. Scoping is.)

**An unrecognised question fills nothing, and the protected group has no key here either.** A question the bank cannot match produces no fill and names the question it skipped (Principle 5); there is no nearest-match, because a question that merely resembles a stored one is the same guess §8.7 refuses for board handles. The bank is also where Principle 3 could leak: Simplify's autofill settings list *"Disability"* among the fields its extension can write, without saying whether that is on by default (`[assumption]` on the default; the field's presence is not in doubt). Hoshi's protected-fields group is left deliberately blank by autofill (§4), and a bank that remembered the answer would be the back door around the one principle with a walk test behind it — so **invariant (8)**: the answer bank's schema has no key for race, gender, disability or veteran status, enforced by the same test Principle 3 puts on the profile. Work authorization is not in that group and is the employer-independent case that matters most to this user: her stated fact, reused verbatim, answered the same way every time. Whether sponsorship becomes a scoring term rather than an eligibility gate is **Q4**, and nothing here touches it.

---

## Sources

- [Do Job Referrals Actually Work? Data Behind Response Rates — refer.me](https://www.refer.me/blog/do-job-referrals-actually-work-data-behind-response-rates)
- [Does Emailing the Hiring Manager Work? 79 Outcomes Analyzed — dearhiringmanager.io](https://dearhiringmanager.io/hiring-manager-outreach-study)
- [Best AI Job Search Tools in 2026: Honestly Compared — RemoteHunt](https://remotehunt.app/blog/best-ai-job-search-tools-2026)
- [Jobright AI Review 2026: We Tested It — wobo.ai](https://www.wobo.ai/blog/jobright-review/)
- [Jobright AI Review 2026 — HiringReach (a disclosed Jobright competitor)](https://hiringreach.com/reviews/jobright-ai-review)
- [Jobright's referral page — the vendor's own account of what Insider Connections surfaces and sells](https://jobright.ai/job-referral)
- [Application overload: half of job seekers 'doomjobbing' (Monster, n=1,006) — HCAMag](https://www.hcamag.com/ca/specialization/recruitment/application-overload-half-of-job-seekers-doomjobbing/578466)
- [How Quickly Do People Apply for Jobs? (DHI Group, ~80M applications) — St. Louis Fed](https://www.stlouisfed.org/on-the-economy/2017/november/how-quickly-people-apply-jobs)
- [The First-Mover Advantage: Applying Early to Tech Jobs — jobstrack.io (aggregates the GoApply and EvalCommunity timing claims; neither publishes a method)](https://jobstrack.io/blog/first-mover-advantage-applying-early-tech-jobs)
- [Job aggregator sites: where each one actually gets its listings — JobsPipe (sells ATS feed data)](https://jobspipe.dev/blog/job-aggregator-sites)
- [Lever Jobs API source notes — JobsPipe (sells ATS feed data; cited for the absence of a published read limit)](https://jobspipe.dev/sources/lever.md)
- [Greenhouse Jobs API source notes — JobsPipe](https://jobspipe.dev/sources/greenhouse.md)
- [Ashby Jobs API source notes — JobsPipe](https://jobspipe.dev/sources/ashby.md)
- Field lists for the public posting endpoints, read from third parties because the provider docs refuse to open from the loop's sandbox — all three sell integration or scraping products, so cited for what they list rather than for what they advise: [Greenhouse — Apify](https://apify.com/usestring/greenhouse-jobs.md) · [Ashby — Truto](https://truto.one/integrations/detail/ashby.md) · [Lever — Apideck](https://www.apideck.com/integrations/lever/postings)
- [chrome.storage reference — QUOTA_BYTES and unlimitedStorage](https://developer.chrome.com/docs/extensions/mv2/reference/storage)
- [Extension service worker lifecycle — idle timeout, 5-minute task ceiling, 30-second fetch ceiling](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [chrome.alarms reference — the 0.5-minute minimum period](https://developer.chrome.com/docs/extensions/mv2/reference/alarms)
- Simplify's own help docs, cited for its documented behaviour rather than its advice: [saving custom questions](https://help.simplify.jobs/article/18-saving-custom-questions) · [autofill settings](https://help.simplify.jobs/articles/8686025-manage-autofill-settings-in-the-simplify-extension) · [using the job tracker](https://help.simplify.jobs/articles/2140179-using-the-job-tracker) · [adding custom applications](https://help.simplify.jobs/articles/9861158-adding-custom-applications)
- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html)
- [Embed a Greenhouse job board on your career site — Greenhouse support](https://support.greenhouse.io/hc/en-us/articles/46365908766875-Embed-a-Greenhouse-job-board-on-your-career-site)
- [Lever Postings API](https://github.com/lever/postings-api/blob/master/README.md)
- [Ashby Public Job Posting API](https://developers.ashbyhq.com/docs/public-job-posting-api)
- [Scraping Workday career sites without a browser, and the 2,000-job ceiling](https://dev.to/dododata/scraping-workday-career-sites-without-a-browser-and-the-2000-job-ceiling-h2e)
