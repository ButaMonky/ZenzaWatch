import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const stage='tools/typescript-stage1';
function fixture(){
 const parent=path.join(root,stage,'.generated/hls-generator-tests');
 fs.mkdirSync(parent,{recursive:true});
 const dest=fs.mkdtempSync(path.join(parent,'case-'));
 for(const rel of [stage+'/hls-src',stage+'/hls-manifests',stage+'/.generated/hls', 'packages/zenza/src/hls']){
  fs.mkdirSync(path.dirname(path.join(dest,rel)),{recursive:true});fs.cpSync(path.join(root,rel),path.join(dest,rel),{recursive:true});
 }
 // generator-core imports only Node builtins and its registry. Keep its exact dependencies.
 fs.cpSync(path.join(root,stage,'scripts'),path.join(dest,stage,'scripts'),{recursive:true});
 // Task1028: the allowlisted HLS bundle now includes two Nico-side helpers.
 const nico=path.join(dest,stage,'nico-src');
 fs.mkdirSync(nico,{recursive:true});
 for(const name of ['PlaylistStartupPreparer.ts','PrefetchReporter.ts']){
  fs.copyFileSync(path.join(root,stage,'nico-src',name),path.join(nico,name));
 }
 return dest;
}
const run=(dir,mode)=>spawnSync(process.execPath,[path.join(dir,stage,'scripts/sync-hls.mjs'),mode],{encoding:'utf8'});
test('HLS generation verifies all ten owners and is idempotent',()=>{
 const dir=fixture();assert.equal(run(dir,'--check').status,0);assert.equal(run(dir,'--write').status,0);assert.equal(run(dir,'--check').status,0);
});
test('HLS generation refuses a foreign runtime edit without overwriting it',()=>{
 const dir=fixture(),file=path.join(dir,'packages/zenza/src/hls/HlsConfig.js');
 fs.appendFileSync(file,'\n// user change\n');const before=fs.readFileSync(file,'utf8');
 const result=run(dir,'--write');assert.notEqual(result.status,0);assert.match(result.stderr,/HLS_SYNC_FOREIGN_EDIT/);assert.equal(fs.readFileSync(file,'utf8'),before);
});
test('HLS generation check detects canonical source drift',()=>{
 const dir=fixture();fs.appendFileSync(path.join(dir,stage,'hls-src/HlsConfig.ts'),'\n// source changed\n');
 const result=run(dir,'--check');assert.notEqual(result.status,0);assert.match(result.stderr,/HLS_SYNC_STALE/);
});
test('HLS generation preflights every module before writing',()=>{
 const dir=fixture(),runtime=path.join(dir,'packages/zenza/src/hls/HlsLibrary.js'),before=fs.readFileSync(runtime,'utf8');
 fs.appendFileSync(path.join(dir,stage,'.generated/hls/hls-src/HlsLibrary.js'),'\n// valid generated change\n');
 fs.appendFileSync(path.join(dir,stage,'.generated/hls/hls-src/HlsRuntime.js'),'\nexport const foreign = 1;\n');
 const result=run(dir,'--write');assert.notEqual(result.status,0);assert.match(result.stderr,/HLS_SYNC_BODY_INVALID/);assert.equal(fs.readFileSync(runtime,'utf8'),before);
});
