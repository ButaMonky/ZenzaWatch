import assert from 'power-assert';
import {NicoChat} from '../../packages/zenza/src/commentLayer/NicoChat';
const {JSDOM}=require('jsdom');
const {beginSection,createContext,run}=require('../helpers/extractSource');
function xml(id='u-001',premium=1){
 const dom=new JSDOM(`<chat user_id="${id}" premium="${premium}" fork="0" thread="123" no="7" vpos="125" leaf="2" score="0">hello</chat>`,{contentType:'text/xml'});
 try{return NicoChat.createFromChatElement(dom.window.document.documentElement);}finally{dom.window.close();}
}
describe('XMLコメントの投稿者識別（ZW-075 / Task115）',function(){
 it('文字列の投稿者IDを数値化せず保持する',function(){for(const id of ['u-001','00042','0','匿名hash-あ'])assert.equal(xml(id).userId,id);});
 it('同一JSON/XMLが同じ識別属性を持つ',function(){
  const a=xml(),b=NicoChat.create({user_id:'u-001',premium:1,fork:0,thread:123,no:7,vpos:125,leaf:2,score:0,text:'hello'});
  for(const key of ['userId','fork','threadId','no','isPremium','vpos','leaf'])assert.equal(a[key],b[key],key);
  assert.equal(a.props.leaf,2);assert.equal(a.vpos,125);
 });
 it('XML投稿者NGが対象だけに適用される',function(){
  const c=createContext({_:require('lodash'),Config:{getValue(){return false;}}});run(beginSection('packages/lib/src/Emitter.js'),c);
  run(beginSection('packages/zenza/src/commentLayer/NicoChatFilter.js')+';globalThis.Filter=NicoChatFilter;',c);
  const filter=new c.Filter({userIdFilter:'u-001'});
  assert.equal(filter.isSafe(xml()),false);assert.equal(filter.isSafe(xml('other')),true);filter._onChange.cancel();
 });
 it('JSONとbulkの既存入力を保持する',function(){
  assert.equal(NicoChat.create({user_id:'json'}).userId,'json');assert.equal(new NicoChat({userId:'bulk'},{format:'bulk'}).userId,'bulk');
 });
});
