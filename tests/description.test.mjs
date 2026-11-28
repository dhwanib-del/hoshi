import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DESCRIPTION_CAP,boundDescription,descriptionCoverage,addJob,stateFrom} from '../src/model.js';
import {portfolioMatch} from '../src/scoring.js';
import {captureCurrentPage} from '../src/capture.js';

// PRD §8.4 / invariant (22), 2026-11-16. §8.4 promises ONE shape from two
// producers; the bound on its description field was written separately in each,
// at 1400 on the page path and 1800 on the adapter path, so the same requisition
// stored a different amount of text depending on how she met it.
test('one cap, defined once, and neither producer carries its own literal',()=>{
 const text='x'.repeat(DESCRIPTION_CAP+500);
 const bound=boundDescription(text,DESCRIPTION_CAP);
 assert.equal(bound.descriptionText.length,DESCRIPTION_CAP);
 assert.equal(bound.descriptionSourceChars,DESCRIPTION_CAP+500);
 assert.equal(boundDescription('','x'===''?1:DESCRIPTION_CAP).descriptionSourceChars,null);
 // The bound is passed in, never local. These bite if either is re-inlined.
 assert.ok(!readFileSync('src/capture.js','utf8').includes('1400'));
 assert.ok(!readFileSync('src/discovery.js','utf8').match(/,\s*1800\s*\)/));
 // Absent, each producer refuses rather than storing under a bound nobody set.
 assert.throws(()=>boundDescription('text',undefined),/cap/);
 assert.match(captureCurrentPage(undefined).error,/description bound/);
});

test('a stored description carries the length it was cut from, or the write is refused',()=>{
 const job={title:'Product Designer',company:'Example',descriptionText:'some text'};
 assert.throws(()=>addJob(stateFrom(),job),/descriptionSourceChars/);
 const ok=addJob(stateFrom(),{...job,descriptionSourceChars:9});
 assert.equal(ok.jobs[0].descriptionSourceChars,9);
 // Three states, never two: "cut" and "stored before this rule existed" both
 // forbid reporting absence, so both read `partial`.
 assert.equal(descriptionCoverage({}),'none');
 assert.equal(descriptionCoverage({descriptionText:'t',descriptionSourceChars:1}),'full');
 assert.equal(descriptionCoverage({descriptionText:'x'.repeat(DESCRIPTION_CAP),descriptionSourceChars:DESCRIPTION_CAP+1}),'partial');
 assert.equal(descriptionCoverage({descriptionText:'legacy row'}),'partial');
});

// PRD §8.5 (2026-11-16): the page record wins because it is the higher-fidelity
// one, and fidelity is a property of a field rather than of a record. The page
// path's description is JSON-LD prose, often a summary; the adapter's is the
// provider's own field.
test('the less-cut description wins whichever path it came from, with its provenance',()=>{
 const base={title:'Product Designer',company:'Example',applyUrl:'https://jobs.lever.co/ex/123'};
 let s=addJob(stateFrom(),{...base,origin:'page',descriptionText:'short summary',descriptionSourceChars:13,
  provenance:{descriptionText:'JSON-LD JobPosting.description',title:'h1'}});
 s=addJob(s,{...base,origin:'discovery',descriptionText:'the provider’s own much longer description field',descriptionSourceChars:4200,
  provenance:{descriptionText:{source:'discovery',adapter:'lever',path:'postings[].descriptionPlain'}}});
 assert.equal(s.jobs.length,1);
 assert.match(s.jobs[0].descriptionText,/much longer/);
 assert.equal(s.jobs[0].descriptionSourceChars,4200);
 assert.equal(s.jobs[0].provenance.descriptionText.path,'postings[].descriptionPlain');
 // The rest of §8.5 is untouched: the page record still wins on other fields.
 assert.equal(s.jobs[0].provenance.title,'h1');
});

// §9.6's unmatched band one term over, and §8.8's rule a third time: a failure
// to see is not an observation of absence. A cap can only hide a tag, never
// invent one, so the zero is the only place truncation can lie.
test('portfolio reports what it read, and never absence over text it only partly saw',()=>{
 const profile={portfolioProjects:[{name:'Open Library multilingual accessibility',tags:['accessibility']}]};
 const cut={title:'Product Designer',descriptionText:'x'.repeat(DESCRIPTION_CAP),descriptionSourceChars:DESCRIPTION_CAP+2000};
 const miss=portfolioMatch(cut,profile);
 assert.equal(miss.points,0);
 assert.equal(miss.coverage,'partial');
 assert.doesNotMatch(miss.why,/no saved project matches this posting/);
 assert.match(miss.why,/the rest was not read/);
 // A whole description that genuinely does not match still says so plainly.
 const whole=portfolioMatch({title:'Product Designer',descriptionText:'ads platform',descriptionSourceChars:12},profile);
 assert.equal(whole.coverage,'full');
 assert.match(whole.why,/no saved project matches this posting/);
 // No description at all is a third claim again, not the same as no match.
 assert.match(portfolioMatch({title:'Product Designer'},profile).why,/no description stored/);
 // And a hit inside the stored text is still a hit, at full points.
 const hit=portfolioMatch({...cut,descriptionText:'accessibility work'},profile);
 assert.equal(hit.project,'Open Library multilingual accessibility');
 assert.ok(hit.points>0);
});
