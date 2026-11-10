import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes,createRequire} from 'node:module';
const require=createRequire(import.meta.url),{JSDOM}=require('jsdom'),parser=require('@babel/parser');
const read=name=>fs.readFileSync(new URL('../nico-src/'+name+'.ts',import.meta.url),'utf8');
const panelSource=read('VideoInfoPanel'),barSource=read('VideoControlBar');
function fixture(t){
 const raw=stripTypeScriptTypes(panelSource,{mode:'strip'}),ast=parser.parse(raw,{sourceType:'module'}),decl=ast.program.body.find(n=>n.type==='ClassDeclaration'&&n.id.name==='VideoInfoPanel');
 const dom=new JSDOM('<div class="zenzaWatchVideoInfoPanel"><div class="tabSelectContainer"><button class="tabSelect videoInfoTab activeTab" data-param="videoInfoTab"></button><button class="tabSelect playlist" data-param="playlist"></button></div><div class="tabs videoInfoTab activeTab">stale video</div><div class="tabs playlist"><button id="next">other video</button></div></div>');t.after(()=>dom.window.close());
 const style=dom.window.document.createElement('style');style.textContent='.tabs:not(.activeTab){display:none}.tabs.activeTab{display:block}'+panelSource.slice(panelSource.indexOf('  /* A failed video'),panelSource.indexOf('  .zenzaWatchVideoInfoPanel {',panelSource.indexOf('  /* A failed video')));dom.window.document.head.append(style);
 const uq=markup=>{const shell=dom.window.document.createElement('div');shell.innerHTML=markup;const node=shell.firstElementChild;return {0:node,addClass(name){node.classList.add(name);return this;},attr(k,v){node.setAttribute(k,v);return this;},text(value){node.textContent=value;return this;},append(value){node.append(value[0]||value);return this;}};};
 const ctx=vm.createContext({Emitter:class{},window:dom.window,uq});vm.runInContext(raw.slice(decl.start,decl.end)+';globalThis.Panel=VideoInfoPanel;',ctx);const panel=Object.create(ctx.Panel.prototype),root=dom.window.document.querySelector('div');
 const wrap=nodes=>({removeClass(name){nodes.forEach(n=>n.classList.remove(name));return this;},addClass(name){nodes.forEach(n=>n.classList.add(name));return this;},append(value){nodes.forEach(n=>n.append(value[0]||value));return this;}});
 panel._view=root;panel._$view={0:root,find:selector=>wrap([...root.querySelectorAll(selector)]),append:value=>root.append(value[0]||value)};panel.classList=root.classList;panel._description={textContent:'old'};panel._videoHeaderPanel={clear(){}};panel._$ownerIcon={raf:{removeClass(){},addClass(){}}};panel._videoInfo={watchId:'old'};return {panel,root,dom};
}
test('metadata failure leaves playlist navigation visible and hides stale metadata; next load restores tabs',t=>{
 const h=fixture(t);let clicked=0;h.root.querySelector('#next').onclick=()=>clicked++;
 h.panel.onLoadFail();assert.equal(h.panel._videoInfo,null);assert.equal(h.panel._activeTabName,'playlist');
 assert.equal(h.dom.window.getComputedStyle(h.root.querySelector('.videoInfoTab.tabs')).display,'none');assert.notEqual(h.dom.window.getComputedStyle(h.root.querySelector('.playlist.tabs')).display,'none');
 assert.equal(h.root.querySelector('.tabSelect.playlist').tabIndex,0);h.root.querySelector('#next').click();assert.equal(clicked,1);
 h.panel.clear();assert.equal(h.root.classList.contains('is-loadFailed'),false);assert.notEqual(h.dom.window.getComputedStyle(h.root.querySelector('.tabSelect.videoInfoTab')).display,'none');
 h.panel.onLoadFail();assert.equal(h.panel._activeTabName,'playlist');
});
test('failed playback enables only previous/next while loading and playback controls remain blocked',t=>{
 const dom=new JSDOM('<div id="host" class="is-error"><div class="prevVideo playControl"></div><div class="nextVideo playControl"></div><div class="togglePlay playControl"></div><div class="seekTop playControl"></div></div>');t.after(()=>dom.window.close());
 const rule=barSource.match(/  \.is-abort\s+\.playControl,[\s\S]*?pointer-events: none;\s*}/)[0];const style=dom.window.document.createElement('style');style.textContent=rule;dom.window.document.head.append(style);
 const blocked=selector=>dom.window.getComputedStyle(dom.window.document.querySelector(selector)).pointerEvents==='none';
 assert(!blocked('.prevVideo'));assert(!blocked('.nextVideo'));assert(blocked('.togglePlay'));assert(blocked('.seekTop'));
 const host=dom.window.document.querySelector('#host');host.className='is-loading';assert(blocked('.prevVideo'));assert(blocked('.nextVideo'));host.className='';assert(!blocked('.togglePlay'));
});

test('playlist initialized after terminal failure becomes the selected accessible tab',t=>{
 const h=fixture(t);h.root.querySelectorAll('.playlist').forEach(node=>node.remove());h.panel.onLoadFail();
 h.panel.appendTab('playlist','プレイリスト');
 const tab=h.root.querySelector('.tabSelect.playlist');assert(tab);assert.equal(tab.getAttribute('aria-selected'),'true');assert.equal(tab.tabIndex,0);
 assert.notEqual(h.dom.window.getComputedStyle(h.root.querySelector('.tabs.playlist')).display,'none');
});
