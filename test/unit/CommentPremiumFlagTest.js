import assert from 'power-assert';
import {NicoChat} from '../../packages/zenza/src/commentLayer/NicoChat';
const {JSDOM}=require('jsdom');
describe('コメントのプレミアムフラグ（ZW-074 / Task114）',function(){
  it('JSONの0・文字列0・false・欠落は通常コメント',function(){
    for(const premium of [0,'0',false,undefined,null,''])assert.equal(NicoChat.create({premium}).isPremium,false);
  });
  it('JSONの1・文字列1・trueはプレミアムコメント',function(){
    for(const premium of [1,'1',true])assert.equal(NicoChat.create({premium}).isPremium,true);
  });
  it('bulkの保存済み文字列0も通常コメント',function(){
    for(const isPremium of [0,'0',false,undefined,null,''])assert.equal(new NicoChat({isPremium},{format:'bulk'}).isPremium,false);
  });
  it('bulkの保存済み1・文字列1・trueを維持する',function(){
    for(const isPremium of [1,'1',true])assert.equal(new NicoChat({isPremium},{format:'bulk'}).isPremium,true);
  });
  it('XMLの通常コメントはプレミアムにならない',function(){
    const dom=new JSDOM('<chat premium="0" user_id="u" vpos="100" no="1" thread="1">text</chat>',{contentType:'text/xml'});
    try{assert.equal(NicoChat.createFromChatElement(dom.window.document.documentElement).isPremium,false);}finally{dom.window.close();}
  });
  it('XMLのプレミアム値は生成時にも失わない',function(){
    const dom=new JSDOM('<chat premium="1" user_id="u" vpos="100" no="1" thread="1">text</chat>',{contentType:'text/xml'});
    try{const chat=NicoChat.createFromChatElement(dom.window.document.documentElement);assert.equal(chat.isPremium,true);assert.equal(chat.props.isPremium,'1');}finally{dom.window.close();}
  });
  it('reset後は通常コメントへ戻る',function(){
    const chat=NicoChat.create({premium:1});chat.reset();assert.equal(chat.isPremium,false);
  });
});
