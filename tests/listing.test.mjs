import test from 'node:test';import assert from 'node:assert/strict';
import {addJob,stateFrom,listingStatus,LISTING_STALE_INTERVALS,POLL_INTERVAL_HOURS} from '../src/model.js';
import {applyBoardResult,listJobs} from '../src/discovery.js';

// PRD §8.8 (2026-11-09). The section specified what a complete response proves
// by ABSENCE and discarded what the same response proves by PRESENCE, so of the
// three listing states the only one a page-captured job could ever reach was
// `closed`: the board's answer was trusted to close a job she had opened and
// not to confirm it.
const board={id:'b',provider:'lever',company:'Example',handle:'ex'};
const pageJob={title:'Product Designer',company:'Example',provider:'lever',providerJobId:'d2e897ae',
 applyUrl:'https://jobs.lever.co/ex/d2e897ae',origin:'page',listingState:'unknown',boardId:'b',
 timestamps:{publishedAt:'2026-11-08T10:00:00Z',discoveredAt:'2026-11-08T10:05:00Z'}};
const boardRow={...pageJob,origin:'discovery',listingState:undefined,
 timestamps:{publishedAt:'2026-11-08T10:00:00Z',discoveredAt:'2026-11-09T06:00:00Z'}};
const MORNING='2026-11-09T06:00:00Z';

test('presence in a complete response confirms a page-captured job',()=>{
 let s={...stateFrom(),boards:[board]};
 s=addJob(s,pageJob);
 assert.equal(s.jobs[0].listingState,'unknown','nothing has confirmed it yet');
 s=applyBoardResult(s,'b',{jobs:[boardRow],complete:true,errors:[]},MORNING);
 assert.equal(s.jobs.length,1,'still one record');
 assert.equal(s.jobs[0].listingState,'live','the same response that could close it must be able to confirm it');
 assert.equal(s.jobs[0].listingSeenAt,MORNING,'the observation carries its instant');
});

test('invariant 17: a live claim with no observation behind it fails closed to unknown',()=>{
 let s={...stateFrom(),boards:[board]};
 s=addJob(s,{...pageJob,listingState:'live'});      // a producer asserting liveness
 assert.equal(s.jobs[0].listingState,'unknown','the claim is withdrawn, not kept');
 assert.equal(listingStatus(s.jobs[0]).state,'unknown');
 // and nothing in the adapter path mints one either
 const minted=listJobs({...board},async()=>({ok:true,json:async()=>[
  {text:'Product Designer',hostedUrl:'https://jobs.lever.co/ex/d2e897ae',applyUrl:'https://jobs.lever.co/ex/d2e897ae/apply',id:'d2e897ae',categories:{location:'Remote'}}]}));
 return minted.then(r=>{
  assert.equal(r.jobs[0].listingState,undefined,'an adapter does not write liveness; the response does');
 });
});

test('an incomplete response neither closes nor confirms',()=>{
 let s={...stateFrom(),boards:[board]};
 s=addJob(s,pageJob);
 s=applyBoardResult(s,'b',{jobs:[boardRow],complete:false,errors:[{stage:'http',message:'429'}]},MORNING);
 assert.equal(s.jobs[0].listingState,'unknown','a failure to observe is not an observation, in either direction');
 assert.equal(s.jobs[0].listingSeenAt,undefined);
});

test('a confirmation expires: §8.9 two intervals, derived and never stamped',()=>{
 let s={...stateFrom(),boards:[board]};
 s=addJob(s,pageJob);
 s=applyBoardResult(s,'b',{jobs:[boardRow],complete:true,errors:[]},MORNING);
 const job=s.jobs[0];
 const fresh=new Date(Date.parse(MORNING)+3600000);
 assert.equal(listingStatus(job,fresh).state,'live');
 const stale=new Date(Date.parse(MORNING)+(LISTING_STALE_INTERVALS*POLL_INTERVAL_HOURS+1)*3600000);
 assert.equal(listingStatus(job,stale).state,'unknown','an unpolled board stops asserting a listing');
 assert.equal(listingStatus(job,stale).seenAt,MORNING,'and still prints when it was last confirmed');
 assert.equal(job.listingState,'live','the stored value is the observation; the staleness is computed');
});

test('a page capture arriving later does not un-see this morning’s poll',()=>{
 let s={...stateFrom(),boards:[board]};
 s=addJob(s,boardRow);
 s=applyBoardResult(s,'b',{jobs:[boardRow],complete:true,errors:[]},MORNING);
 assert.equal(s.jobs[0].listingState,'live');
 s=addJob(s,{...pageJob,title:'Product Designer (II)'});   // she opens the posting afterwards
 assert.equal(s.jobs.length,1);
 assert.equal(s.jobs[0].listingState,'live','liveness is an observation about the board, not an extracted field');
 assert.equal(s.jobs[0].listingSeenAt,MORNING);
});
