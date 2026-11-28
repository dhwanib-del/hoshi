import test from 'node:test';import assert from 'node:assert/strict';
import {POINTS,DECAY_DAYS,decayClock,tierFor,conversationBrief} from '../src/scoring.js';

// PRD §9.2 invariant (19), added 2026-11-11. The tier belongs to the contact and
// the log's grain is the thread, so "21 days since the thread's outreach row" had
// as many answers as she has threads with that person. Reading the LATEST send
// made the clock hers to restart, in the direction that flatters: her own send
// bought back four points that only their reply can earn.
const NOW=new Date('2026-11-11T09:00:00Z');
const daysAgo=n=>new Date(NOW.getTime()-n*86400000).toISOString();
const priya={id:'p1',name:'Priya Raman',origin:'typed by you',currentEmployer:'Acme',
 saved:true,rankSource:'alumni',sharedContext:"UMSI '23"};
const sent=(thread,n)=>({kind:'outreach',threadId:thread,contactId:'p1',at:daysAgo(n),step:'sent',channel:'email'});
const followup=(thread,n)=>({kind:'outreach',threadId:thread,contactId:'p1',at:daysAgo(n),step:'followup',channel:'email'});
const rows=events=>conversationBrief({people:[priya],events,jobs:[],profile:{}},NOW);

test('invariant 19: a later send does not restore a spent C2',()=>{
 const cold=[sent('t1',40)];
 assert.equal(tierFor('Acme',[priya],cold,NOW).tier,'C1');
 // A second opening, messaged yesterday. Nothing has been learned about the path
 // — one more unanswered message is more evidence it is cold, not less.
 const second=[...cold,sent('t2',1)];
 assert.equal(tierFor('Acme',[priya],second,NOW).tier,'C1','her own send must not buy the tier back');
 assert.ok(POINTS.C2>POINTS.C1,'the spent claim has to cost points or the rule is decoration');
 // Only the other party restores it, and to C3 rather than to C2.
 const answered=[...second,{kind:'reply',threadId:'t2',contactId:'p1',at:daysAgo(0),source:'user',step:'replied',arrived:{kind:'unknown'}}];
 assert.equal(tierFor('Acme',[priya],answered,NOW).tier,'C3');
});

test('invariant 19: the clock runs from the earliest unanswered thread and prints the date that spent it',()=>{
 const clock=decayClock('p1',[sent('t1',40),followup('t1',30),sent('t2',1)],NOW);
 assert.equal(Math.round(clock.days),40,'earliest unanswered thread, never the latest');
 assert.equal(clock.messages,3,'every message she sent is counted for the line');
 assert.ok(clock.spent);
 const {reason}=tierFor('Acme',[priya],[sent('t1',40),sent('t2',1)],NOW);
 assert.match(reason,/no reply since/,'the line prints the date rather than asserting a cooled tier');
 assert.match(reason,/2 sends/);
 // Inside the window the claim is still alive.
 assert.equal(decayClock('p1',[sent('t1',DECAY_DAYS-1)],NOW).spent,false);
});

test('§7.3: the decaying row tracks their silence, not her last keystroke',()=>{
 // Day 20 of the thread, with a follow-up sent yesterday. Before invariant (19)
 // this row keyed off the most recent send, so following up moved the warning to
 // day 38 and the tier dropped with no warning at all.
 const row=rows([sent('t1',20),followup('t1',1)]);
 assert.equal(row.length,1);
 assert.match(row[0].why,/Connection cooling/);
 assert.match(row[0].why,/no reply since/);
 // Too early to warn, and spent after the window: the row is the last days the
 // claim is alive, not a verdict and not a nag.
 assert.equal(rows([sent('t1',10),followup('t1',1)]).length,0);
 assert.equal(rows([sent('t1',30),followup('t1',25)]).some(r=>/cooling/.test(r.why)),false);
});
