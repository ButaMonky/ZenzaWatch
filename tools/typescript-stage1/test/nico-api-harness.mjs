// Task457: offline harness shared by NicoNico API parity tests.
// Evaluates legacy `//===BEGIN===` sections in a VM with injected fakes only.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const PKG=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const REPO=resolve(PKG,'../..');
export const read=rel=>readFileSync(resolve(REPO,rel),'utf8');

/** Emit nico-src with the pinned compiler (never a global tsc). */
export function emitNico(project='tsconfig.nico.json'){
  execFileSync(process.execPath,[resolve(PKG,'node_modules/typescript/bin/tsc'),'-p',project],{
    cwd:PKG,stdio:['ignore','pipe','pipe'],windowsHide:true
  });
}

export function legacySection(code){
  const start=code.indexOf('//===BEGIN==='),end=code.indexOf('//===END===');
  if(start<0||end<=start)throw Error('LEGACY_SECTION_MISSING');
  return code.slice(start+'//===BEGIN==='.length,end);
}

/** Load `symbol` from a legacy module text with the given injected globals. */
export function loadLegacy(code,symbol,globals){
  const context=createContext({...globals});
  runInContext(legacySection(code)+`\nglobalThis.__subject=${symbol};`,context,{timeout:1000});
  return context.__subject;
}

/** Cross-realm comparable snapshot; keeps own `undefined` keys and Error props. */
export function snapshot(value,seen=new Set()){
  if(value===undefined)return {$undefined:true};
  if(value===null||typeof value!=='object')return value;
  if(seen.has(value))return {$cycle:true};
  seen.add(value);
  // Array.from (not .map): a VM-realm array's species would keep the foreign prototype.
  if(Array.isArray(value))return Array.from(value,v=>snapshot(v,seen));
  const out={};
  if(typeof value.message==='string'&&typeof value.stack==='string'){
    out.$error=String(value.name);
    out.$message=value.message;
    // Task463: `cause` is own but non-enumerable; compare it explicitly.
    if(Object.prototype.hasOwnProperty.call(value,'cause'))out.$cause=snapshot(value.cause,seen);
  }
  for(const key of Object.keys(value).sort())out[key]=snapshot(value[key],seen);
  return out;
}

/** Settle a promise into a comparable record without throwing. */
export async function settle(run){
  try{
    const value=await run();
    return {ok:true,value};
  }catch(error){
    return {ok:false,error};
  }
}
