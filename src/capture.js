// Executed ONLY on user request, ONLY for known ATS hosts with granted access.
// No global content-script registrations; never observes other tabs or private LinkedIn.
export function captureCurrentPage(){
 const host=location.hostname;
 const valid=[
  'job-boards.greenhouse.io','boards.greenhouse.io','jobs.lever.co','jobs.ashbyhq.com',
  'myworkdayjobs.com','smartrecruiters.com','icims.com','workable.com','jobvite.com'
 ];
 if(!valid.some(x=>host===x||host.endsWith('.'+x)))return {error:'Not a supported job board. No page content was read.'};
 let structured=null;
 try{
  const blocks=[...document.querySelectorAll('script[type="application/ld+json"]')].slice(0,12);
  for(const b of blocks){
   const data=JSON.parse(b.textContent);
   const items=Array.isArray(data)?data:[data];
   structured=items.find(x=>x&& (x['@type']==='JobPosting'||x['@graph']?.some(y=>y['@type']==='JobPosting')));
   if(structured){if(structured['@graph'])structured=structured['@graph'].find(x=>x['@type']==='JobPosting');break}
  }
 }catch{ /* fail to DOM title only; never invent unseen fields */ }
 const from=(selectors)=>{for(const selector of selectors){const el=document.querySelector(selector);if(el?.textContent?.trim())return {value:el.textContent.trim().slice(0,220),selector}}return null};
 const title=structured?.title?{value:structured.title,selector:'JSON-LD JobPosting.title'}:from(['h1','.posting-headline h2','[data-testid="job-title"]','[itemprop="title"]']);
 const org=structured?.hiringOrganization?.name?{value:structured.hiringOrganization.name,selector:'JSON-LD JobPosting.hiringOrganization.name'}:from(['[data-testid="company-name"]','[itemprop="hiringOrganization"]','.company-name']);
 const loc=structured?.jobLocation?.address?.addressLocality?{value:structured.jobLocation.address.addressLocality,selector:'JSON-LD JobPosting.jobLocation.address.addressLocality'}:from(['.location','.posting-categories .location','[data-testid="job-location"]']);
 const url=location.origin+location.pathname;
 const handle=(host==='job-boards.greenhouse.io'||host==='boards.greenhouse.io'||host==='jobs.lever.co'||host==='jobs.ashbyhq.com')?location.pathname.split('/').filter(Boolean)[0]:null;
 const provider=host.includes('greenhouse')?'greenhouse':host.includes('lever')?'lever':host.includes('ashby')?'ashby':host.includes('workday')?'workday':'other';
 const rawDate=structured?.datePosted;
 return {
  title:title?.value||'',company:org?.value||'',location:loc?.value||'',applyUrl:url,
  provider,origin:'page',listingState:'unknown',date:rawDate||null,dateKind:rawDate?'posted':'none',
  descriptionText:String(structured?.description||'').replace(/<[^>]*>/g,' ').slice(0,1400),
  provenance:{title:title?.selector||'unavailable',company:org?.selector||'unavailable',location:loc?.selector||'unavailable',date:rawDate?'JSON-LD JobPosting.datePosted':'unavailable'},
  harvestedBoard:handle&&['greenhouse','lever','ashby'].includes(provider)?{provider,handle,handleSource:'harvested',sourceUrl:url}:null
 };
}
