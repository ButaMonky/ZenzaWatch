'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,beginSection,run,read}=require('../helpers/extractSource');

function boot() {
  const dom=new JSDOM('<!doctype html><div class="popupMessageContainer"></div>');
  const values={'popup.notifyColor':'#00cc00','popup.alertColor':'#cc0000',
    'popup.backgroundTransparency':0};
  const styles=[],journal=[];
  dom.window.console={log(){},error(){},trace(){}};
  const ctx=createContext({
    document:dom.window.document,window:dom.window,
    css:{addStyle(value){styles.push(value)}},
    Config:{getValue(key){return values[key]}},
    NotificationJournal:{record(entry){journal.push(entry)}}
  });
  run(beginSection('packages/lib/src/ui/PopupMessage.js')+'\nglobalThis.Popup = PopupMessage;',ctx);
  const Popup=ctx.Popup;
  const root=dom.window.document.querySelector('.popupMessageContainer');
  return {dom,values,styles,journal,Popup,root};
}

describe('Task926 PopupMessage colors from Config',()=>{
  it('keeps original notify/error colors and the existing white text by default',()=>{
    const h=boot();
    try{
      h.Popup.notify('完了');
      h.Popup.alert('失敗');
      const toast=h.root.querySelector('.zenzaPopupMessage.notify');
      const error=h.root.querySelector('.zenzaPopupMessage.alert');
      assert.strictEqual(toast.style.getPropertyValue('--notify-color'),'#00cc00');
      assert.strictEqual(error.style.getPropertyValue('--alert-color'),'#cc0000');
      assert.strictEqual(h.styles.length,1);
      assert(h.styles[0].includes('color: #fff'));
      assert(h.styles[0].includes('zenza-popup-message-animation 5s'));
      assert.deepStrictEqual(h.journal.map(e=>e.level),['info','error']);
    }finally{h.dom.window.close();}
  });
  it('reads updated saved color for the next toast without restarting',()=>{
    const h=boot();
    try{
      h.Popup.notify('最初の通知');
      h.values['popup.notifyColor']='#3a5b7c';
      h.Popup.notify('変更後');
      assert.strictEqual(h.root.children[0].style.getPropertyValue('--notify-color'),'#3a5b7c');
      assert.strictEqual(h.root.children[1].style.getPropertyValue('--notify-color'),'#00cc00');
      h.values['popup.alertColor']='#abc';
      h.Popup.alert('別の色');
      assert.strictEqual(h.root.children[0].style.getPropertyValue('--alert-color'),'#abc');
    }finally{h.dom.window.close();}
  });
  it('rejects malformed stored CSS values and does not alter debug color',()=>{
    const h=boot();
    try{
      h.values['popup.notifyColor']='url(https://example.com)';
      h.values['popup.alertColor']='#abcdef01';
      h.Popup.notify('<danger>');
      h.Popup.alert('エラー');
      h.Popup.debug('調査');
      assert.strictEqual(h.root.querySelector('.notify').style.getPropertyValue('--notify-color'),'');
      assert.strictEqual(h.root.querySelector('.alert').style.getPropertyValue('--alert-color'),'');
      assert.strictEqual(h.root.querySelector('.debug').style.getPropertyValue('--notify-color'),'');
      assert.strictEqual(h.root.querySelector('.notify').textContent,'<danger>');
      const source=read('packages/lib/src/ui/PopupMessage.js');
      assert(source.includes('//@require Config'));
      assert(source.includes('import {Config}'));
    }finally{h.dom.window.close();}
  });
});

describe('Task927 PopupMessage transparent backgrounds',()=>{
  it('sets the same background-only alpha for normal and error notifications',()=>{
    const h=boot();
    try{
      h.values['popup.backgroundTransparency']=40;
      h.Popup.notify('変更されました');
      h.Popup.alert('読み込み失敗');
      assert.strictEqual(
        h.root.querySelector('.notify').style.getPropertyValue('--notify-color'),
        'rgba(0, 204, 0, 0.6)');
      assert.strictEqual(
        h.root.querySelector('.alert').style.getPropertyValue('--alert-color'),
        'rgba(204, 0, 0, 0.6)');
      assert.strictEqual(h.root.querySelector('.notify').style.opacity,'');
      assert.strictEqual(h.root.querySelector('.alert').style.opacity,'');
      assert.strictEqual(h.root.querySelector('.notify').textContent,'変更されました');
      assert(h.styles[0].includes('color: #fff'));
      assert(h.styles[0].includes('zenza-popup-message-animation 5s'));
    }finally{h.dom.window.close();}
  });
  it('supports complete transparency, short HEX, and live Config changes',()=>{
    const h=boot();
    try{
      h.values['popup.notifyColor']='#a1c';
      h.values['popup.backgroundTransparency']=100;
      h.Popup.notify('完全透過');
      assert.strictEqual(
        h.root.querySelector('.notify').style.getPropertyValue('--notify-color'),
        'rgba(170, 17, 204, 0)');
      h.values['popup.backgroundTransparency']=0;
      h.Popup.notify('不透明');
      assert.strictEqual(
        h.root.querySelector('.notify').style.getPropertyValue('--notify-color'),'#a1c');
      h.Popup.debug('診断');
      assert.strictEqual(h.root.querySelector('.debug').style.getPropertyValue('--notify-color'),'');
    }finally{h.dom.window.close();}
  });
  it('ignores invalid stored transparency, and uses safe fallback colors',()=>{
    const h=boot();
    try{
      h.values['popup.backgroundTransparency']=101;
      h.Popup.notify('範囲外');
      assert.strictEqual(h.root.querySelector('.notify').style.getPropertyValue('--notify-color'),'#00cc00');
      h.values['popup.backgroundTransparency']='50';
      h.Popup.alert('文字型');
      assert.strictEqual(h.root.querySelector('.alert').style.getPropertyValue('--alert-color'),'#cc0000');
      h.values['popup.backgroundTransparency']=25.5;
      h.Popup.notify('小数');
      assert.strictEqual(h.root.querySelector('.notify').style.getPropertyValue('--notify-color'),'#00cc00');
      h.values['popup.backgroundTransparency']=50;
      h.values['popup.notifyColor']='url(https://example.org)';
      h.values['popup.alertColor']='#abcd';
      h.Popup.notify('無効色の通常通知');
      h.Popup.alert('無効色のエラー通知');
      assert.strictEqual(h.root.querySelector('.notify').style.getPropertyValue('--notify-color'),'rgba(0, 204, 0, 0.5)');
      assert.strictEqual(h.root.querySelector('.alert').style.getPropertyValue('--alert-color'),'rgba(204, 0, 0, 0.5)');
    }finally{h.dom.window.close();}
  });
});
