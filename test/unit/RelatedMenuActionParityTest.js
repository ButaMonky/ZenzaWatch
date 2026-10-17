'use strict';
const assert=require('assert');
const {createContext,extract,loadClass,run}=require('../helpers/extractSource');
function setup(kind,options={},links=[]){
  const opened=[],copied=[],commands=[];
  const values={'relatedMenu.builtinOptions':options,'relatedMenu.customLinks':links};
  const config={getValue:key=>values[key],props:values,on(){}};
  const info={videoId:'sm9',watchId:'sm9',title:'Example',
    watchUrl:'https://www.nicovideo.jp/watch/sm9',owner:{type:'user',id:123,name:'Uploader'}};
  const state={isOpen:true,videoInfo:info};
  const ctx=createContext({Emitter:class {},window:{open:(...a)=>opened.push(a)},
    document:{},
    ZenzaWatch:{state:{player:state}},PlayerConfig:{getInstance:()=>config},
    Clipboard:{copyText:text=>copied.push(text)},PopupMessage:{notify(){},alert(){}},
    CommentPictureInPicture:{stop(){}},
    PipPageThumbnail:{initialize(){},stop(){}}});
  const file=source=>kind==='source'?source:'dist/ZenzaWatch-dev.user.js';
  ctx.RelatedMenuOrder=loadClass(file('src/RelatedMenuOrder.js'),'RelatedMenuOrder',ctx);
  ctx.RelatedMenuActions=loadClass(file('packages/zenza/src/menu/RelatedMenuActions.js'),'RelatedMenuActions',ctx);
  run('globalThis.OfficialPlayerRoute='+extract(file('packages/zenza/src/menu/OfficialPlayerRoute.js'),
    'OfficialPlayerRoute','var')+';',ctx);
  const Dialog=loadClass(file('src/NicoVideoPlayerDialog.js'),'NicoVideoPlayerDialog',ctx);
  const dialog=Object.create(Dialog.prototype);
  Object.assign(dialog,{_state:state,_watchId:'sm9',_playerConfig:config,
    on(){},execCommand:(...a)=>commands.push(a)});
  Object.defineProperty(dialog,'currentTime',{value:85,writable:true});
  run('globalThis.Dispatcher='+extract(file('src/RootDispatcher.js'),'RootDispatcher','var')+';',ctx);
  ctx.Dispatcher.initialize(dialog);
  return {root:ctx.Dispatcher,dialog,opened,copied,commands,values,state};
}
for(const kind of ['source','dist']){
  describe('Task396 actual keyboard and menu options ('+kind+')',()=>{
    it('uses saved URL/window settings for keyboard actions and resets to canonical URLs',()=>{
      const h=setup(kind,{ad:{openMode:'new-window',popupWidth:710,popupHeight:580},
        twitter:{openMode:'same-tab',urlTemplate:'https://example.org/?v={videoId}'}});
      h.root.execCommand('open-uad');
      assert(h.opened[0][2].includes('width=710'));
      h.root.execCommand('open-twitter-hash');
      assert.strictEqual(h.opened[1][0],'https://example.org/?v=sm9');
      assert.strictEqual(h.opened[1][1],'_self');
      h.values['relatedMenu.builtinOptions']={};
      h.root.execCommand('open-twitter-hash');
      assert.strictEqual(h.opened[2][0],'https://twitter.com/hashtag/sm9');
    });
    it('preserves the official marker and honors the position and window preferences',()=>{
      const h=setup(kind,{official:{includePosition:false,openMode:'new-window',popupWidth:810}});
      h.dialog._onCommand('openGinza');
      const url=new URL(h.opened[0][0]);
      assert.strictEqual(url.searchParams.get('zenza_official'),'1');
      assert.strictEqual(url.searchParams.has('from'),false);
      assert(h.opened[0][2].includes('width=810'));
    });
    it('forwards a custom-link popup through the actual keyboard dialog callback',()=>{
      const h=setup(kind,{},[{id:'popup',label:'Popup',url:'https://example.org/{videoId}',
        openMode:'new-window',popupWidth:820,popupHeight:610}]);
      h.dialog._onKeyEvent('RELATED_MENU_LINKS',{preventDefault(){},stopPropagation(){}},['popup']);
      assert.strictEqual(h.opened.length,1);
      assert(h.opened[0][2].includes('width=820'));
    });
    it('copies the selected video ID through the real root dispatcher',()=>{
      const h=setup(kind,{'copy-url':{copyFormat:'id'}});
      h.root.execCommand('copy-video-watch-url');
      assert.deepStrictEqual(h.copied,['sm9']);
      h.values['relatedMenu.builtinOptions']={'copy-url':{copyFormat:'position'}};
      h.root.execCommand('copy-video-watch-url');
      assert.strictEqual(h.copied[1],'https://www.nicovideo.jp/watch/sm9?from=85');
    });
    it('does not fall back to another URL when required keyboard metadata is missing',()=>{
      const h=setup(kind,{twitter:{urlTemplate:'https://example.org/{uploaderChannelId}'}});
      h.root.execCommand('open-twitter-hash');
      assert.strictEqual(h.opened.length,0);
    });
    it('only opens an original video when the current video has that special context',()=>{
      const h=setup(kind);
      h.root.execCommand('open-original-video');
      assert.strictEqual(h.commands.length,0,'ordinary video must not reload itself');
      h.state.videoInfo.isMymemory=true;
      h.root.execCommand('open-original-video');
      assert.deepStrictEqual(h.commands,[['openNow','sm9']]);
    });
  });
}

for(const kind of ['source','dist']){
  describe('Task398 keyboard copy integration ('+kind+')',()=>{
    it('routes a copy shortcut without opening a browser tab',()=>{
      const h=setup(kind,{},[{id:'copy',label:'Copy',kind:'copy',copyTemplate:'{videoId}'}]);
      h.dialog._onKeyEvent('RELATED_MENU_LINKS',{preventDefault(){},stopPropagation(){}},['copy']);
      assert.strictEqual(h.opened.length,0);
      const cmd=h.commands.find(x=>x[0]==='copy-related-text');
      assert.deepStrictEqual(cmd,['copy-related-text','sm9']);
      h.root.execCommand(...cmd);
      assert.deepStrictEqual(h.copied,['sm9']);
    });
    it('writes a custom copy as plain text through the root dispatcher',()=>{
      const h=setup(kind);
      h.root.execCommand('copy-related-text','日本語 & sm9\nhttps://example.org');
      assert.deepStrictEqual(h.copied,['日本語 & sm9\nhttps://example.org']);
      assert.strictEqual(h.opened.length,0);
    });
  });
}
