import {externalDefaults,externalDescriptors,ExternalKey,sanitizeExternal} from './settings';
export function openExternalSettings(d:Document,values:unknown,save:(v:Record<ExternalKey,string|boolean>)=>void):void {
 d.querySelector('[data-zenza-external-settings]')?.remove();
 const host=d.createElement('div');host.dataset.zenzaExternalSettings='';host.style.cssText='all:initial!important;position:fixed!important;inset:24px!important;z-index:2147483647!important;display:block!important;';
 const shadow=host.attachShadow({mode:'closed'}),style=d.createElement('style');
 style.textContent='section{font:14px/1.5 sans-serif;color:#eee;background:#17212d;border:1px solid #6c8296;border-radius:10px;padding:20px;max-width:620px;max-height:80vh;overflow:auto;margin:auto;color-scheme:dark}label{display:block;margin:12px 0}input:not([type=checkbox]),select,textarea{display:block;width:100%;box-sizing:border-box;padding:6px}small{display:block;color:#bbc6d0}button{padding:7px 14px;margin:8px;background:#243c47;color:#eee;border:1px solid #7acabc;border-radius:4px}';
 const section=d.createElement('section');section.setAttribute('role','dialog');section.setAttribute('aria-modal','true');section.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();host.remove();}});section.setAttribute('aria-label','外部サイトからの再生');
 const heading=d.createElement('h2');heading.textContent='外部サイトからの再生';section.append(heading);
 const current=sanitizeExternal(values),inputs=new Map<ExternalKey,HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>();
 for(const descriptor of externalDescriptors){
  const label=d.createElement('label');label.append(descriptor.label);
  const input=descriptor.options?d.createElement('select'):descriptor.type==='textarea'?d.createElement('textarea'):d.createElement('input');
  if(input.tagName==='SELECT')for(const option of descriptor.options||[]){const el=d.createElement('option');el.value=option.value;el.textContent=option.label;input.append(el);}
  else if(input.tagName==='INPUT') (input as HTMLInputElement).type=typeof externalDefaults[descriptor.id]==='boolean'?'checkbox':'text';
  if((input as HTMLInputElement).type==='checkbox')(input as HTMLInputElement).checked=current[descriptor.id]===true;else input.value=String(current[descriptor.id]);
  if(input.tagName==='TEXTAREA')(input as HTMLTextAreaElement).rows=4;input.dataset.key=descriptor.id;inputs.set(descriptor.id,input);label.append(input);
  if(descriptor.description){const small=d.createElement('small');small.textContent=descriptor.description;label.append(small);}section.append(label);
 }
 const update=()=>{const enabled=(inputs.get('externalLinks.enabled') as HTMLInputElement).checked;for(const [key,input] of inputs){if(key==='externalLinks.enabled')continue;input.disabled=!enabled;input.parentElement!.style.opacity=enabled?'1':'.45';}};
 inputs.get('externalLinks.enabled')!.addEventListener('change',update);update();
 const commit=d.createElement('button');commit.textContent='保存';commit.onclick=()=>{const next={...current};for(const [key,input] of inputs)next[key]=(input as HTMLInputElement).type==='checkbox'?(input as HTMLInputElement).checked:input.value;save(sanitizeExternal(next));host.remove();};
 const cancel=d.createElement('button');cancel.textContent='キャンセル';cancel.onclick=()=>host.remove();section.append(commit,cancel);shadow.append(style,section);d.documentElement.append(host);inputs.get('externalLinks.enabled')!.focus();
}
