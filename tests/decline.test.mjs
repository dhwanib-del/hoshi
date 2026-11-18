// PRD §9.2 invariant (24), added 2026-11-18.
//
// C3 is defined as "a contact at the company who has replied, or is recorded as
// willing to refer", and the tier table's own header says the tiers score what
// the person can do TODAY. But the computation read a reply row's EXISTENCE, so
// a contact who wrote back "I've left, I can't refer you" scored C3 — the whole
// connection weight, the largest single award in the term, identical to a
// referral offer — and C3 never decays, so it was permanent.
//
// The vocabulary is why it could not be recorded otherwise: the `outcome` kind
// has carried `rejected` since 2026-10-16, so the APPLICATION funnel's enum
// could say no, while the conversation funnel's — the one the thesis runs on —
// had `replied` and `refer-offered` and nothing else. The decline had to be
// stored as `replied`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {tierFor,latestAnswer,POINTS,C1_BASES,TIER_ARMS,tierPopulation,byTier,
 conversationBrief,conversationsBlock,DECAY_DAYS,COOLING_LEAD_DAYS,WEIGHTS_VERSION} from '../src/scoring.js';
import {appendEvent,stateFrom,REPLY_STEPS} from '../src/model.js';

const NOW=new Date('2026-11-18T08:00:00Z');
const ago=n=>new Date(NOW.getTime()-n*86400000).toISOString();
const person=(id,name)=>({id,name,currentEmployer:'Acme',origin:'user-typed',saved:true,
 rankSource:'manual',sharedContext:'UMSI',employerAsOf:null});
const sent=(id,thread,n)=>({kind:'outreach',threadId:thread,contactId:id,channel:'email',step:'sent',at:ago(n)});
const answer=(id,thread,step,n)=>({kind:'reply',threadId:thread,contactId:id,source:'user',step,
 at:ago(n),arrived:{kind:'stated',at:ago(n)}});

test('invariant 24: a decline is C1, below an unanswered C2, and never C3',()=>{
 const p=[person('a','Ada')];
 const declined=tierFor('Acme',p,[sent('a','t1',30),answer('a','t1','declined',29)],NOW);
 const offered=tierFor('Acme',p,[sent('a','t1',30),answer('a','t1','refer-offered',29)],NOW);
 const plain=tierFor('Acme',p,[sent('a','t1',30),answer('a','t1','replied',29)],NOW);
 const silent=tierFor('Acme',p,[sent('a','t1',10)],NOW);
 assert.equal(declined.tier,'C1');
 assert.equal(declined.basis,'declined');
 assert.equal(offered.tier,'C3');
 assert.equal(plain.tier,'C3');
 // Silence is ambiguous and an explicit no is information, so the decline ranks
 // at or below the contact who never answered — and above C0, whose own line
 // reads "nobody found at this company", which is false of a person who wrote.
 assert.ok(POINTS[declined.tier]<POINTS[silent.tier],'a decline must not outrank silence');
 assert.ok(POINTS[declined.tier]>POINTS.C0,'a decline is not nobody');
 // Derived from the row, never stamped, and every basis is a real construction.
 assert.ok(C1_BASES.includes(declined.basis));
});

test('invariant 24: the latest counterparty row governs, and her sends do not move it',()=>{
 const p=[person('a','Ada')];
 const base=[sent('a','t1',40),answer('a','t1','declined',35)];
 // Monotone in evidence that is not hers (invariant 19's shape): a follow-up
 // after a decline does not restore the tier.
 assert.equal(tierFor('Acme',p,[...base,sent('a','t2',2)],NOW).tier,'C1');
 assert.equal(tierFor('Acme',p,[...base,sent('a','t2',2)],NOW).basis,'declined');
 // But a later answer from them does, in both directions — the repair for a row
 // already written is an append, because the tier is derived from the log.
 assert.equal(tierFor('Acme',p,[...base,answer('a','t2','refer-offered',1)],NOW).tier,'C3');
 assert.equal(tierFor('Acme',p,[sent('a','t1',40),answer('a','t1','refer-offered',35),
  answer('a','t1','declined',1)],NOW).basis,'declined');
 assert.equal(latestAnswer('a',[...base,answer('a','t2','replied',1)]).step,'replied');
});

