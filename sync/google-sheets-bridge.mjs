/**
 * Hoshi <-> Google Sheets: read-only integration adapter.
 * Requires a consented, in-memory Google Sheets readonly OAuth token supplied
 * by the installed Hoshi extension. Does not write back, send, or submit.
 */
export const TAB_NAMES = Object.freeze({ applications: 'Daily Applications', contacts: 'My Contacts' });
const norm = x => String(x ?? '').trim();
const slug = x => norm(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function objectsFromValues(values = []) {
  if (!Array.isArray(values) || !values.length) return [];
  const [headers, ...rows] = values;
  return rows.map((row, i) => row?.some(v => norm(v)) ? ({
    __sheetRow: i + 2,
    ...Object.fromEntries(headers.map((header, j) => [norm(header), norm(row?.[j])]))
  }) : null).filter(Boolean);
}
export function asISODate(value) {
  const s = norm(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[1]-1, +m[2]));
  return d.getUTCFullYear() === +m[3] && d.getUTCMonth() === +m[1]-1 && d.getUTCDate() === +m[2] ? d.toISOString().slice(0,10) : null;
}
const STATUS = {
  'applied':'applied', 'rejected':'rejected', 'interview':'interview',
  'assessment':'assessment', 'offer':'offer', 'withdrawn':'withdrawn',
  'incomplete':'incomplete', 'sent — unconfirmed':'unconfirmed',
  'needs review':'needs-review'
};
export function convertApplications(values) {
  const applications = [], warnings = [], seen = new Map();
  for (const r of objectsFromValues(values)) {
    if (!r.Company || !r.Role) { warnings.push('Row '+r.__sheetRow+': missing company or role'); continue; }
    const requisitionId = r['Requisition ID'] || null;
    const status = STATUS[norm(r.Status).toLowerCase()] || 'needs-review';
    const ambiguous = /role not stated|complete assessment/i.test(r.Role);
    const id = slug(r.Company) + ':' + (requisitionId ? 'req:'+slug(requisitionId) : 'role:'+slug(r.Role)) + (ambiguous ? ':row:'+r.__sheetRow : '');
    const record = {
      source:'google-sheets', sheetRow:r.__sheetRow, id, company:r.Company, role:r.Role,
      requisitionId, status, submitted:!['incomplete','unconfirmed','needs-review'].includes(status),
      firstEvidenceDate:asISODate(r['Applied / Confirmed'] || r['Applied On']),
      latestUpdate:asISODate(r['Latest Update'] || r['Last Email On']),
      followUpDate:asISODate(r['Follow-Up Date']),
      evidenceUrl:r['Email Evidence'] || null, jobUrl:r['Job Link'] || null,
      nextStep:r['Next Step'] || '', notes:r.Notes || ''
    };
    if (seen.has(id)) { warnings.push('Possible duplicate application at rows '+seen.get(id)+' and '+r.__sheetRow+'; review required'); continue; }
    seen.set(id,r.__sheetRow);
    applications.push(record);
  }
  return {applications, warnings};
}
export function convertContacts(values) {
  const contacts = [], warnings = [];
  for (const r of objectsFromValues(values)) {
    if (!r.Name) { warnings.push('Row '+r.__sheetRow+': missing name'); continue; }
    const employerCheck = r['Employer Check'] || 'Not checked';
    const checked = ['Verified current','Changed employer','Verified public profile'].includes(employerCheck);
    contacts.push({
      source:'google-sheets', sheetRow:r.__sheetRow,
      id:'contact:'+(r['LinkedIn URL'] ? 'linkedin:'+slug(r['LinkedIn URL']) : r.Email ? 'email:'+slug(r.Email) : 'name:'+slug(r.Name)+':'+slug(r['Company in CareerLink'])),
      name:r.Name, directoryEmployer:r['Company in CareerLink'] || null,
      currentEmployer:checked ? (r['Current Employer'] || null) : null,
      reportedEmployer:r['Current Employer'] || null, employerCheck,
      checkedOn:asISODate(r['Verified On']), evidenceUrl:r['Verification Evidence URL'] || null,
      email:r.Email || null, linkedinUrl:r['LinkedIn URL'] || null,
      outreachStatus:r['Outreach Status'] || 'Not started',
      notes:r['Personalization Notes'] || ''
    });
  }
  return {contacts,warnings};
}
export function convertSnapshot({applicationValues=[], contactValues=[]}={}) {
  const a=convertApplications(applicationValues), c=convertContacts(contactValues);
  return {schemaVersion:1, applications:a.applications, contacts:c.contacts, warnings:[...a.warnings,...c.warnings]};
}
export async function pullSnapshot({spreadsheetId,accessToken,fetchImpl=fetch}) {
  if (!spreadsheetId || !accessToken) throw new Error('Spreadsheet ID and a consented OAuth token are required');
  async function readTab(tab) {
    const range="'"+tab.replaceAll("'","''")+"'!A1:S1700";
    const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(spreadsheetId)+'/values/'+encodeURIComponent(range)+'?valueRenderOption=FORMATTED_VALUE';
    const response=await fetchImpl(url,{headers:{Authorization:'Bearer '+accessToken}});
    if (!response.ok) throw new Error('Google Sheets read failed ('+response.status+') for '+tab);
    const body=await response.json();
    return body.values || [];
  }
  const [applicationValues,contactValues]=await Promise.all([readTab(TAB_NAMES.applications),readTab(TAB_NAMES.contacts)]);
  return convertSnapshot({applicationValues,contactValues});
}
