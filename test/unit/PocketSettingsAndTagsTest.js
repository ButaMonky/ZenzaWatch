'use strict';
const assert = require('assert/strict');
const {JSDOM} = require('jsdom');
const {read, extract, beginSection, createContext, run} = require('../helpers/extractSource');

describe('MylistPocket settings, tags and list commands', () => {
  const file = 'dist/MylistPocket.user.js';
  let dom, ctx, view;
  beforeEach(() => {
    dom = new JSDOM('<div data-watch-id="123"></div>', {url:'https://www.nicovideo.jp/'});
    ctx = createContext({document: dom.window.document, window: dom.window, Emitter: class {},
      _: require('lodash'), CSS: {escape: value => dom.window.CSS?.escape?.(value) ?? value},
      initNgChecker: () => ({}), createVideoInfoLoader: () => () => {}});
    run(extract(file, 'VideoInfoView') + ';globalThis.View = VideoInfoView;', ctx);
    view = Object.create(ctx.View.prototype);
  });
  afterEach(() => dom.window.close());

  it('restores the new-tab option used by tag links after a reload', async () => {
    run(beginSection('packages/lib/src/infra/DataStorage.js') + ';globalThis.Store = DataStorage;', ctx);
    async function restored() {
      const store = Object.create(ctx.Store.prototype);
      const defaults = {'videoInfo.openNewWindow': false};
      Object.assign(store, {default:defaults, _data:{...defaults}, storage:dom.window.localStorage,
        prefix:'test_', _ignoreExportKeys:[], silently:true});
      await store.restore();
      store.props = store._makeProps(defaults);
      return store;
    }
    const inputHtml = read(file).match(/<input\b[^>]*data-config-name="(?:videoInfo\.)?openNewWindow"[^>]*>/)[0];
    dom.window.document.body.insertAdjacentHTML('beforeend', inputHtml);
    const input = dom.window.document.querySelector('input');
    for (const checked of [true, false]) {
      view._baseConfig = await restored();
      view._config = view._baseConfig.namespace('videoInfo');
      input.checked = checked;
      view._onSettingFormChange({target:input});
      view._config = (await restored()).namespace('videoInfo');
      const tag = view._createTagSlot({text:'R&B'}, {isChannel:true});
      for (const a of tag.querySelectorAll('a')) {
        assert.equal(a.target, checked ? '_blank' : '_self');
        assert.equal(decodeURIComponent(new URL(a.href).pathname.split('/').pop()), 'R&B');
      }
    }
  });

  it('updates links already visible in the panel when the option changes', () => {
    const host = dom.window.document.createElement('div');
    const shadow = host.attachShadow({mode:'open'});
    host.innerHTML = '<a class="target-change" rel="nofollow"></a>';
    shadow.innerHTML = '<a class="tag"></a>';
    Object.assign(view, {_host:host, _rootDom:shadow, _config:{props:{openNewWindow:true}}});
    for (const enabled of [true, false]) {
      view._config.props.openNewWindow = enabled;
      view._updateLinkTargets();
      for (const root of [host, shadow]) assert.equal(root.querySelector('a').target, enabled ? '_blank' : '_self');
      assert.ok(host.querySelector('a').relList.contains('nofollow'));
    }
  });

  it('adds idempotently and toggles both kinds of list on numeric video IDs', () => {
    const configs = {ng:{props:{tag:''}, refresh() {}}, fav:{props:{tag:''}, refresh() {}}};
    ctx.config = {namespace: name => configs[name]};
    const dispatch = run('(' + extract(file, 'createCommandDispatcher', 'var') + ')({})', ctx);
    for (const [kind, cls] of [['ng','is-ng-rejected'], ['fav','is-fav-favorited']]) {
      for (const [verb, active] of [['add',true], ['add',true], ['toggle',false], ['toggle',true], ['remove',false]]) {
        dispatch(verb + '-' + kind + '-tag', {watchId:'123', value:'R&B'});
        assert.equal(configs[kind].props.tag, active ? 'R&B' : '');
        assert.equal(dom.window.document.querySelector('div').classList.contains(cls), active);
      }
    }
  });
});
