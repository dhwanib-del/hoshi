import test from 'node:test';import assert from 'node:assert/strict';
import {addJob,stateFrom,jobIdentity,gateState,mayMarkApplied} from '../src/model.js';
import {applyBoardResult} from '../src/discovery.js';
import {mergeTimestamps,ageBasis} from '../src/freshness.js';

// PRD §8.5 (2026-11-02). The page the user opened and the board row for the same
// requisition must land on ONE record. Lever's hostedUrl and applyUrl differ by a
// trailing /apply, so the URL key misses; the provider's job id is what catches it.
const board={id:'b',provider:'lever',company:'Example',handle:'ex'};
const pageJob={title:'Product Designer',company:'Example',provider:'lever',providerJobId:'d2e897ae',
 applyUrl:'https://jobs.lever.co/ex/d2e897ae',origin:'page',listingState:'unknown',
 timestamps:{publishedAt:'2026-10-28T10:00:00Z',discoveredAt:'2026-10-28T10:05:00Z'}};
const boardJob={title:'Product Designer',company:'Example',provider:'lever',providerJobId:'d2e897ae',
 applyUrl:'https://jobs.lever.co/ex/d2e897ae/apply',origin:'discovery',boardId:'b',listingState:'live',listingSeenAt:'2026-11-08T06:00:00Z',
 timestamps:{publishedAt:'2026-10-28T10:00:00Z',discoveredAt:'2026-10-28T11:00:00Z'}};

test('a page capture and a board row for one requisition are one job',()=>{
 let s={...stateFrom(),boards:[board]};
 s=addJob(s,pageJob);
 assert.notEqual(jobIdentity(pageJob),jobIdentity(boardJob),'the two URLs really do differ');
 s=addJob(s,boardJob);
 assert.equal(s.jobs.length,1,'provider job id must dedup across the two paths');
 assert.equal(s.jobs[0].origin,'page','the page record is the higher-fidelity one');
});

test('closure keys on the provider id and ignores which path created the record',()=>{
 let s={...stateFrom(),boards:[board]};
 s=addJob(s,{...pageJob,boardId:'b'});
 const complete=applyBoardResult(s,'b',{jobs:[],complete:true,errors:[]});
 assert.equal(complete.jobs[0].listingState,'closed');
 assert.equal(complete.jobs[0].closedReason,'delisted');
});

test('invariant 11: a null provider job id is unmatched, not absent',()=>{
 let s={...stateFrom(),boards:[board]};
 s=addJob(s,{title:'No id',company:'Example',provider:'lever',providerJobId:null,
  applyUrl:'https://jobs.lever.co/ex/mystery',origin:'page',boardId:'b',listingState:'live'});
 const complete=applyBoardResult(s,'b',{jobs:[],complete:true,errors:[]});
 assert.notEqual(complete.jobs[0].listingState,'closed','a key that cannot be compared closes nothing');
 assert.equal(complete.jobs[0].listingState,'unknown');
});

test('a job at another board is never closed by this board’s response',()=>{
 let s={...stateFrom(),boards:[board,{id:'b2',provider:'ashby',company:'Other',handle:'other'}]};
 s=addJob(s,{...boardJob,boardId:'b2',provider:'ashby',providerJobId:'zz',listingSeenAt:'2026-11-08T06:00:00Z'});
 const complete=applyBoardResult(s,'b',{jobs:[],complete:true,errors:[]});
 assert.equal(complete.jobs[0].listingState,'live');
});

test('a requisition that comes back after a verified delisting is a repost',()=>{
 let s={...stateFrom(),boards:[board]};
 s=addJob(s,boardJob);
 s=applyBoardResult(s,'b',{jobs:[],complete:true,errors:[]});
 assert.equal(s.jobs[0].listingState,'closed');
 s=applyBoardResult(s,'b',{jobs:[boardJob],complete:true,errors:[]});
 assert.equal(s.jobs[0].listingState,'live');
 assert.ok(s.jobs[0].timestamps.repostedAt,'the return is recorded as a repost, not a silent restore');
 assert.equal(ageBasis(s.jobs[0]).basis,'reposted');
});

test('timestamps never let a weaker date overwrite a real publication date',()=>{
 const merged=mergeTimestamps({timestamps:{publishedAt:'2026-01-01T00:00:00Z',discoveredAt:'2026-01-02T00:00:00Z'}},
  {publishedAt:'2026-10-01T00:00:00Z',modifiedAt:'2026-10-02T00:00:00Z'});
 assert.equal(merged.publishedAt,'2026-01-01T00:00:00Z','original publication is kept verbatim');
 assert.equal(merged.modifiedAt,'2026-10-02T00:00:00.000Z','an edit date is allowed to move');
 assert.equal(merged.discoveredAt,'2026-01-02T00:00:00Z','first sighting is kept');
 assert.equal(mergeTimestamps(null,{publishedAt:'nonsense'}).publishedAt,undefined);
});

test('a held job marked applied records the user arm, not a Hoshi score',()=>{
 let s={...stateFrom()};
 s=addJob(s,{title:'Product Designer',company:'Example',eligibility:'eligible',authorization:'unverified'});
 assert.equal(gateState(s.jobs[0]).state,'held');
 s=mayMarkApplied(s,s.jobs[0].id,{confirm:true,source:'user'});
 const row=s.events.at(-1);
 assert.equal(row.source,'user');
 assert.equal(row.totalScore,undefined,'invariant 9: a user row carries no score');
 assert.equal(row.weightsVersion,undefined);
 assert.ok(row.recordedAt,'a user row carries recordedAt beside at');
 assert.throws(()=>mayMarkApplied({...stateFrom(),jobs:[{id:'x',title:'t',company:'c'}]},'x',{confirm:true,source:'hoshi'}),
  /score as at submit/,'a hoshi row without a score is refused rather than written empty');
});
