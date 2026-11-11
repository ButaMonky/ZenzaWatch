const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {parseDirectLink, verifyLogin, mountLauncher}=require('./launcher.cjs');
const {createRuntimeSession}=require('./launcher.cjs');

test('synthetic player actions are blocked while unrelated page controls remain usable',()=>{
 const w=new JSDOM('<button id="outside">page</button><div class="zenzaPlayerContainer"><button id="inside">like</button></div>').window;
 const dispose=require('./launcher.cjs').installInteractionGuard(w);
 let inside=0,outside=0,commands=0;
 w.document.querySelector('#inside').addEventListener('click',()=>inside++);
 w.document.querySelector('#outside').addEventListener('click',()=>outside++);
 w.document.addEventListener('command',()=>commands++);
 w.document.querySelector('.zenzaPlayerContainer').className='';
 w.document.querySelector('#inside').click();w.document.querySelector('#outside').click();
 w.document.dispatchEvent(new w.CustomEvent('command',{detail:{command:'toggle-like'},bubbles:true}));
 assert.deepEqual([inside,outside,commands],[0,1,0]);
 dispose();w.document.querySelector('#inside').click();assert.equal(inside,1);w.close();
});

test('login failure can retry without bootstrapping twice; all opens recheck login',async()=>{
 let boots=0,inits=0,opens=0,auth=false,checks=0;
 const session=createRuntimeSession({enable:async()=>{},hasExistingRuntime:()=>false,startRuntime:async()=>{
  boots++;session.configure({connect:async()=>{},setLogin:()=>{},initialize:async()=>{inits++;},open:async()=>{opens++;},
   api:{fetch:async()=>{checks++;return {status:auth?200:401,json:async()=>({meta:{status:200},data:{mylists:[]}})};}}});
 }});
 await assert.rejects(session.open('sm9'));assert.equal(inits,0);auth=true;
 await session.open('sm9');await session.open('sm10');auth=false;await assert.rejects(session.open('sm11'));
 assert.deepEqual([boots,inits,opens,checks],[1,1,2,4]);
});

test('only direct official watch links, resolved against actual page base',()=>{
 for(const url of ['https://www.nicovideo.jp/watch/sm9','http://sp.nicovideo.jp/watch/so123?t=4'])
  assert.ok(parseDirectLink(url,'https://example.org/'));
 for(const url of ['sm9','/watch/sm9','https://example.org/watch/sm9','https://www.nicovideo.jp.evil.example/watch/sm9',
 'https://evil.example/?next=https://www.nicovideo.jp/watch/sm9','https://www.nicovideo.jp/tag/sm9',
 'javascript:open("sm9")','https://nico.ms/sm9','https://u:p@www.nicovideo.jp/watch/sm9'])
  assert.equal(parseDirectLink(url,'https://example.org/'),null,url);
 assert.equal(parseDirectLink('//www.nicovideo.jp/watch/sm9','https://example.org/'),'sm9');
});
test('authentication checks actual response and does not accept anonymous HTML or malformed success',async()=>{
 const call=async(status,body)=>verifyLogin({fetch:async()=>({status,json:async()=>body})});
 await call(200,{meta:{status:200},data:{mylists:[]}});
 for(const [status,body] of [[401,{}],[403,{}],[200,{meta:{status:401}}],[200,{}],[503,{}]])
  await assert.rejects(call(status,body));
 await assert.rejects(verifyLogin({fetch:async()=>({status:200,json:async()=>{throw Error('private');}})}),e=>!e.message.includes('private'));
});
test('buttons preserve links, open locally once, handle added and changed links',async()=>{
 const dom=new JSDOM('<a href="https://www.nicovideo.jp/watch/sm9">title</a>',{url:'https://example.org/'});
 const {window:w}=dom;let starts=0;const opened=[];
 const api=mountLauncher(w,{open:async id=>{starts++;opened.push(id);}});
 await new Promise(r=>w.setTimeout(r,30));
 const a=w.document.querySelector('a'),original=a.outerHTML;
 const button=w.document.querySelector('[data-zenza-direct-button]');assert.ok(button);button.click();
 await new Promise(r=>w.setTimeout(r,0));assert.deepEqual(opened,['sm9']);assert.equal(a.outerHTML,original);
 a.href='https://www.nicovideo.jp/watch/sm10';
 await new Promise(r=>w.setTimeout(r,30));button.click();await new Promise(r=>w.setTimeout(r,0));
 assert.deepEqual(opened,['sm9','sm10']);
 const b=a.cloneNode(true);w.document.body.append(b);
 await new Promise(r=>w.setTimeout(r,30));assert.equal(w.document.querySelectorAll('[data-zenza-direct-button]').length,2);
 a.href='https://example.org/watch/sm9';await new Promise(r=>w.setTimeout(r,30));
 assert.equal(w.document.querySelectorAll('[data-zenza-direct-button]').length,1);
 assert.equal(starts,2);api.dispose();w.close();
});
test('failed start gives safe retry UI, never raw authentication errors',async()=>{
 const dom=new JSDOM('<a href="https://www.nicovideo.jp/watch/sm9">title</a>',{url:'https://example.org/'});const w=dom.window;
 const api=mountLauncher(w,{open:async()=>{throw Error('secret cookie');}});
 await new Promise(r=>w.setTimeout(r,30));w.document.querySelector('[data-zenza-direct-button]').click();
 await new Promise(r=>w.setTimeout(r,0));assert.ok(w.document.querySelector('[role=status]'));
 assert.ok(!w.document.body.textContent.includes('secret cookie'));assert.ok(w.document.querySelector('a[href="https://account.nicovideo.jp/login"]'));
 api.dispose();w.close();
});
