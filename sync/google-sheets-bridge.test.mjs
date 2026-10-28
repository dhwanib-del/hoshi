import test from 'node:test';
import assert from 'node:assert/strict';
import {asISODate,convertApplications,convertContacts,convertSnapshot,pullSnapshot} from './google-sheets-bridge.mjs';

test('dates are validated',()=>{
  assert.equal(asISODate('10/28/2026'),'2026-10-28');
  assert.equal(asISODate('02/31/2026'),null);
});
test('incomplete forms are not submitted applications',()=>{
  const values=[['Company','Role','Status'],['Example','UX Designer','Incomplete']];
  assert.equal(convertApplications(values).applications[0].submitted,false);
});
test('unspecified job titles do not collapse across multiple applications',()=>{
  const values=[['Company','Role','Status'],['Example','Role not stated in email','Applied'],['Example','Role not stated in email','Applied']];
  assert.equal(convertApplications(values).applications.length,2);
});
test('obvious duplicate roles require review',()=>{
  const values=[['Company','Role','Status'],['Example','UX Designer','Applied'],['Example','UX Designer','Rejected']];
  const result=convertApplications(values);
  assert.equal(result.applications.length,1);
  assert.match(result.warnings.join(' '),/duplicate/i);
});
test('unverified employer is not promoted to current',()=>{
  const values=[['Name','Company in CareerLink','Current Employer','Employer Check'],['Person','Old Company','New Company','Needs verification'],['Person 2','Old Company','New Company','Changed employer']];
  const contacts=convertContacts(values).contacts;
  assert.equal(contacts[0].currentEmployer,null);
  assert.equal(contacts[1].currentEmployer,'New Company');
});
test('Google API sync is read-only and keeps token in memory',async()=>{
  let calls=0;
  const snapshot=await pullSnapshot({spreadsheetId:'example-id',accessToken:'short-lived',fetchImpl:async(url,options)=>{
    calls++;
    assert.match(url,/^https:\/\/sheets.googleapis.com\/v4\/spreadsheets\//);
    assert.equal(options.headers.Authorization,'Bearer short-lived');
    assert.equal(options.method,undefined);
    return {ok:true,json:async()=>({values:[]})};
  }});
  assert.equal(calls,2);
  assert.deepEqual(snapshot,convertSnapshot());
});
