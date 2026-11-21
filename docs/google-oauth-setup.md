# Google OAuth setup for Hoshi

Phase 2 (Sheets sync) and Phase 3 (Gmail drafts) need an OAuth client that **you** own. No client ID, client secret or token is committed to this repository, and none should be: this repo is public.

Hoshi reads the client ID from its own Settings at runtime and stores it in `chrome.storage.local` alongside your other local data. If you clear the extension's storage you re-paste it.

## What you create

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project — `hoshi-personal` is fine.
2. **APIs & Services → Library**: enable **Google Sheets API** and **Gmail API**. Enable Gmail only when you want Phase 3; Sheets alone is enough for Phase 2.
3. **APIs & Services → OAuth consent screen**: choose **External**, publishing status **Testing**, and add your own address as a test user. A Testing-status app is limited to the test users you list, which is what you want for a personal tool. Add both accounts if you want Hoshi to see both:
   - `dhwanib@umich.edu` — outreach drafts and the Sheet
   - `dhwanibagrecha123@gmail.com` — application-status monitoring only, and only if you decide to authorize it
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**, application type **Chrome Extension**. It asks for your extension's ID, which Chrome shows at `chrome://extensions` once Hoshi is loaded unpacked. Note that an unpacked extension's ID changes if you reload it from a different folder; if that happens, update the client's extension ID.
5. Copy the client ID (it ends in `.apps.googleusercontent.com`) and paste it into **Hoshi → Settings → Google connection**.

## Scopes Hoshi will request, and why each one

Least privilege, requested only at the moment the feature is first used — never at install.

| Scope | Phase | Why this one and not a broader one |
| --- | --- | --- |
| `drive.file` | 2 | Per-file access, granted by you through Google's own file picker. Hoshi can touch **only the spreadsheet you pick** and no other file in your Drive. This is deliberately used instead of `spreadsheets`, which would grant access to every spreadsheet you own. |
| `gmail.compose` | 3 | Creates and updates drafts. **It cannot send.** The send scope (`gmail.send`) is never requested, which is the technical guarantee behind "drafts only" — even a bug cannot send mail. |
| `gmail.readonly` | 3 | Application-status reconciliation: confirmations, assessments, interview invitations, rejections. Read-only, and requested separately from `gmail.compose` so you can authorize drafting without authorizing reading, or the reverse. |

Hoshi will not request `gmail.send`, `gmail.modify`, `drive`, `drive.readonly`, or `spreadsheets`. If a future change needs one, that is a decision for you, not an implementation detail.

## What stays true regardless of what you authorize

- Hoshi never sends an email, never sends a LinkedIn message, and never submits an application. `gmail.send` is not in the list above and is not requested.
- A draft is created in your account and left there. Hoshi stores the draft id and a link so you can open it; the review and the send are yours.
- Sheets writes are Phase 2's second half, after an authenticated **read** is proven against your real file. The first version that touches your live Sheet cannot modify it.
- Tokens live in `chrome.storage.local` on your machine. There is no Hoshi server, so there is nowhere else for them to go.

## If you would rather not do this yet

The CSV path in Settings works with no credentials at all: in Google Sheets choose **File → Download → CSV** on a tab and import the file. It is a snapshot rather than a sync, and imported rows are kept visibly separate from events Hoshi observed.
