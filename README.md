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
| **Jobs** | Save jobs manually or capture a supported ATS job page with a user-triggered click; review role fit and sponsorship; manually mark submitted and outcomes; add company-specific boards; daily provider polling with error and delisting safety. |
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
- Raw job description HTML is not stored by discovery (protecting the 10 MB local storage quota).
- An append-only event log preserves the person's tier and score at the moment the user marked a submission.
- The default priority threshold of 70 is a **provisional, user-editable implementation choice** while PRD B-15 remains unresolved. It is not a finalized product decision.

## Google Sheets and Hoshi synchronization

Hoshi includes a **read-only Google Sheets adapter** under [sync/](./sync). It maps the live **Daily Applications** and **My Contacts** sheet tabs without promoting incomplete forms to submitted or stale directory affiliations to verified employers.

**Live OAuth sync is not connected in this release.** Google Sheets requires a user-consented OAuth client ID and browser-side token workflow; those credentials are not in this repo. The usable, offline option today is the CSV import in Settings. We will only enable automatic synchronization after the extension is configured and a real authenticated read is tested. Hoshi-to-Google-Sheets writeback is not implemented.

## What is *not* included yet

This first release does not include cloud AI generation/classification, full nine-provider ATS classifier coverage, LinkedIn inbox access, automated Gmail tracking, direct Google OAuth, automatic job applications, Workday board discovery, or recruiter interview mode. The PRD describes some of these as built in an earlier codebase, **but that codebase was not present in this repository**, so they have not been carried forward as working features. It also does not alter the existing daily ChatGPT spreadsheet automation.

## Developer checks

Requires Node 22+ for the test runner. No runtime bundler or npm installation is required to load the unpacked Chrome extension.

```bash
npm run check
npm test
```

PRD and backlog are preserved as the product decisions; implementation deviations are called out above rather than quietly changed. Contributions should arrive in a pull request, with tests for the eight protected principles and evidence handling.
