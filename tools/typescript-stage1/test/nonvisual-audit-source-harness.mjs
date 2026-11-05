import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
export const flush=()=>new Promise(resolve=>setImmediate(resolve));
export function loadSource(file,name,globals={}){
 const raw=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const source=stripTypeScriptTypes(raw,{mode:'strip'})
  .replace(/^import .*;?\s*$/gm,'').replace(/^export\s*\{[^}]*\};?\s*$/gm,'');
 const context=vm.createContext({console,URL,Promise,Map,Set,WeakMap,WeakSet,Date,Math,setTimeout,clearTimeout,queueMicrotask,...globals});
 vm.runInContext(source+';globalThis.Subject='+name,context);
 return context.Subject;
}
