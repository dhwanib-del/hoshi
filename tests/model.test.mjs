import test from 'node:test';import assert from 'node:assert/strict';
import {DEFAULTS,stateFrom,safeProfile,addJob,appendEvent,mayMarkApplied,markOutcome,jobStage,saveAnswer,usableAnswer,stardust,jobIdentity} from '../src/model.js';
test('safe profile has no protected fields even when supplied',()=>{
 const p=safeProfile({roleLanes:['ux designer'],race:'unspecified',gender:'woman',disability:'no',birthDate:'2004',priorityThreshold:200});
 assert.deepEqual(Object.keys(p).sort(),['priorityThreshold','roleLanes']);assert.equal(p.priorityThreshold,100);
});
test('job dedupe uses canonical URLs; a page observation is not overwritten by discovery',()=>{
 let s=stateFrom(),j={title:'Product Designer',company:'Example',location:'US',applyUrl:'https://jobs.lever.co/ex/123?utm=foo',origin:'page',descriptionText:'A'};
 s=addJob(s,j);s=addJob(s,{...j,applyUrl:'https://jobs.lever.co/ex/123',origin:'discovery',descriptionText:'B'});
 assert.equal(s.jobs.length,1);assert.equal(s.jobs[0].descriptionText,'A');
});
test('no submission without a human confirmation',()=>{
 let s=addJob(stateFrom(),{title:'UX Researcher',company:'Example'});
 assert.throws(()=>mayMarkApplied(s,s.jobs[0].id),/confirmation/);
 assert.equal(s.events.length,0);
 s=mayMarkApplied(s,s.jobs[0].id,{confirm:true,source:'user'});
 assert.equal(s.events.length,1);assert.equal(s.events[0].kind,'submission');
 assert.equal(s.events[0].personAttached,null);
 s=mayMarkApplied(s,s.jobs[0].id,{confirm:true});
 assert.equal(s.events.length,1);
});
test('job stage derives only from append-only events',()=>{
 let s=addJob(stateFrom(),{title:'UX Designer',company:'Example'});
 const id=s.jobs[0].id;s=mayMarkApplied(s,id,{confirm:true});
 assert.equal(jobStage(s.events,id),'marked submitted');
 s=markOutcome(s,id,'interview');assert.equal(jobStage(s.events,id),'interview');
 assert.equal(s.events.at(-1).kind,'outcome');
});
test('answer bank never stores demographic questions',()=>{
 const s=stateFrom();
 for(const q of ['Race / ethnicity','Disability disclosure','Veteran status','Gender identity'])
  assert.throws(()=>saveAnswer(s,{question:q,answer:'yes',scope:'employer-independent'}),/Protected/);
});
test('employer-specific answers need an edit after application creation',()=>{
 let s=saveAnswer(stateFrom(),{question:'Why us?',answer:'I like this company',scope:'employer-specific',company:'A'});
 const a=s.answers[0];
 assert.equal(usableAnswer(a,{question:'Why us?',company:'B',applicationCreatedAt:'2026-01-01'}).fill,false);
 assert.equal(usableAnswer(a,{question:'Why us?',company:'A',applicationCreatedAt:'2090-01-01'}).fill,false);
 assert.equal(usableAnswer(a,{question:'Why us?',company:'A',applicationCreatedAt:'2020-01-01'}).fill,true);
});
test('outreach stardust outweighs max submission volume',()=>{
 const events=[...Array.from({length:6},()=>({kind:'outreach',step:'sent',at:'2026-10-28T12:00:00Z'})),...Array.from({length:7},()=>({kind:'submission',at:'2026-10-28T12:00:00Z'}))];
 assert.equal(stardust(events,'2026-10-28'),275);
 assert.equal(stardust(events.filter(x=>x.kind==='submission'),'2026-10-28'),75);
});