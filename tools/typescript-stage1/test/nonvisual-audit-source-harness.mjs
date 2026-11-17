import {CLASS_ROLES,roleObjectSource} from './dialog-roles.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
export const flush=()=>new Promise(resolve=>setImmediate(resolve));
export function loadSource(file,name,globals={}){
 const raw=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const source=stripTypeScriptTypes(raw,{mode:'strip'})
  .replace(/^import .*;?\s*$/gm,'').replace(/^export\s*\{[^}]*\};?\s*$/gm,'');
 const context=vm.createContext({console,URL,Promise,Map,Set,WeakMap,WeakSet,Date,Math,setTimeout,clearTimeout,queueMicrotask,...globals});
 // Task1060: 本体の末尾の for 文が、役割ごとに分けたメソッドを取り付ける。先に役割の定義を入れる。
 // Task1063: NicoVideoPlayerDialogView も同じ（ファイル名＝クラス名の時に、その役割を先に入れる）。
 const own=(file.match(/([A-Za-z]+)\.ts$/)||[])[1];
 const roles=(CLASS_ROLES[own]||[]).map(roleObjectSource).join('\n')+((CLASS_ROLES[own]||[]).length?'\n':'');
 vm.runInContext(roles+source+';globalThis.Subject='+name,context);
 return context.Subject;
}
