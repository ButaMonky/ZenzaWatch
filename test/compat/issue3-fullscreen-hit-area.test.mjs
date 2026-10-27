// ZW-ISSUE3-TS-20261020-A: runtime contract; browser hit testing is separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
const root = new URL('../../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8').replace(/\r\n/g, '\n');
const runtime = read('packages/zenza/src/init/inintCssProps.js');
const body = runtime.split('//===BEGIN===\n')[1].split('//===END===')[0];
const load = () => {
  const styles = [], definitions = [], values = [], win = {name:'top'};
  const cssUtil = {
    addStyle: (css, options) => (styles.push({css,options}), {}),
    registerProps: (...args) => definitions.push(...args),
    setProps: (...args) => values.push(...args),
    number: n => n, px: n => `${n}px`
  };
  const context = {cssUtil, window:win, document:{documentElement:{}},
    global:{innerWidth:1280,innerHeight:720}, CONSTANT:{SIDE_PLAYER_WIDTH:400}};
  const init = runInNewContext(body+'\ninitCssProps;', context);
  init();
  return {styles, definitions, values, win};
};

test('the existing initializer installs one disabled fullscreen stylesheet', () => {
  const h = load();
  assert.equal(h.styles.length,1);
  assert.equal(h.styles[0].options.className,'screenMode for-screen-full issue3-hit-area');
  assert.equal(h.styles[0].options.disabled,true);
});
test('both transparent wrappers pass input while real buttons can receive it', () => {
  const css = load().styles[0].css;
  assert.match(css,/\.videoControlBar \.controlItemContainer\.right,\s*\.videoControlBar \.controlItemContainer\.right > \.scalingUI\s*\{\s*pointer-events:\s*none;/);
  assert.match(css,/:where\(\.videoControlBar \.controlItemContainer\.right > \.scalingUI\) > \.controlButton\s*\{\s*pointer-events:\s*auto;/);
});
test('the fix does not move UI, change stacking, force hidden menus or add listeners', () => {
  const css = load().styles[0].css;
  assert.doesNotMatch(css,/\b(?:top|bottom|left|right|height|width|z-index|position|display|visibility|opacity|transform)\s*:/);
  assert.doesNotMatch(css,/!important|zenzaPopupMenu|tooltip/);
  assert.doesNotMatch(body,/addEventListener|setInterval|MutationObserver/);
});
test('all 14 pre-existing property registrations retain their values and window', () => {
  const h=load();
  assert.equal(h.definitions.length,14);
  assert.ok(h.definitions.every(d=>d.window===h.win && d.inherits===true));
  const d=Object.fromEntries(h.definitions.map(v=>[v.name,v.initialValue]));
  assert.equal(d['--zenza-ui-scale'],1);
  assert.equal(d['--zenza-control-bar-height'],'48px');
  assert.equal(d['--zenza-comment-panel-header-height'],'64px');
  assert.equal(d['--sideView-left-margin'],'424px');
  assert.equal(d['--sideView-top-margin'],'76px');
  assert.equal(d['--enabled-button-color'],'transparent');
});
test('the viewport property updates are unchanged', () => {
  const v=load().values;
  assert.equal(v.length,2);
  assert.equal(v[0][1],'--inner-width');assert.equal(v[0][2],1280);
  assert.equal(v[1][1],'--inner-height');assert.equal(v[1][2],720);
});
test('canonical TS and generated JS both match the checked-in manifest', () => {
  const m=JSON.parse(read('tools/typescript-stage1/nico-api-manifests/inintCssProps.json'));
  for(const key of ['source','runtime']) {
    assert.equal(createHash('sha256').update(read(m[key])).digest('hex'),m[key+'Sha256'],key);
  }
  assert.match(read(m.source),/addStyle\(styles: string, options: \{className: string; disabled: boolean\}\): HTMLStyleElement/);
});
