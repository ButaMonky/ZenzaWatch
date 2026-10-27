'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass,read,run}=require('../helpers/extractSource');

// Test against the real shortcut registry and both actual UI templates.
function template(file,name){
  const source=read(file),tick=String.fromCharCode(96);
  const pattern=new RegExp(name+'\\.__tpl__\\s*=\\s*\\('+tick+'([\\s\\S]*?)'+tick+'\\)\\.trim\\(\\)');
  const match=source.match(pattern);
  assert(match,name+' template missing');
  return match[1].replace(/\$\{[^}]*\}/g,'#');
}
function harness(scope){
  const source=read('packages/zenza/src/ShortcutActions.js');
  const block=source.split('//===BEGIN===')[1].split('//===END===')[0];
  const ctx=createContext({});
  run(block+';globalThis.RealActions=SHORTCUT_ACTIONS;globalThis.RealFormat=formatKeyCombo;',ctx);
  ctx.SHORTCUT_ACTIONS=ctx.RealActions;
  ctx.formatKeyCombo=ctx.RealFormat;
  const Registry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',ctx);
  const html=scope==='bar'?template('src/VideoControlBar.js','VideoControlBar'):
    template('src/NicoVideoPlayerDialog.js','VideoHoverMenu');
  const dom=new JSDOM('<!doctype html><html><head></head><body>'+html+'</body></html>');
  const root=dom.window.document.querySelector(scope==='bar'?'.videoControlBar':'.hoverMenuContainer');
  assert(root,'real '+scope+' markup not present');
  const values=Object.fromEntries(ctx.RealActions.map(a=>['KEY_'+a.id,a.defaultKey]));
  const listeners=new Map();
  const cfg={
    props:values,
    getValue:key=>values[key],
    onkey(key,fn){
      if(!listeners.has(key))listeners.set(key,new Set());
      listeners.get(key).add(fn);
    },
    offkey(key,fn){listeners.get(key)?.delete(fn);}
  };
  const connection=Registry.connect(cfg,root,scope);
  const get=s=>root.querySelector(s);
  const label=s=>get(s)?.textContent?.trim();
  const set=(id,value)=>{
    values['KEY_'+id]=value;
    for(const fn of listeners.get('KEY_'+id)||[])fn();
  };
  return {root,ctx,dom,Registry,cfg,values,listeners,connection,get,label,set,
    close(){connection.dispose();dom.window.close();}};
}
describe('Task939 actual shortcut tooltips and volume controls',function(){
  this.timeout(16000);
  it('shows correct default mute/fullscreen/seek/loop/previous/next/play keys',()=>{
    const h=harness('bar');
    try{
      assert.strictEqual(h.label('.muteSwitch .tooltip'),'ミュート（M）');
      assert.strictEqual(h.label('.fullscreenSwitch .tooltip'),'フルスクリーン（F）');
      assert.strictEqual(h.label('.seekTop .tooltip'),'先頭（Shift + Home）');
      assert.strictEqual(h.label('.loopSwitch .tooltip'),'リピート（R）');
      assert.strictEqual(h.label('.prevVideo .tooltip'),'前の動画（K）');
      assert.strictEqual(h.label('.nextVideo .tooltip'),'次の動画（J）');
      assert.strictEqual(h.label('.togglePlay .tooltip'),'再生・一時停止（Space）');
    }finally{h.close();}
  });
  it('updates mute and fullscreen when changed, and removes old hardcoded hints',()=>{
    const h=harness('bar');
    try{
      h.set('MUTE',0x1000+81);
      h.set('FULLSCREEN',0x10000+70);
      assert.strictEqual(h.label('.muteSwitch .tooltip'),'ミュート（Shift + Q）');
      assert.strictEqual(h.label('.fullscreenSwitch .tooltip'),'フルスクリーン（Ctrl + F）');
      assert(!h.label('.muteSwitch .tooltip').includes('(M)'));
      assert(!h.label('.fullscreenSwitch .tooltip').includes('(F)'));
      h.set('MUTE',0);h.set('FULLSCREEN',0);
      assert.strictEqual(h.label('.muteSwitch .tooltip'),'ミュート');
      assert.strictEqual(h.label('.fullscreenSwitch .tooltip'),'フルスクリーン');
      h.set('HOME',0);
      assert.strictEqual(h.label('.seekTop .tooltip'),'先頭');
      h.set('HOME',0x1000+36);
      assert.strictEqual(h.label('.seekTop .tooltip'),'先頭（Shift + Home）');
    }finally{h.close();}
  });
  it('shows separate configured volume up/down shortcuts on the actual slider',()=>{
    const h=harness('bar');
    try{
      assert.strictEqual(h.label('.volumeControl .tooltip'),
        '音量調整（上げる: Shift + ↑ / 下げる: Shift + ↓）');
      assert.strictEqual(h.get('.volumeRange').getAttribute('aria-label'),'音量調整');
      h.set('VOL_UP',0x10000+38);
      h.set('VOL_DOWN',0x100000+40);
      assert.strictEqual(h.label('.volumeControl .tooltip'),
        '音量調整（上げる: Ctrl + ↑ / 下げる: Alt + ↓）');
      h.set('VOL_UP',0);
      assert.strictEqual(h.label('.volumeControl .tooltip'),
        '音量調整（下げる: Alt + ↓）');
      h.set('VOL_DOWN',0);
      assert.strictEqual(h.label('.volumeControl .tooltip'),'音量調整');
      h.set('VOL_UP',38);
      assert.strictEqual(h.label('.volumeControl .tooltip'),'音量調整（上げる: ↑）');
    }finally{h.close();}
  });
  it('updates hover-menu hints for watch-later/comment/NG, including unset keys',()=>{
    const h=harness('hover');
    try{
      assert.strictEqual(h.label('.showCommentSwitch .tooltip'),'コメント表示ON/OFF（V）');
      assert.strictEqual(h.label('.mylistButton.deflistAdd .tooltip'),'あとで見る（T）');
      assert.strictEqual(h.label('.ngFilterSwitch .tooltip'),'NGフィルターON/OFF');
      assert.strictEqual(h.label('.toggleLikeButton .tooltip'),'いいね！');
      assert.strictEqual(h.label('.closeButton .tooltip'),'閉じる（Esc）');
      h.set('TOGGLE_COMMENT',0x1000+86);
      h.set('DEFLIST_ADD',0);
      h.set('TOGGLE_NG_FILTER',71);
      h.set('TOGGLE_LIKE',76);
      assert.strictEqual(h.label('.showCommentSwitch .tooltip'),'コメント表示ON/OFF（Shift + V）');
      assert.strictEqual(h.label('.mylistButton.deflistAdd .tooltip'),'あとで見る');
      assert.strictEqual(h.label('.ngFilterSwitch .tooltip'),'NGフィルターON/OFF（G）');
      assert.strictEqual(h.label('.toggleLikeButton .tooltip'),'いいね！（L）');
      h.set('CLOSE',0);
      assert.strictEqual(h.label('.closeButton .tooltip'),'閉じる');
    }finally{h.close();}
  });
  it('keeps tooltips tied to their exact actions and preserves explanatory parentheses',()=>{
    const h=harness('bar');
    try{
      assert.strictEqual(h.label('.screenFilterSwitch .tooltip'),'画面フィルター（明るさ・色）');
      h.set('OPEN_SCREEN_FILTER_PANEL',70);
      assert.strictEqual(h.label('.screenFilterSwitch .tooltip'),
        '画面フィルター（明るさ・色）（F）');
      assert.strictEqual(h.label('.notificationHistorySwitch .tooltip'),'通知履歴');
      h.set('TOGGLE_NOTIFICATION_HISTORY',78);
      assert.strictEqual(h.label('.notificationHistorySwitch .tooltip'),'通知履歴（N）');
      assert.strictEqual(h.label('.screenModeMenu .tooltip'),'画面サイズ・モード変更');
      assert.strictEqual(h.label('.videoServerTypeMenu .tooltip'),'動画サーバー・画質');
      const before=h.label('.seekTop .tooltip');
      h.set('SEEK_LEFT',89);
      assert.strictEqual(h.label('.seekTop .tooltip'),before,
        'seek-to-start is not seek-left');
      assert(h.root.querySelector('.volumeRange').getAttribute('min')==='0.01');
    }finally{h.close();}
  });
  it('hints the storyboard BAR hotkey rather than the thumbnail master switch',()=>{
    const h=harness('bar');
    try{
      assert.strictEqual(h.label('.toggleStoryboard .tooltip'),'シーンサーチ');
      h.set('TOGGLE_STORYBOARD_BAR',0x1000+66);
      assert.strictEqual(h.label('.toggleStoryboard .tooltip'),'シーンサーチ（Shift + B）');
      h.set('TOGGLE_STORYBOARD',0x10000+66);
      assert.strictEqual(h.label('.toggleStoryboard .tooltip'),'シーンサーチ（Shift + B）',
        'thumbnail toggle must not replace storyboard bar toggle hint');
      h.set('TOGGLE_STORYBOARD_BAR',0);
      assert.strictEqual(h.label('.toggleStoryboard .tooltip'),'シーンサーチ');
    }finally{h.close();}
  });
  it('ships the shared source and actual volume tooltip in the private installers',()=>{
    const player=read('dist/ZenzaWatch-dev.user.js');
    const settings=read('dist/ZenzaAdvancedSettings.user.js');
    const source=read('src/_template.js');
    const current=source.match(/^\/\/ @version\s+(\S+)/m)?.[1];
    // Task941: preserve Task939 feature checks for future release versions.
    assert.match(current||'',/^2\.7\.\d+-task\d+$/);
    assert(player.includes('// @version        '+current));
    const settingVersion=read('tools/typescript-stage1/advanced-src/_setting.ts')
      .match(/^\/\/ @version\s+(\S+)/m)?.[1];
    assert.match(settingVersion||'',/^0\.3\.\d+-task\d+$/);
    assert.strictEqual(settings.match(/^\/\/ @version\s+(\S+)/m)?.[1],settingVersion);
    for(const value of ['multiHints','KEY_VOL_UP','KEY_VOL_DOWN',
      'data-shortcut-hint="volume"','class="tooltip">再生・一時停止',
      'class="tooltip">閉じる','max-width: min(90vw, 360px)']){
      assert(player.includes(value),'missing player distribution value: '+value);
    }
    for(const value of ['multiHints','KEY_VOL_UP','KEY_VOL_DOWN']){
      assert(settings.includes(value),'advanced settings missing shared helper: '+value);
    }
    assert(player.includes('https://github.com/ButaMonky/ZenzaWatch/raw/develop/'));
    assert(!read('src/VideoControlBar.js').includes('ミュート(M)'));
    assert(!read('src/VideoControlBar.js').includes('フルスクリーン(F)'));
  });
  it('subscribes and disposes volume changes without losing unrelated observers',()=>{
    const h=harness('bar');
    try{
      for(const id of ['VOL_UP','VOL_DOWN','MUTE','FULLSCREEN','HOME']){
        assert(h.listeners.get('KEY_'+id)?.size>0,id+' not tracked');
      }
      h.connection.dispose();
      assert([...h.listeners.values()].every(fns=>fns.size===0));
      const original=h.label('.volumeControl .tooltip');
      h.set('VOL_UP',0);
      assert.strictEqual(h.label('.volumeControl .tooltip'),original);
    }finally{h.dom.window.close();}
  });
});
