'use strict';
const assert = require('assert');
const {createContext, extract, run} = require('../helpers/extractSource');

function setup() {
  const entries = [], shown = [], styles = [];
  const document = {
    createElement: () => ({className:'',textContent:'',innerHTML:'',
      addEventListener() {},remove() {}}),
    querySelector: () => null,
    body: {prepend: node => shown.push(node)}
  };
  const ctx = createContext({
    document,
    css:{addStyle:cssText=>styles.push(cssText)},
    NotificationJournal:{record: event => {entries.push(event);return event;}},
    console:{log(){},error(){},trace(){}}
  });
  run('const PopupMessage = ' +
    extract('packages/lib/src/ui/PopupMessage.js', 'PopupMessage', 'var') +
    ';globalThis.__pop=PopupMessage;', ctx);
  return {popup:ctx.__pop,entries,shown,styles};
}
describe('Notification popup central journal capture', () => {
  it('records direct notification and direct alert exactly once', () => {
    const h=setup();
    h.popup.notify('コメント投稿成功');
    h.popup.alert('コメントの取得失敗');
    assert.strictEqual(h.entries.length,2);
    assert.strictEqual(h.entries[0].level,'info');
    assert.strictEqual(h.entries[1].level,'error');
    assert.strictEqual(h.shown.length,2);
  });
  it('keeps original green notification color and opaque text while displayed', () => {
    const h=setup();
    h.popup.notify('読める通知');
    assert.strictEqual(h.styles.length,1);
    const css=h.styles[0];
    assert.match(css,/--notify-color:\s*#0c0\s*;/);
    assert.match(css,/--alert-color:\s*#c00\s*;/);
    assert.match(css,/background:\s*var\(--notify-color,\s*#0c0\);/);
    assert.match(css,/color:\s*#fff;/);
    assert.match(css,/20%\s*\{\s*opacity:\s*1;\s*\}/);
    assert.match(css,/80%\s*\{\s*opacity:\s*1;\s*\}/);
    assert.strictEqual(h.shown[0].textContent,'読める通知');
  });
  it('does not store raw HTML markup from HTML popups', () => {
    const h=setup();
    h.popup.notify('<b>こんにちは</b>',true);
    assert(!h.entries[0].message.includes('<b>'));
    assert(h.entries[0].message.includes('こんにちは'));
  });
});
