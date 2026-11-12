'use strict';
// Issue #18: an explicit official-player anchor must not be overridden by
// stale watch-card data attributes. Offline synthetic URLs only.
const assert = require('assert');
const {JSDOM} = require('jsdom');
const {createContext, run, beginSection, loadClass} =
  require('../helpers/extractSource');

const artifacts = [
  'packages/zenza/src/menu/HoverMenu.js',
  'dist/ZenzaWatch-dev.user.js'
];

function fixture(artifact, html, url = 'https://www.nicovideo.jp/ranking') {
  const dom = new JSDOM('<!doctype html><body>' + html + '</body>', {
    url
  });
  const {window} = dom, opened = [], sent = [];
  const tasks=[];window.setTimeout=(fn,ms=0)=>{if(ms===0)tasks.push(fn);return 0;};
  const context = createContext({
    window, document: window.document, location: window.location,
    ZenzaWatch: {emitter: {emit() {}}}
  });
  run(beginSection('packages/lib/src/nico/nicoUtil.js'), context);
  const HoverMenu = loadClass(artifact, 'HoverMenu', context);
  const menu = Object.create(HoverMenu.prototype);
  menu._playerConfig = {
    props: {'overrideWatchLink:allowPropagation': true},
    getValue: () => true
  };
  menu._open = (watchId) => opened.push(watchId);
  menu._send = (watchId) => sent.push(watchId);
  menu._overrideWatchLink();
  const target = window.document.querySelector('#target');
  assert(target, 'missing synthetic click target');
  function click(options = {}) {
    const event = new window.MouseEvent('click', {
      bubbles: true, cancelable: true, ...options
    });
    target.dispatchEvent(event);
    while(tasks.length)tasks.shift()();
    return event;
  }
  return {window, opened, sent, menu, target, click, close: () => window.close()};
}

for (const artifact of artifacts) {
  describe('Issue #18 native official link ownership: ' + artifact, () => {
    it('leaves a clean official anchor to the browser', () => {
      const h=fixture(artifact,'<a id="target" class="noHoverMenu" href="/watch/sm9?from=42" target="_blank" rel="noopener">official</a>');
      try { assert.equal(h.click().defaultPrevented,false); assert.deepStrictEqual(h.opened,[]); assert.equal(new URL(h.target.href).search,'?from=42'); }
      finally {h.close();}
    });

    it('keeps official href + from even when data-href points to a normal watch URL', () => {
      const h = fixture(artifact,
        '<a id="target" href="/watch/sm11?zenza_official=1&from=42" ' +
        'data-href="/watch/sm22" target="_blank" rel="noopener">公式</a>');
      try {
        const ref = h.menu._getWatchReference(h.target);
        assert.strictEqual(ref.watchId, 'sm11');
        assert.strictEqual(ref.url.searchParams.get('zenza_official'), '1');
        assert.strictEqual(ref.url.searchParams.get('from'), '42');
        const event = h.click();
        assert.strictEqual(event.defaultPrevented, false);
        assert.deepStrictEqual(h.opened, []);
        assert.deepStrictEqual(h.sent, []);
      } finally { h.close(); }
    });

    it('honors a nested official link despite a conflicting data-anchor-href', () => {
      const h = fixture(artifact,
        '<a href="/watch/sm88?zenza_official=1" data-anchor-href="/watch/sm23">' +
        '<span id="target">公式</span></a>');
      try {
        assert.strictEqual(h.click().defaultPrevented, false);
        assert.deepStrictEqual(h.opened, []);
      } finally { h.close(); }
    });

    it('uses the actual navigated video for a regular anchor with stale data-href', () => {
      const h = fixture(artifact,
        '<a id="target" href="/watch/sm33?from=7" data-href="/watch/sm44">動画</a>');
      try {
        assert.strictEqual(h.click().defaultPrevented, true);
        assert.deepStrictEqual(h.opened, ['sm33']);
      } finally { h.close(); }
    });

    it('still supports a watch-card link without a native href', () => {
      const h = fixture(artifact,
        '<div data-anchor-href="/watch/sm55"><span id="target">カード</span></div>');
      try {
        assert.strictEqual(h.click().defaultPrevented, true);
        assert.deepStrictEqual(h.opened, ['sm55']);
      } finally { h.close(); }
    });

    it('retains data-href fallback for a placeholder href', () => {
      const h = fixture(artifact,
        '<a id="target" href="#" data-href="/watch/sm77">カード</a>');
      try {
        assert.strictEqual(h.click().defaultPrevented, true);
        assert.deepStrictEqual(h.opened, ['sm77']);
      } finally { h.close(); }
    });

    it('placeholder href on a watch page follows data-href instead of reopening the current video', () => {
      const h = fixture(artifact, '<a id="target" href="#" data-href="/watch/sm77">card</a>', 'https://www.nicovideo.jp/watch/sm11');
      try { assert.strictEqual(h.click().defaultPrevented, true); assert.deepStrictEqual(h.opened, ['sm77']); }
      finally { h.close(); }
    });
    for (const opt of [{ctrlKey:true}, {metaKey:true}, {button:1}]) {
      it('does not capture modified/native navigation ' + JSON.stringify(opt), () => {
        const h = fixture(artifact,
          '<a id="target" href="/watch/sm90" data-href="/watch/sm91">動画</a>');
        try {
          assert.strictEqual(h.click(opt).defaultPrevented, false);
          assert.deepStrictEqual(h.opened, []);
        } finally { h.close(); }
      });
    }
  });
}
