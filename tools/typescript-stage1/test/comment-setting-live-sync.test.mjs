import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadSource} from './nonvisual-audit-source-harness.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
test('edited font controls follow subsequent shared configuration updates',async()=>{
 const dom=new JSDOM('<main></main>');globalThis.document=dom.window.document;globalThis.window=dom.window;
 const {html,render}=await import('../../../node_modules/lit-html/lit-html.js');
 const Panel=loadSource('nico-src/SettingPanelElement.ts','SettingPanelElement',{DialogElement:class{},window:{}});
 const conf={commentLayer:{},baseFontFamily:'serif',baseChatScale:1,baseFontBolder:false};
 const root=dom.window.document.querySelector('main');
 const draw=()=>render(Panel.getCommentSettingMenu(html,conf),root);
 draw();
 const font=root.querySelector('[data-setting-name="baseFontFamily"]'),size=root.querySelector('[data-setting-name="baseChatScale"]'),bold=root.querySelector('[data-setting-name="baseFontBolder"]');
 font.value='monospace';size.value='1.2';bold.checked=true;
 conf.baseFontFamily='sans-serif';conf.baseChatScale=1.5;conf.baseFontBolder=true;draw();
 assert.equal(font.value,'sans-serif');assert.equal(size.value,'1.5');
 bold.checked=false;conf.baseFontBolder=false;draw();conf.baseFontBolder=true;draw();assert.equal(bold.checked,true);
 dom.window.close();
});

