// Hoshi never submits. Every proposal is reviewed by the user before filling.
// This module executes only after explicit user interaction on an ATS host.
function trustedHost(){
 const host=location.hostname;
 const suffixes=['job-boards.greenhouse.io','boards.greenhouse.io','jobs.lever.co','jobs.ashbyhq.com','myworkdayjobs.com','smartrecruiters.com','icims.com','workable.com','jobvite.com'];
 return suffixes.some(x=>host===x||host.endsWith('.'+x));
}
const protectedField=text=>/\b(race|ethnicity|gender|sex|disability|veteran|birth.?date|date.?of.?birth|sexual.?orientation|religion)\b/i.test(text);
export function inspectFields(){
 if(!trustedHost())return {error:'Outside supported ATS host',fields:[]};
 const fields=[];
 for(const input of [...document.querySelectorAll('input[type="text"],input[type="email"],input[type="tel"],textarea')].slice(0,120)){
  if(!input.offsetParent||input.disabled||input.readOnly)continue;
  const label=input.labels?.[0]?.textContent?.trim() || input.closest('label')?.textContent?.trim() || (input.getAttribute('aria-label')||'').trim();
  if(!label||protectedField(label+' '+input.name+' '+input.id))continue;
  if(input.type==='password'||input.autocomplete==='one-time-code')continue;
  const id=input.id?.trim(),name=input.name?.trim();
  const selector=id?'#'+CSS.escape(id):name?'[name="'+CSS.escape(name)+'"]':null;
  if(!selector||document.querySelectorAll(selector).length!==1)continue;
  fields.push({label:label.slice(0,200),selector,type:input.type||input.tagName.toLowerCase(),origin:'page form label'});
 }
 return {fields};
}
export function fillReviewed(pairs){
 if(!trustedHost())return {filled:0,errors:['Unsupported ATS host']};
 let filled=0;const errors=[];
 for(const p of pairs){
  if(!p.approved||protectedField(p.label))continue;
  const el=document.querySelector(p.selector);
  if(!el||el.disabled||el.readOnly){errors.push('Field unavailable: '+p.label);continue;}
  const current=el.labels?.[0]?.textContent?.trim()||el.closest('label')?.textContent?.trim()||(el.getAttribute('aria-label')||'').trim();
  if(current!==p.label||protectedField(current+' '+el.name+' '+el.id)){errors.push('Label changed: '+p.label);continue;}
  if(el.type==='password'||el.type==='submit'||el.type==='hidden')continue;
  const prototype=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  const setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;
  if(!setter){errors.push('Unsupported field: '+p.label);continue;}
  setter.call(el,p.answer);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
  filled++;
 }
 return {filled,errors};
}