test('invariant 24: the line names the answer and its date, in every band',()=>{
 const p=[person('a','Ada')];
 const line=events=>tierFor('Acme',p,events,NOW).reason;
 assert.match(line([sent('a','t1',30),answer('a','t1','declined',29)]),/could not help/);
 assert.match(line([sent('a','t1',30),answer('a','t1','refer-offered',29)]),/offered a referral/);
 assert.match(line([sent('a','t1',30),answer('a','t1','replied',29)]),/replied/);
 // Principle 6 and §9.4: each of the three prints the date of the answer that
 // produced it, so she can judge the claim rather than be handed a verdict.
 for(const step of REPLY_STEPS)
  assert.match(line([sent('a','t1',30),answer('a','t1',step,29)]),/Oct/,step+' names no date');
});

test('invariant 24: a reply that does not say what came back is refused at the write',()=>{
 const state=stateFrom({});
 // Fail closed on an append-only store means writing nothing, never coercing a
 // silent row to `replied` — the word that caused this defect.
 assert.throws(()=>appendEvent(state,{kind:'reply',threadId:'t1',contactId:'a',source:'user'}),
  /what came back/);
 assert.throws(()=>appendEvent(state,{kind:'reply',threadId:'t1',contactId:'a',source:'user',step:'ghosted'}),
  /what came back/);
 for(const step of REPLY_STEPS)
  assert.equal(appendEvent(state,{kind:'reply',threadId:'t1',contactId:'a',source:'user',step}).events.length,1);
});

test('invariant 24: a decline owes no response, so it holds no block 1 row',()=>{
 const state={people:[],jobs:[],events:[],profile:{}};
 for(const n of ['one','two','three']){
  const p=person('d'+n,'Decline '+n);state.people.push(p);
  state.events.push(sent(p.id,'x'+n,40),answer(p.id,'x'+n,'declined',39));
 }
 // One contact inside the cooling window, on a thread she has already followed
 // up: the only block 1 row type that expires (invariant 21).
 const cool=person('z','Zoe');state.people.push(cool);
 state.events.push(sent('z','zz',DECAY_DAYS-COOLING_LEAD_DAYS+1),
  {kind:'outreach',threadId:'zz',contactId:'z',channel:'email',step:'followup',at:ago(2)});
 const rows=conversationBrief(state,NOW);
 assert.equal(rows.length,1,'three declines qualified as "reply waiting" before invariant 24');
 assert.match(rows[0].why,/cooling/);
 assert.equal(rows[0].expires,true);
 const block=conversationsBlock(state,NOW);
 assert.equal(block.notShown,0);
 assert.equal(block.expiringNotShown,0,'the expiring row was dropped for three closed doors');
 // And a contact who answered warmly still owes her a reply.
 const warm={...state,people:[person('w','Wes')],
  events:[sent('w','w1',10),answer('w','w1','replied',9)]};
 assert.match(conversationBrief(warm,NOW)[0].why,/Reply waiting/);
});

test('invariant 24: the declined arm is a population of its own, never pooled',()=>{
 assert.deepEqual(TIER_ARMS,['C3','C2','C1·alum','C1·spent','C1·declined','C0']);
 assert.match(tierPopulation('C1·declined').label,/answered and could not help/);
 const row=(id,basis)=>({kind:'submission',source:'hoshi',jobId:id,at:ago(40),
  roleFit:20,totalScore:80,weightsVersion:WEIGHTS_VERSION,
  personAttached:{contactId:'c-'+id,tier:'C1',tierBasis:basis}});
 const set=byTier([row('a','alum'),row('b','spent'),row('c','declined')],x=>x.jobId==='c',' ');
 const n=Object.fromEntries(set.segments.map(s=>[s.population,s.n]));
 assert.equal(n[tierPopulation('C1·declined').label],1);
 // Three constructions, three arms: an alum she never used, a thread that went
 // unanswered, and a door she was told was shut are three different pieces of
 // evidence about the thesis, so one C1 bucket would pool all three.
 assert.equal(set.segments.filter(s=>s.population.startsWith('C1')).length,C1_BASES.length);
 assert.equal(set.comparison,null);
});
