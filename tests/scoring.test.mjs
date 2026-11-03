import test from 'node:test';import assert from 'node:assert/strict';
import {WEIGHTS,POINTS,GATE_POINTS,RANKED_FLOOR,SOFT_BLOCK,scoreJob,freshness,morningBrief,rate,activity,tierFor,freshJobs,coverage,portfolioMatch} from '../src/scoring.js';
import {recencyOf,isFresh} from '../src/freshness.js';
const profile={roleLanes:['product designer','ux researcher'],priorityThreshold:70};
const job={title:'Product Designer',company:'Example',listingState:'live',eligibility:'eligible',authorization:'unverified'};
test('weights sum to 100 and the ranked range is 55-100, not 0-100',()=>{
 assert.equal(Object.values(WEIGHTS).reduce((a,b)=>a+b,0),100);
 // Both gates are carried in full by every ranked job, so 40 points are a
 // constant and the floor is the gates plus the 15/25 role floor.
 assert.equal(GATE_POINTS,40);
 assert.equal(RANKED_FLOOR,55);
 // Connection is a third of what actually separates two ranked jobs.
 assert.equal(POINTS.C3/(100-RANKED_FLOOR),1/3);
 assert.ok(POINTS.C3>POINTS.C2&&POINTS.C2>POINTS.C1&&POINTS.C1>POINTS.C0,'tier ordering preserved');
 // Invariant 2, restated for the 2026-11-03 table: connection stays SMALLER
 // than role fit, so a clearly better-fitting job still wins. It is no longer
 // larger than the soft block, so §7.2's connection-tier tiebreak is now the
 // only place the tier is decisive between equals. This is a real change from
 // the pre-11-03 table and must not be "fixed" by nudging a weight.
 assert.ok(POINTS.C3<WEIGHTS.role,'a better-fitting job still beats a friend at a worse one');
 assert.ok(POINTS.C3<SOFT_BLOCK,'connection no longer outweighs freshness+portfolio+location');
});
test('portfolio relevance must name the project or score nothing',()=>{
 const folio=[{name:'Open Library multilingual accessibility',tags:['accessibility','multilingual']}];
 const withFolio={...profile,portfolioProjects:folio};
 const hit=portfolioMatch({title:'Product Designer, Accessibility',descriptionText:''},withFolio);
 assert.equal(hit.points,WEIGHTS.portfolio);
 assert.equal(hit.project,'Open Library multilingual accessibility');
 assert.match(hit.why,/matched on/);
 const miss=portfolioMatch({title:'Product Designer',descriptionText:'ads platform'},withFolio);
 assert.equal(miss.points,0);assert.equal(miss.project,null);
 assert.equal(portfolioMatch({title:'Product Designer'},{}).points,0,'no saved projects means no points');
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
test('edit dates cap freshness; an unverifiable age scores zero and says so',()=>{
 const now=new Date('2026-10-28T12:00:00Z');
 const ts=o=>({timestamps:{publishedAt:null,modifiedAt:null,discoveredAt:null,repostedAt:null,...o}});
 // PRD §9.5: no points without a date Hoshi can name.
 assert.equal(freshness(ts({}),now).points,0);
 // Discovery time is NOT evidence about when the employer posted.
 assert.equal(freshness(ts({discoveredAt:'2026-10-28T11:00:00Z'}),now).points,0);
 assert.match(freshness(ts({discoveredAt:'2026-10-28T11:00:00Z'}),now).line,/unverified/i);
 // Points are a share of WEIGHTS.freshness, so the band spacing holds at any
 // weight: 1 / 0.6 / 0.2 / 0 of the term.
 const F=WEIGHTS.freshness;
 // Invariant (4): an edit date can never earn the top band.
 assert.equal(freshness(ts({modifiedAt:'2026-10-28T11:00:00Z'}),now).points,Math.round(0.6*F));
 assert.equal(freshness(ts({publishedAt:'2026-10-28T11:00:00Z'}),now).points,F);
 assert.equal(freshness(ts({publishedAt:'2026-10-25T11:00:00Z'}),now).points,Math.round(0.6*F));
 assert.equal(freshness(ts({publishedAt:'2026-10-21T11:00:00Z'}),now).points,Math.round(0.2*F));
 assert.equal(freshness(ts({publishedAt:'2026-09-21T11:00:00Z'}),now).points,0);
 // A repost is the live requisition's own start and outranks the original.
 assert.equal(freshness(ts({publishedAt:'2026-01-01T00:00:00Z',repostedAt:'2026-10-28T11:30:00Z'}),now).points,F);
});
test('recency bands separate the first hour, six hours and day from older',()=>{
 const now=new Date('2026-10-28T12:00:00Z');
 const at=iso=>({timestamps:{publishedAt:iso}});
 assert.equal(recencyOf(at('2026-10-28T11:30:00Z'),now).band,'hour');
 assert.equal(recencyOf(at('2026-10-28T07:00:00Z'),now).band,'sixHours');
 assert.equal(recencyOf(at('2026-10-27T20:00:00Z'),now).band,'day');
 assert.equal(recencyOf(at('2026-10-20T12:00:00Z'),now).band,'older');
 assert.equal(recencyOf({timestamps:{}},now).band,'unverified');
 // A future-dated posting is refused rather than shown as brand new.
 assert.equal(recencyOf(at('2026-10-29T12:00:00Z'),now).band,'unverified');
 assert.equal(isFresh(at('2026-10-20T12:00:00Z'),now),false);
 assert.equal(isFresh(at('2026-10-28T11:00:00Z'),now),true);
});
test('invariant 12: an unverified gate is held, not scored low',()=>{
 const base={title:'Product Designer',company:'Example',listingState:'live'};
 const held=scoreJob({...base,eligibility:'eligible',authorization:'unverified'},profile,[],[]);
 assert.equal(held.total,null);
 assert.equal(held.gate,'held');
 assert.equal(held.rankable,false);
 assert.equal(held.promoted,false);
 assert.deepEqual(held.missingChecks,['sponsorship policy']);
 const ranked=scoreJob({...base,eligibility:'eligible',authorization:'confirmed'},profile,[],[]);
 assert.equal(ranked.gate,'ranked');
 assert.equal(ranked.rankable,true);
 // Every ranked job carries both gates in full, so the floor is 40, not 0.
 assert.ok(ranked.total>=RANKED_FLOOR,'ranked range starts at '+RANKED_FLOOR+': got '+ranked.total);
 assert.deepEqual(ranked.scale,{min:RANKED_FLOOR,max:100});
 const excluded=scoreJob({...base,eligibility:'eligible',authorization:'not-sponsored'},profile,[],[]);
 assert.equal(excluded.gate,'excluded');
 assert.equal(excluded.total,null);
});
test('fresh jobs group by verified age and count what is held',()=>{
 const mk=(id,iso,auth)=>({id,title:'Product Designer',company:'Example',listingState:'live',
  eligibility:'eligible',authorization:auth,timestamps:{publishedAt:iso}});
 const now=new Date('2026-10-28T12:00:00Z');
 const s={profile:{...profile,locations:['United States']},people:[],events:[],boards:[],
  jobs:[mk('a','2026-10-28T11:40:00Z','confirmed'),mk('b','2026-10-01T00:00:00Z','confirmed'),
   mk('c','2026-10-28T11:50:00Z','unverified'),{id:'d',title:'Product Designer',company:'Example',
    listingState:'closed',eligibility:'eligible',authorization:'confirmed',timestamps:{publishedAt:'2026-10-28T11:00:00Z'}}]};
 const f=freshJobs(s,now);
 assert.equal(f.open,3,'closed jobs leave the fresh board');
 assert.equal(f.bands.hour.length,2);
 assert.equal(f.bands.older.length,1);
 assert.equal(f.held,1);
 // A held row still appears, but sorts below every scored row.
 assert.equal(f.bands.hour[0].job.id,'a');
 assert.equal(f.bands.hour[1].job.id,'c');
});
test('coverage never claims real-time monitoring',()=>{
 const c=coverage({boards:[{company:'Ex',lastCompleteAt:'2026-10-28T06:00:00Z'},{company:'Stale'}]},new Date('2026-10-28T12:00:00Z'));
 assert.match(c.mode,/not real-time/i);
 assert.equal(c.boards,2);assert.equal(c.verified,1);
 assert.deepEqual(c.staleBoards,['Stale']);
 assert.ok(c.notCovered.some(x=>/LinkedIn/.test(x)));
});
test('Wilson intervals appear only with 10 or more observations',()=>{
 assert.equal(rate(4,8,'x').visible,false);const r=rate(3,10,'x');assert.equal(r.visible,true);assert.match(r.summary,/\(.*–.*\)/);
});
test('no fabricated stats from job stages',()=>{
 const a=activity({events:[]});assert.equal(a.counts.submissions,0);assert.equal(a.rates[0].visible,false);
});
