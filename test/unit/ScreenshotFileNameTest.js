'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
const Filename=loadClass('src/ScreenshotFileName.js','ScreenshotFileName',createContext({}));
const base={title:'サンプル',watchId:'sm9',videoId:'sm9',uploader:'投稿者',
  currentTime:83,now:new Date('2026-10-10T12:34:56'),formatTime:()=> '1:23'};
describe('Task318 screenshot filename template',()=>{
  it('retains the former filename and the comment-mark suffix by default',()=>{
    assert.strictEqual(Filename.format(base),'サンプル - sm9@1_23.png');
    assert.strictEqual(Filename.format({...base,suffix:'C'}),'サンプル - sm9@1_23C.png');
    assert.strictEqual(Filename.format({...base,prefix:'clip_'}),
      'clip_サンプル - sm9@1_23.png');
  });
  it('allows dates, uploader, field order and dynamic prefix',()=>{
    const template='{date}_{uploader}_{watchId}@{time}{suffix}';
    assert.strictEqual(Filename.format({...base,template,prefix:'{videoId}_'}),
      'sm9_2026-10-10_投稿者_sm9@1_23.png');
    assert.strictEqual(Filename.format({...base,template:'{datetime}_{title}',
      suffix:'C'}),'2026-10-10_12-34-56_サンプルC.png');
  });
  it('rejects unknown template variables and path separators',()=>{
    for(const bad of ['{unknown}', '../backup', 'test/{title}',
      'file\\{watchId}','{title}{broken}','bad|file','',null]){
      if(bad===''){assert.strictEqual(Filename.validateTemplate(bad),true);}
      else {assert.strictEqual(Filename.validateTemplate(bad),false,String(bad));}
    }
    assert.strictEqual(Filename.validateTemplate('{title} - {watchId}@{time}{suffix}'),true);
  });
  it('sanitizes values from video metadata without trusting paths',()=>{
    const generated=Filename.format({...base,title:'../A/B:C<>*',uploader:'Bad\\Name',
      template:'{title}_{uploader}_{watchId}'});
    assert(!/[\\/:<>|?*]/.test(generated));
    assert(generated.endsWith('.png'));
    assert(generated.length<=180);
  });
  it('avoids reserved Windows device names and duplicate extensions',()=>{
    assert.strictEqual(Filename.format({...base,template:'CON'}),'_CON.png');
    assert.strictEqual(Filename.format({...base,template:'{watchId}.png',suffix:'C'}),
      'sm9C.png');
  });
  it('limits overly long names and keeps output as a PNG basename',()=>{
    const generated=Filename.format({...base,title:'山'.repeat(400)});
    assert(generated.length<=180);
    assert(generated.endsWith('.png'));
    assert.strictEqual(generated.match(/\.png$/g).length,1);
  });
});
describe('Task318 actual screenshot entry point',()=>{
  it('uses the same filename builder for a normal and comment screenshot',()=>{
    const ctx=createContext({Emitter:class {},util:{secToTime:()=> '1:23'}});
    ctx.ScreenshotFileName=Filename;
    ctx.Config={props:{
      'screenshot.prefix':'{date}_',
      'screenshot.filenameTemplate':'{watchId}_{time}{suffix}'
    }};
    const Player=loadClass('src/NicoVideoPlayer.js','NicoVideoPlayer',ctx);
    const player=Object.create(Player.prototype);
    player._videoInfo={title:'動画',watchId:'sm9',videoId:'sm9',
      owner:{name:'投稿者'}};
    player._videoPlayer={currentTime:83};
    const name=player._getSaveFileName({suffix:'C'});
    assert(/sm9_1_23C\.png$/.test(name),name);
    assert(/\d{4}-\d{2}-\d{2}_sm9_1_23C\.png$/.test(name),name);
    ctx.Config.props['screenshot.filenameTemplate']='';
    ctx.Config.props['screenshot.prefix']='clip_';
    assert.strictEqual(player._getSaveFileName(),'clip_動画 - sm9@1_23.png');
  });
});