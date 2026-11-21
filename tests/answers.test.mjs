import test from 'node:test';import assert from 'node:assert/strict';
import {PROTECTED,bankWithdrawals,stateFrom,saveAnswer,usableAnswer} from '../src/model.js';
import {readFileSync} from 'node:fs';

// PRD invariant (8), restated 2026-11-12 over the DATA rather than the schema.
// These three assert the MECHANISM, not the guard's wording coverage: a
// deny-list cannot be tested for coverage, so what has to bite is the
// invariant over the whole store and the withdrawal when the list changes.

test('invariant 8 holds over the whole store, not only at the write site',()=>{
 // A bank as it would be after being stored under a narrower guard: the write
 // check never saw these wordings. The schema walk Principle 3 puts on the
 // profile cannot see them either, because the category is in a value.
 const stored=[
  {id:'1',question:'Are you Hispanic or Latino?',answer:'No',scope:'employer-independent'},
  {id:'2',question:'Please select your racial/ethnic category',answer:'Asian',scope:'employer-independent'},
  {id:'3',question:'Why do you want to work here?',answer:'I like the team',scope:'employer-specific',company:'Acme'}
 ];
 const walkForProtectedKey=(o,hit=[])=>{
  if(o&&typeof o==='object')for(const [k,v] of Object.entries(o)){if(PROTECTED.test(k))hit.push(k);walkForProtectedKey(v,hit);}
  return hit;
 };
 assert.deepEqual(walkForProtectedKey(stored),[],'the schema walk is satisfied by construction and proves nothing');
 const s=stateFrom({answers:stored});
 assert.equal(s.answers.length,1);
 assert.equal(s.answers[0].id,'3','an ordinary answer is not over-refused');
 for(const a of s.answers)assert.equal(PROTECTED.test(a.question),false,'no entry in the bank carries a question the guard matches');
});

test('widening the guard withdraws what it already stored, as a count and never as the wording',()=>{
 const s=stateFrom({answers:[
  {id:'1',question:'What are your pronouns?',answer:'she/her',scope:'employer-independent'},
  {id:'2',question:'Do you have a long-term physical or mental health condition?',answer:'No',scope:'employer-independent'}
 ],answersWithdrawn:1});
 assert.equal(s.answers.length,0);
 assert.equal(s.answersWithdrawn,3,'the count is cumulative across reads');
 // Printing a withdrawn question back would re-store the thing being refused.
 const serialized=JSON.stringify(s);
 for(const fragment of ['pronouns','health condition'])
  assert.equal(serialized.includes(fragment),false,'the withdrawn wording is not kept anywhere in state');
 // Re-reading a cleaned bank withdraws nothing further.
 assert.equal(bankWithdrawals(s.answers).withdrawn,0);
});

test('the guard refuses neither work authorization nor an ordinary free-text question',()=>{
 // PRD 11: sponsorship is the employer-independent answer the bank exists to
 // reuse, so a guard that swallowed it would break the section it protects.
 let s=stateFrom();
 for(const q of ['Will you now or in the future require sponsorship to work in the United States?',
                 'Are you legally authorized to work in the United States?',
                 'Expected graduation date','Notice period','Portfolio URL'])
  s=saveAnswer(s,{question:q,answer:'Yes',scope:'employer-independent'});
 assert.equal(s.answers.length,5);
 assert.equal(usableAnswer(s.answers[0],{question:s.answers[0].question,company:'Acme',applicationCreatedAt:null}).fill,true);
 assert.throws(()=>saveAnswer(s,{question:'Are you Hispanic or Latino?',answer:'No',scope:'employer-independent'}),/Protected/);
});

test('the injected fill functions take the one guard and refuse without it',()=>{
 // PRD invariant (13)'s lesson one domain over: these functions cannot import,
 // so a copied regex is the least-derived consumer of the same guard.
 const src=readFileSync(new URL('../src/autofill.js',import.meta.url),'utf8');
 assert.equal(/\/\\b\(rac|race\|ethnicity\|gender/.test(src),false,'no second copy of the guard is inlined here');
 assert.equal((src.match(/new RegExp\(guard,'i'\)/g)||[]).length,2,'both injected functions read the guard passed in');
 assert.match(src,/No protected-field guard supplied/,'absent, they refuse rather than fill unguarded');
 const bg=readFileSync(new URL('../src/background.js',import.meta.url),'utf8');
 assert.equal((bg.match(/PROTECTED\.source/g)||[]).length,2,'both call sites pass model.js PROTECTED');
});
