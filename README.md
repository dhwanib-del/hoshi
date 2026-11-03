# ✦ Hoshi

**Find the role. Find the person. Make the conversation count.**

A real, installable Chrome Manifest V3 side-panel extension built from the [Hoshi product requirements](./PRD.md). This is a **first working implementation**, not a claim that the older, unavailable Chrome-extension source has been recovered. It keeps the PRD's people-first philosophy, Material 3 treatment, four destinations, and explicit user control.

## Install the extension locally

1. Open the [Hoshi build branch](https://github.com/dhwanib-del/hoshi/tree/feature/google-sheets-bridge-2026-10-28). Use **Code → Download ZIP**, and unzip it on your computer.
2. In Chrome, open **chrome://extensions**, turn on **Developer mode**, and select **Load unpacked**.
3. Select the extracted **hoshi** folder containing manifest.json.
4. Pin Hoshi. Click the toolbar icon to open its side panel. Data is stored in your browser with `chrome.storage.local`.
5. Under Settings, set your graduation year, roles, and preferences. To populate People and Jobs from your Google Sheet now: open one tab at a time in Google Sheets and choose **File → Download → Comma-separated values (.csv)**; import the saved CSV in Hoshi Settings.

Do **not** upload personal contacts, emails, access tokens, OAuth credentials, or application spreadsheets to this public GitHub repository.

## Inside Hoshi

| Destination | What works |
| --- | --- |
| **Orbit** | Daily brief capped at 3 conversations and 5 qualified, explainable jobs; today's Stardust; person-first prompts. |
| **Jobs** | **Fresh** section first: open jobs grouped by the posting age Hoshi can verify (last hour / 6h / 24h / older / unverified), with filters for 2027-grad eligibility, sponsorship, your locations and not-yet-applied, and a header stating the last complete check and which sources are and are not covered. Then save jobs manually or capture a supported ATS job page with a user-triggered click; review role fit and sponsorship; manually mark submitted and outcomes; add company-specific boards; daily provider polling with error and delisting safety. |
| **People** | Local contact bank, search, coffee-chat draft copied to clipboard only, and explicit "mark sent" / "mark replied" tracking. |
| **Activity** | Exact event counts and clearly qualified rates with 95% Wilson intervals, 10-event minimum, 21-day maturity window, and honest source limitations. |

**Settings** also has user-written answer bank, exact-match review-before-fill on allowed ATS job sites, career preferences, local CSV import, and JSON backup.

## Safety and privacy

- Hoshi **never submits applications**, sends outreach, reads private LinkedIn messages, or browses other tabs. You must confirm every submission, send, and response yourself.
- Autofill can **only fill fields you explicitly check**, from answers you wrote. It never clicks Submit and never stores race, ethnicity, disability, gender, or veteran answers.
- Job extraction only runs after you click Capture on supported job-site hosts; site access is contextual, not blanket.
- Greenhouse, Lever, and Ashby company-board polling requires permission *when you add the board*. No keyword crawler or LinkedIn scraper. Workday is not polled because its endpoint is undocumented and completeness cannot be guaranteed.
- Incomplete provider results **never close a job**; a verified complete provider result may mark previously observed, now-absent jobs as delisted.
- Connection tiers require a **named, sourced person**. Scores explain their evidence; they are not probabilities of employment.
- **Scoring weights (decided 2026-11-03):** role 25 · eligibility 20 · work authorization 20 · connection 15 · freshness 10 · portfolio 5 · location 5. Both gates are carried in full by every ranked job, so the **ranked range is 55–100**, 45 points wide, and connection is exactly a third of it. Portfolio relevance must name the matched project or it scores 0.
- Raw job description HTML is not stored by discovery (protecting the 10 MB local storage quota).
- **Posting age is verified, not guessed.** Four timestamps are kept distinct — original publication, last edit, Hoshi's first sighting, and a repost after a verified delisting — and the age shown always names which one it used. An edit date can never earn the top freshness band, and **Hoshi's own discovery time is never used as the posting date**: a row with nothing else says *Posting age unverified* and scores 0.
- **Polling is described as polling.** Boards are checked once a day. The Fresh section states the last complete check, how many watched boards were verified, and what is not covered (Workday, aggregators, LinkedIn). Nothing claims real-time monitoring.
- **An unverified eligibility or sponsorship check holds a job out of the ranking rather than scoring it low.** Both are hard gates, so every *ranked* job carries them in full and the ranked range is 40–100, not 0–100; a job awaiting your verification shows `—` and the count of held jobs is stated as a number. Marking such a job applied records it as *your* entry, with no Hoshi score, because there was none.
- An append-only event log preserves the person's tier and score at the moment the user marked a submission.
- The default priority threshold of 70 is a **provisional, user-editable implementation choice** while PRD B-15 remains unresolved. It is not a finalized product decision.

## Google Sheets and Hoshi synchronization

Hoshi includes a **read-only Google Sheets adapter** under [sync/](./sync). It maps the live **Daily Applications** and **My Contacts** sheet tabs without promoting incomplete forms to submitted or stale directory affiliations to verified employers.

**Live OAuth sync is not connected in this release.** Google Sheets requires a user-consented OAuth client ID and browser-side token workflow; those credentials are not in this repo. The usable, offline option today is the CSV import in Settings. We will only enable automatic synchronization after the extension is configured and a real authenticated read is tested. Hoshi-to-Google-Sheets writeback is not implemented.

## What is *not* included yet

Phase 1 of the 2027 job-search agent (fresh-job discovery, verified freshness, deduplication, the Fresh Jobs section) is in. **Not yet built, and each one is blocked on something specific rather than merely unstarted:** job-aggregator ingestion such as NewGrad-Jobs (needs a host permission and a terms review — no official feed); application-link liveness checks; employee discovery and the five-contacts-per-company research (no authorized LinkedIn API exists for this, so it cannot be built as specified — see the PR discussion); Gmail draft creation and Gmail application-status reconciliation (needs an OAuth client ID and consented scopes); live Google Sheets read/write sync (same, and only 2 of the 8 tabs are mapped today); the daily digest and alert channel; and resume matching. Also still absent: cloud AI generation/classification, full nine-provider ATS classifier coverage, automatic job applications, Workday board discovery, and recruiter interview mode. The PRD describes some of these as built in an earlier codebase, **but that codebase was not present in this repository**, so they have not been carried forward as working features. It also does not alter the existing daily ChatGPT spreadsheet automation.

## Developer checks

Requires Node 22+ for the test runner. No runtime bundler or npm installation is required to load the unpacked Chrome extension.

```bash
npm run check
npm test
```

PRD and backlog are preserved as the product decisions; implementation deviations are called out above rather than quietly changed. Contributions should arrive in a pull request, with tests for the eight protected principles and evidence handling.
