'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const {readExternal, siteEnabled} = require('./generated/settings.js');
const modules = {settings:{siteEnabled}, inline:require('./generated/inline-buttons.js'), overlay:require('./generated/overlay.js')};
const mount = require('./companion-buttons.cjs');

test('X composer owns draft cards and attachment controls across route and modal transitions', async () => {
  const win = new JSDOM('<main><a href="https://www.nicovideo.jp/watch/sm9">timeline</a></main><aside id="zenza-x-clip"></aside>', {url:'https://x.com/intent/tweet', pretendToBeVisual:true}).window;
  const doc = win.document;
  const receiver = doc.getElementById('zenza-x-clip');
  const tick = () => new Promise(resolve => win.setTimeout(resolve, 20));
  const decorations = () => doc.querySelectorAll('[data-zenza-companion]').length;
  const go = async path => {
    win.history.pushState({}, '', path);
    doc.querySelector('main').append(doc.createElement('br'));
    await tick();
  };
  const api = mount(win, modules, readExternal({}), async () => {});
  assert.equal(decorations(), 0);
  await go('/intent/post');
  assert.equal(decorations(), 0);
  await go('/home');
  assert.equal(decorations(), 2);
  const modal = doc.createElement('div');
  modal.setAttribute('role', 'dialog');
  modal.innerHTML = '<div contenteditable="true" role="textbox" data-testid="tweetTextarea_0">sm9</div><a href="https://www.nicovideo.jp/watch/sm9">draft card</a><input type="file" accept="video/mp4">';
  const original = modal.innerHTML;
  doc.body.append(modal);
  await tick();
  assert.equal(decorations(), 0);
  assert.equal(modal.innerHTML, original);
  assert.equal(doc.getElementById('zenza-x-clip'), receiver);
  for (const [attribute, value] of [['hidden',''], ['aria-hidden','true'], ['inert',''], ['style','display:none']]) {
    modal.setAttribute(attribute, value);
    await tick();
    assert.ok(doc.querySelector('main [data-zenza-external-inline]'), 'timeline restored when modal is ' + attribute);
    assert.equal(modal.innerHTML, original, 'cached draft stays untouched');
    modal.removeAttribute(attribute);
    await tick();
    assert.equal(decorations(), 0);
  }
  modal.remove();
  await tick();
  assert.equal(decorations(), 2);
  await go('/compose/post');
  assert.equal(decorations(), 0);
  api.dispose();
  await go('/home');
  assert.equal(decorations(), 0);
  win.close();
});

test('X SPA preserves URL exclusions and unrelated dialogs, other sites keep matching links on compose-like paths', async () => {
  for (const host of ['x.com','example.com']) {
    const path = host === 'x.com' ? '/home' : '/compose/post';
    const win = new JSDOM('<div role="dialog"><button>close</button></div><a href="https://www.nicovideo.jp/watch/sm9">movie</a>', {url:'https://' + host + path, pretendToBeVisual:true}).window;
    const settings = readExternal({'externalLinks.excludedSites':'https://x.com/settings/*'});
    const api = mount(win, modules, settings, async () => {});
    assert.ok(win.document.querySelector('[data-zenza-external-inline]'));
    if (host === 'x.com') {
      win.history.pushState({}, '', '/settings/profile');
      win.dispatchEvent(new win.PopStateEvent('popstate'));
      assert.equal(win.document.querySelector('[data-zenza-companion]'), null);
    }
    api.dispose();
    win.close();
  }
});
