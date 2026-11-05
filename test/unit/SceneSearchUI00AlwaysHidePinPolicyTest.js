'use strict';
// The real Chromium CSS cascade is tested by the companion offline browser
// probe. This cheap unit guard prevents the explicit fullscreen pin contract
// from silently disappearing during future TypeScript/code generation.
const assert=require('assert'),fs=require('fs');
const {loadClass,createContext}=require('../helpers/extractSource');
const Layout=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayout00.js',
 'SceneSearchLayout00',createContext());
describe('UI00 original native preview: pinned fullscreen always-hide owner',()=>{
 it('preserves explicit pin without resurrecting normal controls',()=>{
  const css=Layout.CSS;
  const gate='body[data-fullscreen-control-bar-mode="always-hide"]';
  const pin='.is-scui00-active.is-scui00-pinned.is-fullscreen:not(.is-scui00-inactive)';
  const lines=css.split('\n');
  assert.strictEqual(lines.filter(line=>line.trim()===gate).length,3,
   'exactly bar, native controls, and native seek must share the policy');
  assert.strictEqual(lines.filter(line=>line.includes(pin)).length,3,
   'the fullscreen-only pin gate must apply to all three native layers');
  const block=css.slice(css.indexOf('/* Fullscreen always-hide'));
  const first=block.slice(0,block.indexOf('/* Fullscreen\'s native control row'));
  assert(first.includes('opacity:1!important;background:transparent!important'));
  assert(first.includes('visibility:hidden!important;pointer-events:none!important'));
  assert(first.includes('pointer-events:auto!important'));
  assert(!first.includes('.zenzaScreenMode_sideView'),'fullscreen pin must not force sideView controls');
  assert(!first.includes('.zenzaScreenMode_small'),'fullscreen pin must not force small controls');
 });
 it('ships the same scoped original-Canvas pin owner in generated dev bundle',()=>{
  const bundle=fs.readFileSync('dist/ZenzaWatch-dev.user.js','utf8');
  const css=Layout.CSS;
  assert(bundle.includes('class SceneSearchLayout00'));
  const BundledLayout=loadClass('dist/ZenzaWatch-dev.user.js',
   'SceneSearchLayout00',createContext());
  const normalize=source=>source.split(/\r?\n/).map(line=>line.trim()).join('\n');
  assert.strictEqual(normalize(BundledLayout.CSS),normalize(css),
   'distributed runtime must preserve the same pinned CSS declarations');
  assert(bundle.includes('zenzaSeekThumbnail-image'),'native picture must remain player-owned');
 });
});
