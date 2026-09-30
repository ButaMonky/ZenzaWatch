// Actual extracted production classes; only dependencies/config event boundary are controlled.
'use strict';
const _ = require('lodash');
const {beginSection, createContext, run, loadClass} = require('./extractSource');
function createNgHarness(debug = false, params = {}) {
  const quiet = {log() {}, error() {}, time() {}, timeEnd() {}};
  const c = createContext({console: quiet,
    _: Object.assign({}, _, {debounce: fn => fn}),
    Config: {getValue: () => debug},
    textUtil: {escapeRegs: _.escapeRegExp},
    ScreenFilter: {PREFIX: 'screenFilter.', PARAM_MAP: {}},
    $: target => ({addClass: name => target.classes.push(name), removeClass() {}}),
    setTimeout() {}});
  run(beginSection('packages/lib/src/Emitter.js'), c);
  run(beginSection('packages/zenza/src/commentLayer/NicoChatFilter.js') +
    '\nglobalThis.Filter = NicoChatFilter;', c);
  const filter = new c.Filter(params);
  let changes = 0;
  filter.on('change', () => changes++);
  return {c, filter, changes: () => changes,
    chat: text => ({text, fork: 0, score: 0, userId: 'u', cmd: '', vpos: 0, type: 'default', threadLabel: 'default'})};
}
function createNgSettingsHarness(params = {}) {
  const h = createNgHarness(false, params);
  const Dialog = loadClass('src/NicoVideoPlayerDialog.js', 'NicoVideoPlayerDialog', h.c);
  const dialog = Object.create(Dialog.prototype);
  dialog._nicoVideoPlayer = {filter: h.filter};
  // This Proxy stands for the existing config update notification contract.
  const props = new Proxy(Object.assign({wordRegFilter: '', wordRegFilterFlags: 'i'}, params), {
    set(target, key, value) {target[key] = value; dialog._onPlayerConfigUpdate(key, value); return true;}
  });
  dialog._playerConfig = {props};
  const Panel = loadClass('src/_setting.js', 'SettingPanel', h.c);
  const panel = Object.create(Panel.prototype);
  panel._playerConfig = dialog._playerConfig;
  const input = (settingName, value) => {
    const target = {dataset: {settingName}, value, classes: []};
    panel._onInputItemChange({target});
    return target;
  };
  return Object.assign(h, {dialog, panel, props, input});
}
module.exports = {createNgHarness, createNgSettingsHarness};
