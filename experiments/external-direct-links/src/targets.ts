import type {ExternalSettings} from './settings';
export function validVideoId(id:unknown):id is string {return typeof id==='string'&&/^(?:[a-z]{2,8})?\d{1,20}$/.test(id);}
function allowedId(id:string,s:ExternalSettings,numeric=false):boolean {
 const m=/^([a-z]{2,8})(\d{1,20})$/.exec(id);return m?s.prefixes.includes(m[1]):numeric&&/^\d{1,20}$/.test(id);
}
function direct(value:string,base:string,s:ExternalSettings):string|null {
 try {const u=new URL(value,base);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port||!['www.nicovideo.jp','sp.nicovideo.jp'].includes(u.hostname))return null;
 const id=/^\/watch\/([^/]+)\/?$/.exec(u.pathname)?.[1];return id&&allowedId(id,s,true)?id:null;
 }catch{return null;}
}
export function linkTargets(value:string,base:string,s:ExternalSettings):string[] {
 const ids=new Set<string>(),seen=new Set<string>();
 const visit=(text:string,depth:number)=>{
  if(text.length>8192||seen.has(text)||seen.size>=32)return;seen.add(text);
  const id=direct(text,base,s);if(id){ids.add(id);return;}
  if(!s.redirects||depth>=3)return;
  try {const u=new URL(text,base);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return;
   u.searchParams.forEach(v=>{if(/^https?:\/\//i.test(v))visit(v,depth+1);else {try{const decoded=decodeURIComponent(v);if(/^https?:\/\//i.test(decoded))visit(decoded,depth+1);}catch{}}});
  }catch{}
 };visit(value,0);return [...ids];
}
export function textTargets(text:string,s:ExternalSettings):string[] {
 if(!s.textIds||text.length>4096)return [];
 const ids=new Set<string>();
 for(const m of text.matchAll(/(?<![a-zA-Z0-9_])([a-z]{2,8}\d{1,20})(?![a-zA-Z0-9_])/g))if(allowedId(m[1],s))ids.add(m[1]);
 return [...ids];
}
