'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const {JSDOM}=require('jsdom'),{stripTypeScriptTypes}=require('node:module');
const parser=require('@babel/parser');
const source=fs.readFileSync('tools/typescript-stage1/nico-src/NicoVideoPlayerDialog.ts','utf8');
const declaration=parser.parse(source,{sourceType:'module',plugins:['typescript']}).program.body.find(n=>n.type==='ClassDeclaration'&&n.id.name==='NicoVideoPlayerDialogView');
const context=vm.createContext({Emitter:class{}});
vm.runInContext(stripTypeScriptTypes(source.slice(declaration.start,declaration.end))+';globalThis.View=NicoVideoPlayerDialogView;',context);
describe('Task1004 unavailable-video reason text',()=>{
 it('converts only plain break tags and preserves existing blank lines',()=>{assert.equal(context.View.formatErrorMessage('削除理由<br>対象作品<BR/>権利者<br />補足\n\n詳細'),'削除理由\n対象作品\n権利者\n補足\n\n詳細');assert.equal(context.View.formatErrorMessage(null),'');assert.equal(context.View.formatErrorMessage(0),'0');});
 it('keeps untrusted tags and encoded markup as literal text in the actual state renderer',()=>{const dom=new JSDOM('<div id="error"></div>');try{const element=dom.window.document.querySelector('#error'),view=Object.create(context.View.prototype);view._$errorMessageContainer=[element];const raw='<img src=x onerror=alert(1)><br onclick=alert(1)><script>alert(1)</script>&lt;br&gt;<br>理由';view._onPlayerStateUpdate('errorMessage',raw);assert.equal(element.childElementCount,0);assert.equal(element.textContent,raw.replace(/<br>/g,'\n'));assert(!element.innerHTML.includes('<script>'));}finally{dom.window.close();}});
 it('allows navigation feedback on terminal errors but preserves loading and playback guards',()=>{const dom=new JSDOM('<div class="is-error"><button class="playControl prevVideo"></button><button class="playControl nextVideo"></button><button class="playControl togglePlay"></button></div>');try{const host=dom.window.document.querySelector('div'),view=Object.create(context.View.prototype);view._$playerContainer=[host];const available=selector=>view._isActionFeedbackTargetAvailable(host.querySelector(selector));assert(available('.prevVideo'));assert(available('.nextVideo'));assert(!available('.togglePlay'));host.className='is-loading';assert(!available('.prevVideo'));host.className='is-abort';assert(!available('.nextVideo'));host.className='is-error';host.querySelector('.nextVideo').disabled=true;assert(!available('.nextVideo'));}finally{dom.window.close();}});

});
