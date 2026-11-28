import test from 'node:test';import assert from 'node:assert/strict';
import {BRIEF_CAPS,DECAY_DAYS,COOLING_LEAD_DAYS,conversationBrief,conversationsBlock,
 morningBrief} from '../src/scoring.js';

// PRD §7.3 invariant (21), added 2026-11-14. §7.1 caps block 1 at 3, and the cap
// is a silent exclusion: block 2's overflow falls to block 3 and is counted
// there (§9.6), while the fourth person due this morning fell nowhere at all —
// under a header reading "3 / 3", which is how full the cap is and reads as
// completeness. The order was also the inverse of what being dropped costs: the
// cooling row is the only type with an expiry and it sat last.
const NOW=new Date('2026-11-14T08:00:00Z');
const daysAgo=n=>new Date(NOW.getTime()-n*86400000).toISOString();
const person=(id,employer)=>({id,name:'Person '+id,origin:'typed by you',currentEmployer:employer,saved:true});
const sent=(id,n)=>({kind:'outreach',threadId:id+'t',contactId:id,at:daysAgo(n),step:'sent',channel:'email'});
// A cooling row needs the follow-up already sent: one unanswered send is the
// "follow-up due" row, and only after she has followed up once does §7.3's
// fourth type take over — which is exactly when the claim is nearly spent.
const cooling=id=>[sent(id,DECAY_DAYS-COOLING_LEAD_DAYS+1),
 {kind:'outreach',threadId:id+'t',contactId:id,at:daysAgo(1),step:'followup',channel:'email'}];
const replied=(id,n)=>({kind:'reply',threadId:id+'t',contactId:id,at:daysAgo(n),source:'user',step:'replied',arrived:{kind:'unknown'}});

test('invariant 21: the cap states what it did not show, and names the expiring rows',()=>{
 // Three replies waiting, plus one contact at day 19 of the 21-day clock.
 const people=[person('p1','Acme'),person('p2','Acme'),person('p3','Acme'),person('p4','Globex')];
 const events=[];
 for(const id of ['p1','p2','p3']){events.push(sent(id,10),replied(id,2));}
 events.push(...cooling('p4'));
 const state={people,events,jobs:[],profile:{}};
 const all=conversationBrief(state,NOW);
 assert.equal(all.length,4,'conversationBrief must not cap: the count cannot be derived from a sliced list');
 const block=conversationsBlock(state,NOW);
 assert.equal(block.rows.length,BRIEF_CAPS.conversations);
 assert.equal(block.notShown,all.length-BRIEF_CAPS.conversations,'derived from the same predicate that built the list');
 assert.equal(block.expiringNotShown,1,'the dropped row whose claim is gone tomorrow has to be countable');
 const brief=morningBrief(state,NOW);
 assert.equal(brief.conversationsNotShown,1);
 assert.equal(brief.conversationsExpiring,1);
});

test('invariant 21: an expiring reason outranks a persistent one of lower priority',()=>{
 // Cooling at day 19, against three "role at their company" rows, which persist
 // while the job is open. Before this the cooling row sat last and was dropped
 // on every one of the three mornings its claim was alive.
 const people=[person('c','Globex'),person('r1','Acme'),person('r2','Acme'),person('r3','Acme')];
 const jobs=[{id:'j1',company:'Acme',listingState:'live'}];
 const events=cooling('c');
 const block=conversationsBlock({people,events,jobs,profile:{}},NOW);
 assert.equal(block.qualified,4);
 assert.ok(block.rows.some(r=>/Connection cooling/.test(r.why)),'the only row that cannot come back must be shown');
 assert.equal(block.expiringNotShown,0);
 // And it is not promoted past a reply, which is a better morning honestly.
 const withReply=conversationsBlock({people:[...people,person('q','Initech')],
  events:[...events,sent('q',10),replied('q',1)],jobs,profile:{}},NOW);
 assert.match(withReply.rows[0].why,/Reply waiting/);
});

test('invariant 21: the caps have one definition and the uncapped list is longer than the block',()=>{
 assert.equal(BRIEF_CAPS.conversations,3);
 assert.equal(BRIEF_CAPS.promoted,5);
 const people=Array.from({length:6},(_,i)=>person('x'+i,'Acme'));
 const events=people.flatMap(p=>[sent(p.id,10),replied(p.id,2)]);
 const state={people,events,jobs:[],profile:{}};
 assert.equal(conversationBrief(state,NOW).length,6);
 const block=conversationsBlock(state,NOW);
 assert.equal(block.rows.length,BRIEF_CAPS.conversations);
 assert.equal(block.notShown,6-BRIEF_CAPS.conversations,'the count must track the cap, not a literal 3');
});
