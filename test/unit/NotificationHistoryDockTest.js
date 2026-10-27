'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {stripTypeScriptTypes} = require('module');
const {JSDOM} = require('jsdom');
const {createContext, run} = require('../helpers/extractSource');
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="player"><button id="bell">通知</button></div></body></html>');
  const document = dom.window.document;
  const subscribers = new Set();
  let reads = 0;
  const records = [{id:'1', timestamp:1, category:'network', level:'error', message:'<img src=x>通信失敗', details:{statusCode:400}}];
  const context = createContext({document, window:dom.window, NotificationJournal:{
    list:async () => { reads++; return records; },
    clear:async () => { records.length=0; return true; },
    subscribe:callback => { subscribers.add(callback); return () => subscribers.delete(callback); }
  }});
  const source = fs.readFileSync(path.resolve(__dirname, '../../tools/typescript-stage1/nico-src/NotificationHistoryPanel.ts'),'utf8');
  run(stripTypeScriptTypes(source).replace(/export\s*\{[^}]+\};?/, '') + '\nglobalThis.panel=NotificationHistoryPanel;', context);
  const container=document.getElementById('player'), button=document.getElementById('bell');
  const controller=context.panel.mountDock({container,button});
  return {dom,document,container,button,controller,panel:context.panel,journal:context.NotificationJournal,subscribers,records,get reads(){return reads;}};
}

describe('NotificationHistory dock (canonical TypeScript)', () => {
  it('restores shortcut focus with a hidden bell and falls back to the player if the origin disappears', () => {
    const h=setup();
    const origin=h.document.createElement('button'); h.container.append(origin);
    h.button.hidden=true; origin.focus(); h.controller.toggle(); h.controller.close();
    assert.strictEqual(h.document.activeElement,origin);
    origin.focus(); h.controller.toggle(); origin.remove(); h.controller.close();
    assert.strictEqual(h.document.activeElement,h.container);
    assert.strictEqual(h.container.getAttribute('tabindex'),'-1');
    h.controller.dispose();
    assert.strictEqual(h.container.hasAttribute('tabindex'),false);
    h.dom.window.close();
  });
  it('ignores an in-flight refresh that finishes after closing', async () => {
    const h=setup(); let finish;
    h.journal.list=()=>new Promise(resolve=>{finish=resolve;});
    h.controller.toggle(); await flush(); h.controller.close();
    finish(h.records); await flush();
    assert.strictEqual(h.container.querySelectorAll('.znh-entry').length,0);
    assert.strictEqual(h.controller.isOpen,false);
    h.controller.dispose(); h.dom.window.close();
  });
  it('preserves native details and keyboard actions without reaching player handlers', async () => {
    const h=setup(); let clicks=0, keys=0;
    h.container.addEventListener('click',event=>{clicks++;event.preventDefault();});
    h.container.addEventListener('keydown',()=>keys++);
    h.controller.toggle(); await flush();
    const summary=h.container.querySelector('summary'); summary.click();
    assert.strictEqual(summary.parentElement.open,true);
    assert.strictEqual(clicks,0);
    const event=new h.dom.window.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true});
    h.container.querySelector('.znh-close').dispatchEvent(event);
    assert.strictEqual(keys,0);
    assert.strictEqual(event.defaultPrevented,false);
    h.controller.dispose(); h.dom.window.close();
  });
  it('reads only while open and refreshes without an active right tab', async () => {
    const h=setup();
    await flush(); assert.strictEqual(h.reads,0);
    h.controller.toggle(); await flush();
    assert.strictEqual(h.controller.isOpen,true);
    assert.strictEqual(h.reads,1);
    assert.strictEqual(h.container.querySelectorAll('.znh-entry').length,1);
    assert.strictEqual(h.container.querySelectorAll('img').length,0);
    h.records.push({id:'2',timestamp:2,category:'like',level:'success',message:'いいね',details:{}});
    h.subscribers.forEach(fn=>fn()); await flush();
    assert.strictEqual(h.container.querySelectorAll('.znh-entry').length,2);
    h.controller.close(); h.subscribers.forEach(fn=>fn()); await flush();
    assert.strictEqual(h.reads,2);
    h.controller.toggle(); h.controller.close(); await flush();
    assert.strictEqual(h.reads,2,'closing before scheduled work cancels the read');
    h.controller.dispose(); h.dom.window.close();
  });
  it('owns Escape and close, restores bell focus, and does not wire the bell click', async () => {
    const h=setup(); let playerEscapes=0;
    h.document.addEventListener('keydown',()=>playerEscapes++);
    h.button.click(); assert.strictEqual(h.controller.isOpen,false);
    h.button.focus(); h.controller.toggle(); await flush();
    assert.strictEqual(h.button.getAttribute('aria-expanded'),'true');
    const query=h.container.querySelector('input');
    assert.strictEqual(h.document.activeElement,query);
    query.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    assert.strictEqual(playerEscapes,0);
    assert.strictEqual(h.controller.isOpen,false);
    assert.strictEqual(h.document.activeElement,h.button);
    h.controller.toggle(); h.container.querySelector('.znh-close').click();
    assert.strictEqual(h.controller.isOpen,false);
    h.controller.dispose();
    h.button.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert.strictEqual(playerEscapes,1);
    h.dom.window.close();
  });
  it('deduplicates mounts and releases subscriptions, DOM, and queued work', async () => {
    const h=setup();
    assert.strictEqual(h.panel.mountDock({container:h.container,button:h.button}),h.controller);
    assert.strictEqual(h.container.querySelectorAll('.zenzaNotificationDock').length,1);
    h.controller.toggle(); h.controller.dispose(); await flush();
    assert.strictEqual(h.reads,0);
    assert.strictEqual(h.subscribers.size,0);
    assert.strictEqual(h.container.querySelector('.zenzaNotificationDock'),null);
    const next=h.panel.mountDock({container:h.container,button:h.button});
    assert.notStrictEqual(next,h.controller);
    next.dispose(); h.dom.window.close();
  });
  it('keeps search, severity filtering, and confirmed deletion available in the dock', async () => {
    const h=setup();
    h.records.push({id:'2',timestamp:2,category:'comment',level:'success',message:'投稿完了',details:{}});
    h.controller.toggle(); await flush();
    const query=h.container.querySelector('input'), filter=h.container.querySelector('select');
    query.value='投稿'; query.dispatchEvent(new h.dom.window.Event('input')); await flush();
    assert.strictEqual(h.container.querySelectorAll('.znh-entry').length,1);
    assert(h.container.querySelector('.znh-entry').textContent.includes('投稿完了'));
    query.value=''; filter.value='error'; filter.dispatchEvent(new h.dom.window.Event('change')); await flush();
    assert.strictEqual(h.container.querySelectorAll('.znh-entry').length,1);
    assert(h.container.querySelector('.znh-entry').textContent.includes('通信失敗'));
    const clear=[...h.container.querySelectorAll('button')].find(button=>button.textContent==='全件削除');
    h.dom.window.confirm=()=>false; clear.click(); await flush();
    assert.strictEqual(h.records.length,2);
    h.dom.window.confirm=()=>true; clear.click(); await flush();
    assert.strictEqual(h.records.length,0);
    assert.strictEqual(h.container.querySelectorAll('.znh-entry').length,0);
    h.controller.dispose(); h.dom.window.close();
  });
});
