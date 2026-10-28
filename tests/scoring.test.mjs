import test from 'node:test';import assert from 'node:assert/strict';
import {WEIGHTS,POINTS,scoreJob,freshness,morningBrief,rate,activity,tierFor} from '../src/scoring.js';
const profile={roleLanes:['product designer','ux researcher'],priorityThreshold:70};
const job={title:'Product Designer',company:'Example',listingState:'live',eligibility:'eligible',authorization:'unverified'};
test('weights sum to 100; C3 balances soft terms, not role+experience',()=>{
 assert.equal(Object.values(WEIGHTS).reduce((a,b)=>a+b,0),100);
 assert.equal(POINTS.C3,WEIGHTS.company+WEIGHTS.narrative+WEIGHTS.location+WEIGHTS.freshness);
 assert.ok(POINTS.C3<WEIGHTS.role+WEIGHTS.experience);
});
test('named and provenanced people required to earn connection points',()=>{
 const p={id:'c',name:'A',currentEmployer:'Example',origin:'user',saved:true,sharedContext:'UMSI'};
 assert.equal(scoreJob(job,profile,[],[]).tier,'C0');
 assert.equal(scoreJob(job,profile,[{...p,origin:''}],[]).tier,'C0');
 assert.equal(scoreJob(job,profile,[p],[]).tier,'C2');
});
test('C3 requires explicit reply record; cooldown after 21 days',()=>{
 const p={id:'c',name:'A',currentEmployer:'Example',origin:'user',saved:true};
 const send={kind:'outreach',contactId:'c',step:'sent',at:'2026-10-01T00:00:00Z'};
 assert.equal(tierFor('Example',[p],[send],new Date('2026-10-25')).tier,'C1');
 assert.equal(tierFor('Example',[p],[send,{kind:'reply',contactId:'c',at:'2026-10-22'}],new Date('2026-10-25')).tier,'C3');
});
test('connection does not admit an unrelated role',()=>{
 const p={id:'c',name:'Person',currentEmployer:'Example',origin:'user',saved:true};
 const r=scoreJob({...job,title:'Warehouse Manager'},profile,[p],[{kind:'reply',contactId:'c',at:'2026-10-28'}]);
 assert.equal(r.promoted,false);assert.equal(r.roleFit,0);
});
test('updated dates cap freshness at 3',()=>{
 const now=new Date('2026-10-28T12:00:00Z');
 assert.equal(freshness({dateKind:'none',date:null},now).points,0);
 assert.equal(freshness({dateKind:'updated',date:'2026-10-28'},now).points,3);
 assert.equal(freshness({dateKind:'posted',date:'2026-10-28'},now).points,5);
});
test('Wilson intervals appear only with 10 or more observations',()=>{
 assert.equal(rate(4,8,'x').visible,false);const r=rate(3,10,'x');assert.equal(r.visible,true);assert.match(r.summary,/\(.*–.*\)/);
});
test('no fabricated stats from job stages',()=>{
 const a=activity({events:[]});assert.equal(a.counts.submissions,0);assert.equal(a.rates[0].visible,false);
});
