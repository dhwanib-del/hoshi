// Watch company boards, never keyword-crawl the market or scrape LinkedIn.
import {addJob,cleanText} from './model.js';
export const PROVIDERS={
 greenhouse:{host:'https://boards-api.greenhouse.io/*',coverage:'documented'},
 lever:{host:'https://api.lever.co/*',coverage:'documented'},
 ashby:{host:'https://api.ashbyhq.com/*',coverage:'documented'}
};
const err=(stage,message)=>({jobs:[],complete:false,errors:[{stage,message:String(message).slice(0,240)}]});
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
  applyUrl:url.href,provider:board.provider,providerJobId:String(fields.providerJobId),
  employmentType:fields.employmentType||null,workplaceType:fields.workplaceType||null,
  date:fields.date||null,dateKind:fields.dateKind||'none',
  // Do not store full description HTML; job stores otherwise exhaust 10MB quickly.
  descriptionText:cleanText(fields.descriptionText?.replace(/<[^>]*>/g,' ').replace(/\s+/g,' '),1800),
  origin:'discovery',boardId:board.id,listingState:'live',
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
    descriptionText:it.content,date:it.updated_at,dateKind:it.updated_at?'updated':'none',
    provenance:{title:{source:'discovery',adapter:'greenhouse',path:'jobs[].title'},date:{source:'discovery',adapter:'greenhouse',path:'jobs[].updated_at'}}
   }:board.provider==='lever'?{
    title:it.text,applyUrl:it.applyUrl||it.hostedUrl,providerJobId:it.id,location:it.categories?.location,
    employmentType:it.categories?.commitment,workplaceType:it.workplaceType,
    descriptionText:it.descriptionPlain||it.description,dateKind:'none',
    provenance:{title:{source:'discovery',adapter:'lever',path:'postings[].text'}}
   }:{
    title:it.title,applyUrl:it.applyUrl||it.jobUrl,providerJobId:it.id,location:it.location,
    employmentType:it.employmentType,workplaceType:it.workplaceType,
    descriptionText:it.descriptionHtml,date:it.publishedAt,dateKind:it.publishedAt?'posted':'none',
    provenance:{title:{source:'discovery',adapter:'ashby',path:'jobs[].title'},date:{source:'discovery',adapter:'ashby',path:'jobs[].publishedAt'}}
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
 const identifiers=new Set(result.jobs.map(j=>j.provider+':'+j.providerJobId));
 next={...next,jobs:next.jobs.map(j=>j.boardId!==boardId||j.origin!=='discovery'||identifiers.has(j.provider+':'+j.providerJobId)?j:{...j,listingState:'closed',closedAt:at,closedReason:'delisted'})};
 for(const job of result.jobs)next=addJob(next,job);
 return next;
}
