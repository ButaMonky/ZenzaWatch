'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const {JSDOM}=require('jsdom');
const {REPO_ROOT}=require('../helpers/buildSandbox');
const {extract}=require('../helpers/extractSource');
function fixture(source) {
 const dom=new JSDOM('<div id="root"><div class="tabSelectContainer">'+['videoInfoTab','relatedVideoTab','comment','playlist'].map((n,i)=>`<div class="tabSelect ${n} ${i===0?'activeTab':''}" data-command="selectTab" data-param="${n}">${n}</div>`).join('')+'</div>'+['videoInfoTab','relatedVideoTab','comment','playlist'].map((n,i)=>`<div class="tabs ${n} ${i===0?'activeTab':''}"><input></div>`).join('')+'</div>',{pretendToBeVisual:true});
 const document=dom.window.document,root=document.querySelector('#root'),commands=[];
 const raw=source.endsWith('.ts') ? fs.readFileSync(path.join(REPO_ROOT,source),'utf8') : null;
 const code=raw ? require('module').stripTypeScriptTypes(raw.slice(raw.indexOf('class VideoInfoPanel extends'),raw.indexOf('\ncss.addStyle(')),{mode:'strip'}) : extract(source,'VideoInfoPanel');
 const context=vm.createContext({Emitter:class{},window:dom.window,document,domEvent:{dispatchCommand:(target,command,param)=>commands.push({command,param})}});
 const Type=vm.runInContext(code+';VideoInfoPanel',context),view=Object.create(Type.prototype);
 const wrap=nodes=>({find:s=>wrap([...root.querySelectorAll(s)]),removeClass:c=>nodes.forEach(n=>n.classList.remove(c)),addClass:c=>nodes.forEach(n=>n.classList.add(c))});
 view._view=root;view._$view=wrap([root]);
 return {dom,root,view,commands,tabs:[...root.querySelectorAll('.tabSelect')],key:(target,key)=>{const e=new dom.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});view._onTabKeyDown(eWithTarget(e,target));return e;}};
}
function eWithTarget(e,target){Object.defineProperty(e,'target',{value:target});return e;}
for(const source of (process.env.AUD_PANEL_SOURCE ? [process.env.AUD_PANEL_SOURCE] : ['tools/typescript-stage1/nico-src/VideoInfoPanel.ts','src/VideoInfoPanel.js','dist/ZenzaWatch-dev.user.js'])) describe('AUD82 keyboard tabs: '+source,()=>{
 let f;afterEach(()=>f?.dom.window.close());
 it('exposes one selected tab stop and associated panel semantics',()=>{f=fixture(source);f.view._syncTabAccessibility();assert.deepStrictEqual(f.tabs.map(t=>t.tabIndex),[0,-1,-1,-1]);assert.strictEqual(f.tabs[0].getAttribute('aria-selected'),'true');assert.strictEqual(f.tabs[0].getAttribute('role'),'tab');assert.strictEqual(f.root.querySelector('.tabSelectContainer').getAttribute('role'),'tablist');assert.strictEqual(f.root.querySelector('.tabs').getAttribute('role'),'tabpanel');});
 it('moves focus with arrows/Home/End but activates only with Enter/Space',()=>{f=fixture(source);f.view._syncTabAccessibility();f.tabs[0].focus();assert(f.key(f.tabs[0],'ArrowRight').defaultPrevented);assert.strictEqual(f.dom.window.document.activeElement,f.tabs[1]);assert.strictEqual(f.commands.length,0);f.key(f.tabs[1],'End');assert.strictEqual(f.dom.window.document.activeElement,f.tabs[3]);f.key(f.tabs[3],'Home');assert.strictEqual(f.dom.window.document.activeElement,f.tabs[0]);f.key(f.tabs[0],'ArrowLeft');assert.strictEqual(f.dom.window.document.activeElement,f.tabs[3]);f.key(f.tabs[3],' ');assert.deepStrictEqual(f.commands,[{command:'selectTab',param:'playlist'}]);});
 it('synchronizes selected state when mouse or external commands switch tabs',()=>{f=fixture(source);f.view.selectTab('comment');assert.deepStrictEqual(f.tabs.map(t=>t.tabIndex),[-1,-1,0,-1]);assert.strictEqual(f.tabs[2].getAttribute('aria-selected'),'true');assert.strictEqual(f.tabs[0].getAttribute('aria-selected'),'false');});
 it('skips disabled/hidden tabs and leaves non-tab input keys alone',()=>{f=fixture(source);f.tabs[1].style.display='none';f.tabs[2].setAttribute('aria-disabled','true');f.view._syncTabAccessibility();f.key(f.tabs[0],'ArrowRight');assert.strictEqual(f.dom.window.document.activeElement,f.tabs[3]);const input=f.root.querySelector('input');assert.strictEqual(f.key(input,'ArrowRight').defaultPrevented,false);assert.strictEqual(f.commands.length,0);});
});
