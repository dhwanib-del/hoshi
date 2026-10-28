import test from 'node:test';import assert from 'node:assert/strict';
import {parseBoardUrl,listJobs,applyBoardResult} from '../src/discovery.js';
import {addJob,stateFrom} from '../src/model.js';
test('only explicit hosted board handles are accepted',()=>{
 assert.equal(parseBoardUrl('https://careers.example.com/'),null);
 assert.deepEqual({...parseBoardUrl('https://jobs.lever.co/figma/123')}, {provider:'lever',handle:'figma',handleSource:'pasted',sourceUrl:'https://jobs.lever.co/figma/123',company:''});
 assert.equal(parseBoardUrl('http://jobs.lever.co/figma'),null);
});
test('non-2xx boards fail closed',async()=>{
 const r=await listJobs({provider:'lever',company:'Example',handle:'ex'},async()=>({ok:false,status:429}));
 assert.equal(r.complete,false);assert.deepEqual(r.jobs,[]);
});
test('schema mismatch fails closed, not partially parsed',async()=>{
 const r=await listJobs({provider:'greenhouse',company:'Example',handle:'ex'},async()=>({ok:true,json:async()=>({jobs:[{title:'Good',id:5,absolute_url:'https://a.test'},{bad:true}]})}));
 assert.equal(r.complete,false);assert.equal(r.jobs.length,0);
});
test('complete polls close delisted jobs, incomplete polls close nothing',()=>{
 const board={id:'b',provider:'lever',company:'Example',handle:'ex'};
 let s={...stateFrom(),boards:[board]};
 s=addJob(s,{title:'Old',company:'Example',applyUrl:'https://jobs.lever.co/ex/1',origin:'discovery',provider:'lever',providerJobId:'1',boardId:'b',listingState:'live'});
 const partial=applyBoardResult(s,'b',{jobs:[],complete:false,errors:[{stage:'http',message:'429'}]});
 assert.equal(partial.jobs[0].listingState,'live');
 const complete=applyBoardResult(s,'b',{jobs:[],complete:true,errors:[]});
 assert.equal(complete.jobs[0].listingState,'closed');assert.equal(complete.jobs[0].closedReason,'delisted');
});
