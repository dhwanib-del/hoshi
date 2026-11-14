// Watch company boards, never keyword-crawl the market or scrape LinkedIn.
import {addJob,cleanText} from './model.js';
export const PROVIDERS={
 greenhouse:{host:'https://boards-api.greenhouse.io/*',coverage:'documented'},
 lever:{host:'https://api.lever.co/*',coverage:'documented'},
 ashby:{host:'https://api.ashbyhq.com/*',coverage:'documented'}
};
const err=(stage,message)=>({jobs:[],complete:false,errors:[{stage,message:String(message).slice(0,240)}]});
const iso=v=>{const ms=v==null?NaN:Date.parse(v);return Number.isFinite(ms)?new Date(ms).toISOString():null};
export function parseBoardUrl(input){
 let u;try{u=new URL(input)}catch{return null}
 if(u.protocol!=='https:')return null;
 const segments=u.pathname.split('/').filter(Boolean);
 if(['job-boards.greenhouse.io','boards.greenhouse.io'].includes(u.hostname)&&segments[0])
  return {provider:'greenhouse',handle:segments[0],handleSource:'pasted',sourceUrl:u.origin+u.pathname,company:''};
 if(u.hostname==='jobs.lever.co'&&segments[0])
  return {provider:'lever',handle:segments[0],handleSource:'pasted',sourceUrl:u.origin+u.pathname,company:''};
 if(u.hostname==='jobs.ashbyhq.com'&&segments[0])
  return {provider:'ashby',handle:segments[0],handleSource:'pasted',sourceUrl:u.origin+u.pathname,company:''};
 return null;
}
export function normalizedJob(raw,board,fields){
 if(!fields.title||!fields.applyUrl||!fields.providerJobId)throw Error('Missing title, URL, or provider ID');
 const url=new URL(fields.applyUrl);
 if(url.protocol!=='https:')throw Error('Invalid apply URL');
 return {
  title:cleanText(fields.title,200),company:board.company,location:cleanText(fields.location,140),
  applyUrl:url.href,submitUrl:fields.submitUrl||null,
  provider:board.provider,providerJobId:String(fields.providerJobId),
  employmentType:fields.employmentType||null,workplaceType:fields.workplaceType||null,
  timestamps:{publishedAt:iso(fields.publishedAt),modifiedAt:iso(fields.modifiedAt),discoveredAt:new Date().toISOString(),repostedAt:null},
  // Do not store full description HTML; job stores otherwise exhaust 10MB quickly.
  descriptionText:cleanText(fields.descriptionText?.replace(/<[^>]*>/g,' ').replace(/\s+/g,' '),1800),
  // No listingState here. PRD §8.8 (2026-11-09): `live` is an observation, not
  // a thing a producer writes when it mints a row — applyBoardResult sets it
  // from the response that contained the job, with the instant it saw it.
  origin:'discovery',boardId:board.id,
  provenance:fields.provenance||{}
 };
}
export async function listJobs(board,fetchImpl=fetch){
 if(!board.handle||!board.company)return err('config','Board must name a company and provider handle');
 const api=board.provider==='greenhouse'?'https://boards-api.greenhouse.io/v1/boards/'+encodeURIComponent(board.handle)+'/jobs?content=true':
 board.provider==='lever'?'https://api.lever.co/v0/postings/'+encodeURIComponent(board.handle)+'?mode=json':
 board.provider==='ashby'?'https://api.ashbyhq.com/posting-api/job-board/'+encodeURIComponent(board.handle)+'?includeCompensation=true':null;
 if(!api)return err('provider','Unsupported or undocumented provider; manual board review required');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 let res,json;
 try{res=await fetchImpl(api,{signal:controller.signal});if(!res.ok)return err('http','Board HTTP '+res.status);
  json=await res.json();
 }catch(e){return err('fetch',e?.message||'Unable to fetch board');}finally{clearTimeout(timer);}
 const items=board.provider==='greenhouse'?json?.jobs:board.provider==='lever'?json:json?.jobs;
 if(!Array.isArray(items))return err('schema','Unexpected board response; refusing to infer jobs');
 const jobs=[];
 try{
  for(const it of items){
   const fields=board.provider==='greenhouse'?{
    title:it.title,applyUrl:it.absolute_url,providerJobId:it.id,location:it.location?.name,
    descriptionText:it.content,
    // updated_at moves on an edit or a repost, so it is a modification and not a
    // posting date (PRD §9.5). first_published is the real one where present.
    publishedAt:it.first_published||null,modifiedAt:it.updated_at||null,
    provenance:{title:{source:'discovery',adapter:'greenhouse',path:'jobs[].title'},
     publishedAt:{source:'discovery',adapter:'greenhouse',path:'jobs[].first_published'},
     modifiedAt:{source:'discovery',adapter:'greenhouse',path:'jobs[].updated_at'}}
   }:board.provider==='lever'?{
    // hostedUrl is the page the user's browser lands on; applyUrl is that plus
    // /apply, so storing applyUrl breaks §8.5 key 1. Prefer hostedUrl and keep
    // the apply link beside it. (PRD §8.5, 2026-11-02.)
    title:it.text,applyUrl:it.hostedUrl||it.applyUrl,submitUrl:it.applyUrl||null,
    providerJobId:it.id,location:it.categories?.location,
    employmentType:it.categories?.commitment,workplaceType:it.workplaceType,
    descriptionText:it.descriptionPlain||it.description,
    publishedAt:Number.isFinite(it.createdAt)?new Date(it.createdAt).toISOString():null,
    provenance:{title:{source:'discovery',adapter:'lever',path:'postings[].text'},
     applyUrl:{source:'discovery',adapter:'lever',path:'postings[].hostedUrl'},
     publishedAt:{source:'discovery',adapter:'lever',path:'postings[].createdAt'}}
   }:{
    title:it.title,applyUrl:it.jobUrl||it.applyUrl,providerJobId:it.id,location:it.location,
    employmentType:it.employmentType,workplaceType:it.workplaceType,
    descriptionText:it.descriptionHtml,
    publishedAt:it.publishedAt||null,modifiedAt:it.updatedAt||null,
    provenance:{title:{source:'discovery',adapter:'ashby',path:'jobs[].title'},
     publishedAt:{source:'discovery',adapter:'ashby',path:'jobs[].publishedAt'}}
   };
   jobs.push(normalizedJob(it,board,fields));
  }
 }catch(e){return err('schema',e.message)}
 return {jobs,complete:true,errors:[]};
}
export function applyBoardResult(state,boardId,result,at=new Date().toISOString()){
 const boards=state.boards.map(b=>b.id!==boardId?b:{
  ...b,lastPolledAt:at,lastCompleteAt:result.complete&&!result.errors.length?at:b.lastCompleteAt,
  lastError:result.errors.map(e=>e.stage+': '+e.message).join('; ')||null
 });
 let next={...state,boards};
 if(!result.complete||result.errors.length||result.truncated)return next; // absence is NOT evidence on partial responses
 const board=state.boards.find(b=>b.id===boardId);
 const identifiers=new Set(result.jobs.map(j=>j.provider+':'+j.providerJobId));
 // PRD §8.8 (2026-11-02): closure keys on the provider's job id and IGNORES which
 // path created the record. Absence from a complete response is an observation
 // about the board, not about the extractor — exempting page-captured jobs left
 // the roles the user actually opened as the only ones that never closed.
 // Invariant (11): a null providerJobId is UNMATCHED, not absent, and closes
 // nothing. A record from another board, or from no board, is not compared.
 const sameBoard=j=>j.boardId===boardId
  || (j.origin==='page'&&!j.boardId&&board&&j.provider===board.provider&&j.harvestedBoard?.handle===board.handle);
 next={...next,jobs:next.jobs.map(j=>{
  if(!sameBoard(j)||j.listingState==='closed')return j;
  if(!j.providerJobId)return j.listingState==='unknown'?j:{...j,listingState:'unknown',unmatchedReason:'no provider job id to compare'};
  if(identifiers.has(j.provider+':'+j.providerJobId))return j;
  return {...j,listingState:'closed',closedAt:at,closedReason:'delisted'};
 })};
 for(const job of result.jobs)next=addJob(next,job);
 // PRD §8.8 (2026-11-09), the mirror of the closure pass above: presence in a
 // complete response is an observation too, and it is the ONLY thing that makes
 // a job live. Runs after the merge so it covers the rows this response just
 // added as well as the records the page path created — a job she opened at a
 // watched board used to stay `unknown` through every morning that board
 // confirmed it, while the same response was trusted to close it.
 next={...next,jobs:next.jobs.map(j=>{
  if(!sameBoard(j)||!j.providerJobId||!identifiers.has(j.provider+':'+j.providerJobId))return j;
  return {...j,listingState:'live',listingSeenAt:at,closedAt:null,closedReason:null,unmatchedReason:null};
 })};
 return next;
}
