# Hoshi Google Sheets bridge — integration groundwork

The existing Hoshi GitHub repository is **public** and currently contains PRD/LOOP/BACKLOG and briefs, not the source code of the installed Chrome extension. This change adds a **tested, read-only import adapter** for the existing Google Sheets tables. It is **not a live Hoshi sync** until it is wired into the installed extension's private storage and authorized with Google OAuth.

## Integration

\`\`\`js
import {pullSnapshot} from './google-sheets-bridge.mjs';
const snapshot = await pullSnapshot({
  spreadsheetId: userSettings.sheetId,
  accessToken: consentedGoogleOAuthReadOnlyToken
});
// Review changes, then merge into the actual extension store.
// Do not assume a sheet sync implies any job application was submitted.
\`\`\`

Read-only tabs: \`Daily Applications\` and \`My Contacts\`. Returned values include stable record IDs, job status, first-confirmation date, follow-up, evidence links and current-employer verification; \`Incomplete\` is never counted as submitted. A directory employer is not promoted to current unless its check is explicitly verified.

## Security and next integration steps

- Never commit contacts, spreadsheet IDs, tokens, client secrets or CSV exports to GitHub.
- Use Google OAuth **spreadsheets.readonly**, with a token obtained by the actual extension through user consent. The adapter does not retain or log tokens.
- The extension must merge into \`chrome.storage.local\`, not public GitHub or \`chrome.storage.sync\`, and must surface conflicts for review. No automatic outreach, application submission or silently inferred rejections.
- Read-only pull only: no Hoshi-to-Sheets writeback until the actual extension's application-confirmation events and authorization model can be inspected and tested.
- To complete live sync: locate the installed Hoshi extension source and Manifest V3 permissions, connect the OAuth callback, map these records to its actual stores, and test authenticated read + idempotent merge locally. No installed extension was modified by this PR.

Run \`node --test sync/google-sheets-bridge.test.mjs\` on Node 18+.
