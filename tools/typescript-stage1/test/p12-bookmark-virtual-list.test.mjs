import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ManualBookmarkVirtualList} from '../p12-src/ManualBookmarkVirtualList.ts';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
function fixture(){
 const dom=new JSDOM('<div id="scroll"><div id="list"></div></div>');
 const scroller=dom.window.document.querySelector('#scroll'),container=dom.window.document.querySelector('#list');
 Object.defineProperty(scroller,'clientHeight',{value:500,configurable:true});
 scroller.getBoundingClientRect=()=>({top:30,height:750});
 container.getBoundingClientRect=()=>({top:30-scroller.scrollTop*1.5,height:15000});
 Object.defineProperty(dom.window.HTMLElement.prototype,'offsetHeight',{get(){return this.classList.contains('zw-library-virtual-item')?Number(this.firstElementChild?.dataset.height)||100:0;}});
 const released=[];
 const virtual=new ManualBookmarkVirtualList(container,scroller,{
  key:row=>row.id,estimate:()=>100,
  render:row=>{const node=dom.window.document.createElement('div');node.dataset.height='100';node.dataset.id=row.id;const input=dom.window.document.createElement('input');node.append(input);return node;},
  release:node=>released.push(node.dataset.libraryVirtualKey),pinned:node=>node.dataset.busy==='true'
 });
 const rows=Array.from({length:100},(_,i)=>({id:String(i)}));virtual.setItems(rows);
 return {dom,scroller,container,virtual,rows,released,close(){virtual.dispose();dom.window.close();}};
}
test('virtual group heights preserve the visible anchor under 150% scale',()=>{
 const h=fixture();h.scroller.scrollTop=1000;h.virtual.refresh();
 const before=h.container.querySelector('[data-library-virtual-key="8"]');before.firstElementChild.dataset.height='250';
 h.virtual.refresh();assert.equal(h.scroller.scrollTop,1150);
 assert(h.container.querySelector('[data-library-virtual-key="10"]'));
 Object.defineProperty(h.scroller,'clientHeight',{value:350,configurable:true});h.virtual.refresh();
 assert.equal(h.scroller.scrollTop,1150);h.close();
});
test('focused and pending groups remain mounted without retaining intervening DOM',()=>{
 const h=fixture(),first=h.container.querySelector('[data-library-virtual-key="0"]');
 const input=first.querySelector('input');input.focus();
 const second=h.container.querySelector('[data-library-virtual-key="1"]');second.dataset.busy='true';
 h.scroller.scrollTop=8000;h.virtual.refresh();
 assert.equal(h.dom.window.document.activeElement,input);assert(h.container.contains(first)&&h.container.contains(second));
 assert(h.container.querySelectorAll('.zw-library-virtual-item').length<25);
 input.blur();delete second.dataset.busy;h.virtual.refresh();assert(!h.container.contains(first)&&!h.container.contains(second));h.close();
});
test('hide releases all nodes but retains scroll extent and restores the prior position',()=>{
 const h=fixture();h.scroller.scrollTop=8000;h.virtual.refresh();h.virtual.setActive(false);
 assert.equal(h.container.querySelectorAll('.zw-library-virtual-item').length,0);
 assert.equal(h.container.firstElementChild.style.height,'10000px');
 h.scroller.scrollTop=0;h.virtual.setActive(true);assert.equal(h.scroller.scrollTop,8000);
 assert(h.container.querySelector('[data-library-virtual-key="80"]'));h.close();
});
test('replacing a filtered list resets scroll and releases removed groups',()=>{
 const h=fixture();h.scroller.scrollTop=9000;h.virtual.refresh();h.virtual.setItems([{id:'99'}],true);
 assert.equal(h.scroller.scrollTop,0);assert.equal(h.container.querySelectorAll('.zw-library-virtual-item').length,1);
 assert(h.container.querySelector('[data-library-virtual-key="99"]'));h.close();
});
