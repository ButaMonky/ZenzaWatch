// Task 100 / D-39: lit.render の container に uQuery wrapper を渡さない回帰テスト。
import assert from 'power-assert';
import {JSDOM} from 'jsdom';

const {createContext, loadClass} = require('../helpers/extractSource');

function makeUq(root) {
  const wrap = elements => {
    const list = Array.from(elements || []);
    const q = {
      length: list.length,
      forEach: fn => list.forEach(fn),
      find: sel => wrap(list.flatMap(el => [...el.querySelectorAll(sel)])),
      removeClass: name => { list.forEach(el => el.classList.remove(name)); return q; },
      css: (name, value) => {
        list.forEach(el => { el.style[name] = value; });
        return q;
      }
    };
    list.forEach((el, i) => { q[i] = el; });
    return q;
  };
  return wrap([root]);
}

function subject() {
  const dom = new JSDOM(`<!doctype html><body>
    <div id="menu">
      <div class="empty-area-top"></div>
      <div class="listInner"><ul></ul></div>
      <div class="seekToResumePoint"></div>
    </div>
  </body>`);
  const w = dom.window;
  const resolved = [];
  const asyncCalls = [];
  const globalObj = {
    config: {props: {}},
    emitter: {
      emitResolve: (name, value) => { resolved.push({name, value}); return Promise.resolve(value); },
      emitAsync: (name, ...args) => { asyncCalls.push({name, args}); }
    }
  };
  const c = createContext({
    window: w,
    document: w.document,
    HTMLElement: w.HTMLElement,
    BaseViewComponent: class {},
    cssUtil: {px: v => String(v)},
    util: {$: makeUq},
    global: globalObj
  });
  const ContextMenu = loadClass('src/NicoVideoPlayer.js', 'ContextMenu', c);
  const root = w.document.getElementById('menu');
  const menu = {
    _view: root,
    _playerState: {playbackRate: 1, videoInfo: {initialPlaybackTime: 0}},
    _isFirstShow: true,
    emit: () => {}
  };
  ContextMenu.prototype._onBeforeShow.call(menu);
  return {w, resolved, asyncCalls};
}

describe('addonMenuReady の lit container（D-39 / Task 100）', function() {
  it('emitResolve の container は DOM Node で insertBefore を持つ', function() {
    const s = subject();
    const top = s.resolved.find(x => x.name === 'videoContextMenu.addonMenuReady');
    const list = s.resolved.find(x => x.name === 'videoContextMenu.addonMenuReady.list');
    assert.ok(top);
    assert.ok(list);
    assert.equal(typeof top.value.container.insertBefore, 'function');
    assert.equal(typeof list.value.container.insertBefore, 'function');
    s.w.close();
  });

  it('旧 emitAsync は互換性のため uQuery wrapper のまま', function() {
    const s = subject();
    const old = s.asyncCalls.find(x => x.name === 'videoContextMenu.addonMenuReady.list');
    assert.ok(old);
    assert.ok(old.args[0] && old.args[0][0] instanceof s.w.Element);
    assert.equal(typeof old.args[0].insertBefore, 'undefined');
    s.w.close();
  });
});
