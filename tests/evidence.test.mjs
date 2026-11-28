import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scoreJob,evidenceSplit,portfolioMatch,locationTerm,roleBand} from '../src/scoring.js';

// PRD §9.4 / invariant (27), 2026-11-24 (B-30). A 0 is a claim. Four runs gave
// four terms a 0 that distinguishes a failure to observe from an observation of
// absence (§9.6's unmatched, §9.5's dateKind 'none', §8.4's truncation, §9.1's
// held gates) and every one of those is reached on the POSTING's side of the
// comparison. Her side was never specified, so an empty profile asserted the
// negative — and the card pooled every zero into one chip regardless.
const NOW=new Date('2026-11-24T08:00:00Z');
const FULL={roleLanes:['UX Researcher'],locations:['Ann Arbor'],
 portfolioProjects:[{name:'BudgetCart',tags:['grocery']}]};
const EMPTY={roleLanes:[],locations:[],portfolioProjects:[]};
const BASE={company:'Northwind',eligibility:'eligible',authorization:'confirmed',
 location:'Seattle, WA',listingState:'unknown'};
const text='We are hiring a researcher for our enterprise logistics platform. '.repeat(8);
const OBSERVED={...BASE,id:'b',title:'UX Researcher, Logistics',
 timestamps:{publishedAt:'2026-11-04T08:00:00Z'},
 descriptionText:text,descriptionSourceChars:text.length};
const UNOBSERVED={...BASE,id:'a',title:'UX Researcher, Growth'};

// A person saved somewhere else, so C0 here is an answer and not an empty list.
const SOMEONE=[{id:'p1',name:'Priya Raman',currentEmployer:'Elsewhere',
 origin:'manual',employerAsOf:'2026-10-01'}];

test('invariant (27): two jobs whose zeros mean opposite things no longer render alike',()=>{
 const a=scoreJob(UNOBSERVED,FULL,SOMEONE,[],NOW),b=scoreJob(OBSERVED,FULL,SOMEONE,[],NOW);
 // Same total, same scored chips — the whole defect was that this was all the
 // card showed, with the difference locked behind a disclosure.
 assert.equal(a.total,b.total);
 const sa=evidenceSplit(a.terms),sb=evidenceSplit(b.terms);
 // Nothing was read for freshness or the description, so neither claims a zero.
 assert.deepEqual(sa.withheld.map(t=>t.key),['freshness','portfolio']);
 assert.deepEqual(sb.withheld.map(t=>t.key),[]);
 assert.ok(sa.missing.includes('no posting date'));
 assert.ok(sa.missing.includes('no description stored'));
 // And the one that did look keeps its zeros, because it earned them.
 assert.deepEqual(sb.zeros.map(t=>t.key).sort(),['connection','freshness','location','portfolio']);
});

test('invariant (27): an empty profile withholds a term rather than asserting the negative',()=>{
 const s=scoreJob(OBSERVED,EMPTY,[],[],NOW),split=evidenceSplit(s.terms);
 for(const key of ['role','portfolio','location','connection'])
  assert.equal(split.withheld.some(t=>t.key===key),true,key+' had no input to compare');
 const joined=s.lines.join('\n');
 // These two strings are the defect verbatim: a comparison that never ran,
 // printed as its result.
 assert.doesNotMatch(joined,/no saved project matches this posting/);
 assert.doesNotMatch(joined,/not one of the locations you listed/);
 assert.match(joined,/no saved project carries a tag/);
 assert.match(joined,/no locations saved/);
 assert.match(joined,/no role lanes saved/);
});

test('invariant (27): a withheld term is prefixed — and never +0',()=>{
 const s=scoreJob(UNOBSERVED,EMPTY,[],[],NOW);
 const withheld=new Set(evidenceSplit(s.terms).withheld.map(t=>t.key));
 assert.ok(withheld.size>0);
 for(const line of s.lines){
  const key=['role','eligibility','work authorization','connection','freshness','portfolio','location']
   .find(l=>line.includes(' '+l+' · '));
  const k=key==='work authorization'?'authorization':key;
  if(withheld.has(k))assert.match(line,/^— /,'a term with nothing to compare must not print +0: '+line);
  else assert.match(line,/^\+\d+ /,line);
 }
});

test('invariant (27): the claim partitions the terms totally and is derived',()=>{
 for(const [job,profile] of [[OBSERVED,FULL],[OBSERVED,EMPTY],[UNOBSERVED,EMPTY],
  [{...BASE,id:'h',title:'UX Researcher',eligibility:'unverified',authorization:'unverified'},FULL]]){
  const s=scoreJob(job,profile,[],[],NOW),split=evidenceSplit(s.terms);
  assert.equal(split.scored.length+split.zeros.length+split.withheld.length,s.terms.length,
   'every term is counted, named as withheld, or scored — no third option');
  for(const t of s.terms){
   if(t.points>0)assert.equal(t.claim,'scored');
   if(t.claim==='no-evidence'){assert.equal(t.points,0);assert.ok(t.missing,t.key+' must name the absent input');}
   if(t.claim==='zero')assert.equal(t.missing,null);
  }
  // Derived from the basis, not passed in: a claim asserted on the input is ignored.
  const forged=scoreJob({...job,claim:'scored',terms:[]},{...profile,claim:'scored'},[],[],NOW);
  assert.deepEqual(forged.terms.map(t=>t.claim),s.terms.map(t=>t.claim));
 }
});

test('invariant (27): an unchecked gate is withheld, and a posting with no location is not her fault',()=>{
 const held=scoreJob({...BASE,id:'h',title:'UX Researcher',eligibility:'unverified',
  authorization:'unverified'},FULL,[],[],NOW);
 const keys=evidenceSplit(held.terms).withheld.map(t=>t.key);
 assert.ok(keys.includes('eligibility')&&keys.includes('authorization'));
 // A field the provider never sent is not an observation about her list.
 const nowhere=locationTerm({location:''},FULL);
 assert.equal(nowhere.basis,'no-field');
 assert.match(nowhere.why,/this posting states no location/);
 // And the three posting-side zeros invariant (22) built are untouched.
 assert.equal(portfolioMatch(OBSERVED,FULL).basis,'no-match');
 assert.equal(portfolioMatch({...OBSERVED,descriptionText:undefined,
  descriptionSourceChars:undefined},FULL).basis,'no-description');
 assert.equal(roleBand({title:'Member of Technical Staff'},FULL).lanes,1);
});

test('invariant (27): the chips and the withheld count come from one array',()=>{
 const panel=readFileSync('src/panel.js','utf8');
 // The card must not re-derive its own groups from points — that is the pooling
 // this invariant removed, and it is the shape that would silently come back.
 assert.ok(panel.includes('evidenceSplit(score.terms)'));
 assert.ok(!panel.includes("score.terms.filter(t=>t.points===0)"));
 assert.ok(!panel.includes("score.terms.filter(t=>t.points>0)"));
});
