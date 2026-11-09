'use strict';

const assert = require('assert');
const {JSDOM} = require('jsdom');
const {createContext, loadClass} = require('../helpers/extractSource');

const escapeHtml = text => String(text).replace(/[&"'<>]/g, ch => ({
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;',
  '<': '&lt;',
  '>': '&gt;'
})[ch]);

function makeView(rel = 'src/TagListView.js') {
  class BaseViewComponent {}
  class TagEditApi {}
  const textUtil = {
    escapeHtml,
    unescapeHtml: text => String(text),
    escapeToZenkaku: text => String(text)
  };
  const context = createContext({
    BaseViewComponent,
    TagEditApi,
    NicodicArticleLoader: {},
    Config: {namespace() { return {getValue() { return null; }}; }},
    ZenzaWatch: {emitter: {on() {}}},
    nicoUtil: {isLogin() { return true; }},
    textUtil,
    window: {CSS: null}
  });
  const TagListView = loadClass(rel, 'TagListView', context);
  TagListView.DIC_ICON_EXISTS = 'exists.svg';
  TagListView.DIC_ICON_NONE = 'none.svg';
  const view = Object.create(TagListView.prototype);
  view._tagEdit = {isEditable: true};
  return view;
}

describe('Task252 TagListView attribute escaping', () => {
  it('keeps hostile tag text inside the intended data attributes', () => {
    const view = makeView();
    const name = 'tag" data-injected="yes<&\'';
    const html = view._createTag({
      name,
      isLocked: false,
      isNicodicArticleExists: false
    });
    const dom = JSDOM.fragment(html);
    const li = dom.querySelector('li.tagItem');
    const del = dom.querySelector('.deleteButton');
    const search = dom.querySelector('.playlistAppend');

    assert.ok(li);
    assert.strictEqual(li.getAttribute('data-tag-id'), name);
    assert.strictEqual(li.hasAttribute('data-injected'), false);
    assert.strictEqual(del.getAttribute('data-param'), name);
    assert.strictEqual(del.hasAttribute('data-injected'), false);
    assert.strictEqual(search.getAttribute('data-param'), name);
    assert.deepStrictEqual(JSON.parse(li.getAttribute('data-tag')).name, name);
  });

  it('keeps generated dev dist tag-attribute escaping in parity with source', () => {
    const view = makeView('dist/ZenzaWatch-dev.user.js');
    const name = 'tag" data-injected="yes<&\'';
    const html = view._createTag({
      name,
      isLocked: false,
      isNicodicArticleExists: false
    });
    const dom = JSDOM.fragment(html);
    const li = dom.querySelector('li.tagItem');
    const del = dom.querySelector('.deleteButton');
    const search = dom.querySelector('.playlistAppend');

    assert.ok(li);
    assert.strictEqual(li.getAttribute('data-tag-id'), name);
    assert.strictEqual(li.hasAttribute('data-injected'), false);
    assert.strictEqual(del.getAttribute('data-param'), name);
    assert.strictEqual(del.hasAttribute('data-injected'), false);
    assert.strictEqual(search.getAttribute('data-param'), name);
    assert.deepStrictEqual(JSON.parse(li.getAttribute('data-tag')).name, name);
  });

  it('resolves literal tag identifiers in removeTag without parsing them as CSS syntax (source and dist)', () => {
    for (const rel of ['src/TagListView.js', 'dist/ZenzaWatch-dev.user.js']) {
      const view = makeView(rel);
      const normal = '通常タグ';
      const special = 'quote" and] [backslash\\ 日本語';
      const tag = name => view._createTag({name, isLocked: false, isNicodicArticleExists: false});
      const host = JSDOM.fragment(tag(normal) + tag(special));
      view._elm = {videoTags: host};
      const calls = [];
      view._removeTag = (id, name) => calls.push([id, name]);

      assert.doesNotThrow(() => view._onCommand('removeTag', special));
      assert.deepStrictEqual(calls, [[special, special]]);
      const items = host.querySelectorAll('li.tagItem');
      assert.strictEqual(items.length, 2);
      assert.strictEqual(items[0].classList.contains('is-Removing'), false);
      assert.strictEqual(items[1].classList.contains('is-Removing'), true);
    }
  });

});
