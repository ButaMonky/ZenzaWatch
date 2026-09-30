// Task 092: MylistPocket（src/_pocket.js）の一部（util・QueueLoader・HoverMenu）を、
// ファイル全体を読み込まずに取り出して動かすための道具（extractSource と同じ方法）。
// jsdom での確認で、実際のブラウザ・Tampermonkey での確認ではない。
'use strict';
const _ = require('lodash');
const {JSDOM} = require('jsdom');
const {extract, createContext, run} = require('./extractSource');

function pocketUtil({url = 'https://www.nicovideo.jp/watch/sm9'} = {}) {
  const dom = new JSDOM('<!doctype html><body></body>', {url});
  const w = dom.window;
  const c = createContext({
    _, window: w, document: w.document, navigator: w.navigator, location: w.location,
    Node: w.Node, NodeFilter: w.NodeFilter, HTMLAnchorElement: w.HTMLAnchorElement,
    MylistPocket: {}
  });
  run(`globalThis.__util = ${extract('src/_pocket.js', 'util', 'var')};`, c);
  const util = c.__util;
  return {util, w, doc: w.document, close: () => w.close()};
}

// 文字列の HTML を DOM にして返す（検査用）
function toDom(w, html) {
  const div = w.document.createElement('div');
  div.innerHTML = html;
  return div;
}

function queueLoader({load, sleep}) {
  const c = createContext({
    ThumbInfoLoader: {load},
    util: {getSleepPromise: sleep || ((ms) => r => new Promise(res => setTimeout(() => res(r), ms)))}
  });
  run(`globalThis.__q = ${extract('src/_pocket.js', 'QueueLoader', 'var')};`, c);
  return c.__q;
}

module.exports = {pocketUtil, toDom, queueLoader};
