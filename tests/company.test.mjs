// PRD §9.2 invariant (28): one company join, and a relation Hoshi cannot settle
// is held out of the tier rather than scored as nobody being there.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {companyKey,companyMatch,jobIdentity} from '../src/model.js';
import {tierFor,scoreJob,conversationBrief,evidenceSplit,termLines,POINTS} from '../src/scoring.js';

const profile={roleLanes:['ux researcher'],locations:['Remote'],projects:[]};
const job=company=>({id:'j1',title:'UX Researcher',company,location:'Remote',
 eligibility:'eligible',authorization:'confirmed',listingState:'live',
 listingSeenAt:new Date().toISOString(),descriptionText:'ux research',descriptionSourceChars:11,timestamps:{}});
const person=employer=>({id:'p1',name:'Priya Raman',origin:'typed by you',
 currentEmployer:employer,saved:true,rankSource:'manual',sharedContext:'UMSI'});
const connectionTerm=(company,people)=>
 scoreJob(job(company),profile,people,[]).terms.find(x=>x.key==='connection');

test('the key is syntactic: legal forms come off the tail only, and one token always survives',()=>{
 assert.equal(companyKey('Stripe, Inc.'),'stripe');
 assert.equal(companyKey('The Coca-Cola Company'),'the coca cola');
 assert.equal(companyKey('  STRIPE  '),'stripe');
 // A leading "co" is part of the name, not a legal form in tail position.
 assert.equal(companyKey('Co-operative Travel'),'co operative travel');
 // A name made only of legal forms still has a key: the empty string would
 // match every other empty key, which is the join succeeding on no evidence.
 assert.equal(companyKey('Company'),'company');
 assert.equal(companyKey(''),'');
});

test('the four relations, and only two of them are a match',()=>{
 assert.deepEqual(companyMatch('Stripe','Stripe'),{match:true,relation:'exact'});
 assert.deepEqual(companyMatch('Stripe, Inc.','Stripe'),{match:true,relation:'normalised'});
 assert.deepEqual(companyMatch('Stripe','Stripe Technologies'),{match:false,relation:'unresolved'});
 assert.deepEqual(companyMatch('Alphabet','Google'),{match:false,relation:'different'});
 assert.deepEqual(companyMatch('','Stripe'),{match:false,relation:'incomparable'});
 // Hoshi never maps one name to another: a parent is not its subsidiary here.
 assert.equal(companyMatch('Meta','Facebook').match,false);
});

test('a tier survives a legal suffix, and a normalised win prints both strings',()=>{
 const people=[person('Stripe')];
 for(const spelling of ['Stripe','Stripe, Inc.','STRIPE','Stripe Inc']){
  const t=tierFor(spelling,people,[]);
  assert.equal(t.tier,'C2',spelling+' should still find her saved contact');
  assert.equal(POINTS[t.tier],10);
 }
 assert.match(tierFor('Stripe, Inc.',people,[]).reason,/matched “Stripe, Inc.” to your “Stripe”/);
 // An exact match does not carry the clause: it has nothing to disclose.
 assert.doesNotMatch(tierFor('Stripe',people,[]).reason,/matched/);
});

test('an unresolved near-miss is withheld and names the pair, never "nobody found"',()=>{
 const term=connectionTerm('Stripe, Inc.',[person('Stripe Technologies')]);
 assert.equal(term.points,0);
 assert.equal(term.claim,'no-evidence');
 assert.match(term.why,/Priya Raman is at “Stripe Technologies”/);
 assert.doesNotMatch(term.why,/Nobody found/);
 assert.equal(term.missing,'1 saved name Hoshi could not match to this company');
 // Invariant (27): a withheld term is prefixed `—` and never `+0`.
 assert.match(termLines([term])[0],/^— connection/);
 const split=evidenceSplit(scoreJob(job('Stripe, Inc.'),profile,[person('Stripe Technologies')],[]).terms);
 assert.ok(split.missing.includes('1 saved name Hoshi could not match to this company'));
 assert.equal(split.zeros.filter(x=>x.key==='connection').length,0);
});

test('a comparison that ran against every saved name is still a zero',()=>{
 const term=connectionTerm('Northline',[person('Elsewhere')]);
 assert.equal(term.claim,'zero');
 assert.match(term.why,/Nobody found at this company/);
 assert.equal(term.missing,null);
 // And an empty people list stays the no-evidence state invariant (27) gave it.
 assert.equal(connectionTerm('Northline',[]).claim,'no-evidence');
 assert.equal(connectionTerm('Northline',[]).missing,'no people saved');
});

test('the brief row and the tier answer the join the same way',()=>{
 const people=[person('Acme Corp')];
 for(const spelling of ['Acme Corp','acme corp','Acme Corp.']){
  const state={profile,people,jobs:[job(spelling)],events:[],answers:[]};
  assert.equal(tierFor(spelling,people,[]).tier,'C2');
  assert.deepEqual(conversationBrief(state).map(r=>r.why),['Role at their company'],
   spelling+' scored a tier, so the open role there must raise its row');
 }
});

test('dedup key 3 takes the same key, so a legal suffix is not a second record',()=>{
 const name=company=>jobIdentity({company,title:'UX Researcher',location:'Remote'});
 assert.equal(name('Figma'),name('Figma, Inc.'));
 assert.equal(name('Figma'),name('figma'));
 assert.notEqual(name('Figma'),name('Framer'));
});

test('no consumer compares company strings on its own',()=>{
 for(const file of ['../src/scoring.js','../src/panel.js']){
  const src=readFileSync(new URL(file,import.meta.url),'utf8');
  assert.ok(src.includes('companyMatch'),file+' must use the one join');
  // The three rules this invariant replaced, each as it was written.
  assert.doesNotMatch(src,/lower\(p\.currentEmployer\|\|p\.company\)===lower\(/);
  assert.doesNotMatch(src,/j\.company===\(p\.currentEmployer/);
  assert.doesNotMatch(src,/currentEmployer\|\|p\.company\|\|''\)\.toLowerCase\(\)===/);
 }
});
