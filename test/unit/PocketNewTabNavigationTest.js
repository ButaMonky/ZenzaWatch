'use strict';
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const {createContext, extract, run} = require('../helpers/extractSource');

describe('MylistPocket new-tab navigation', () => {
  let dom, win, document, config, calls;
  beforeEach(() => {
    dom = new JSDOM('<main></main><div id="mylistPocket-popup"></div>', {url:'https://www.nicovideo.jp/search/test'});
    win = dom.window;
    document = win.document;
    calls = [];
    config = {props:{videoInfo:{openNewWindow:true}}};
    win.open = (...args) => calls.push(args);
    const ctx = createContext({window:win, location:win.location, config});
    const handler = run('(' + extract('dist/MylistPocket.user.js', 'openPocketLinkInNewTab', 'var') + ')', ctx);
    win.addEventListener('click', handler, true);
  });
  afterEach(() => dom.window.close());

  function click(node, options = {}) {
    return node.dispatchEvent(new win.MouseEvent('click', {bubbles:true, composed:true, cancelable:true, ...options}));
  }
  it('takes an ordinary watch link before a site click handler', () => {
    document.querySelector('main').innerHTML = '<a href="/watch/sm9"><span>video</span></a>';
    let site = 0;
    document.addEventListener('click', () => site++, true);
    assert.equal(click(document.querySelector('span')), false);
    assert.deepEqual(calls, [['https://www.nicovideo.jp/watch/sm9', '_blank', 'noopener,noreferrer']]);
    assert.equal(site, 0);
  });
  it('handles a dynamically added shadow link with a Zenza command', () => {
    const root = document.querySelector('#mylistPocket-popup').attachShadow({mode:'open'});
    root.innerHTML = '<a href="/watch/sm9" class="command"><img></a>';
    click(root.querySelector('img'));
    assert.equal(calls.length, 1);
  });
  it('leaves controls, modified clicks and disabled navigation to their owners', () => {
    document.querySelector('main').innerHTML = '<a href="/watch/sm9"><button>info</button></a>';
    const observed = [];
    document.addEventListener('click', e => {observed.push(e.defaultPrevented); e.preventDefault();});
    click(document.querySelector('button'));
    click(document.querySelector('a'), {ctrlKey:true});
    config.props.videoInfo.openNewWindow = false;
    click(document.querySelector('a'));
    assert.deepEqual(observed, [false,false,false]);
    assert.equal(calls.length, 0);
  });
});
