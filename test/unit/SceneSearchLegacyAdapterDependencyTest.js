'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const runtime=fs.readFileSync(path.join(root,
  'packages/zenza/src/sceneSearch/SceneSearchLegacyAdapter.js'),'utf8');
const typed=fs.readFileSync(path.join(root,
  'tools/typescript-stage1/nico-src/SceneSearchLegacyAdapter.ts'),'utf8');
const generator=fs.readFileSync(path.join(root,
  'tools/typescript-stage1/scripts/sync-scui.mjs'),'utf8');
const lines=runtime.split('\n');

describe('P13 LegacyAdapter runtime dependency is not lost during TS generation',()=>{
 it('preserves exactly one real TimelineGeometry import and require directive',()=>{
  assert(runtime.startsWith('// GENERATED FROM tools/typescript-stage1/nico-src/SceneSearchLegacyAdapter.ts\n'));
  assert.equal(lines[1],"import {TimelineGeometry} from './TimelineGeometry';");
  assert.equal(lines[2],'//===BEGIN===');
  assert.equal(lines[3],'//@require TimelineGeometry');
  assert.equal(lines.filter(l=>l==="import {TimelineGeometry} from './TimelineGeometry';").length,1);
  assert.equal(lines.filter(l=>l==='//@require TimelineGeometry').length,1);
 });
 it('keeps the import type-only in canonical TS and lets the generator own runtime wiring',()=>{
  assert(typed.includes("import type {TimelineGeometry as TimelineGeometryType} from './TimelineGeometry';"));
  assert(typed.includes('declare const TimelineGeometry:typeof TimelineGeometryType;'));
  assert(!typed.includes('//@require TimelineGeometry'));
  assert(generator.includes('SCUI_LEGACY_ADAPTER_DEPENDENCY_DRIFT'));
  assert(generator.includes('SCUI_LEGACY_ADAPTER_DUPLICATE_EMITTED_REQUIRE'));
 });
 it('preserves all four native seek and ownership paths after generator transformation',()=>{
  assert(runtime.includes('class SceneSearchLegacyAdapter {'));
  assert(runtime.includes('TimelineGeometry.timeToRatio(0, duration)'));
  assert(runtime.includes('TimelineGeometry.ratioToTime(ratio, duration)'));
  assert(runtime.includes('this.bar._sceneSearchPinnedTime'));
  assert(runtime.includes('this._bridge?.dispose()'));
 });
});
