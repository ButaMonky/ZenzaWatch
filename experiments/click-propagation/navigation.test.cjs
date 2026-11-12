const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {stripTypeScriptTypes}=require('node:module');const {JSDOM}=require('jsdom');
const code=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'ClickNavigationTrial.ts'),'utf8'));
function fixture({late=false,lazy=false}={}){
 const w=new JSDOM('<div id="CommonHeader"></div><a id="ordinary" href="/watch/sm9">outside</a>',{url:'https://www.nicovideo.jp/',runScripts:'outside-only'}).window;
 let routes=0,observed=0,launches=0;const logs=[],events=new Map();
 class Header {on(name,fn){const a=events.get(name)||[];a.push(fn);events.set(name,a);}closePanel(){} emit(e){for(const fn of events.get('commonHeader:linkClick')||[])fn(e);}}
 const root=w.document.querySelector('#CommonHeader');let api;
 function mount(){api=new Header();root.innerHTML='<a id="hit" href="/watch/sm9"><span>video</span></a>';api.on('commonHeader:linkClick',e=>{e.nativeEvent.type!=='auxclick'&&(e.nativeEvent.ctrlKey||e.nativeEvent.metaKey||e.nativeEvent.target.closest('a')?.target!=='_blank'&&(e.nativeEvent.preventDefault(),api.closePanel(),routes++));});root.addEventListener('click',e=>api.emit({nativeEvent:e,href:'/watch/sm9'}));}
 if(!lazy)w.CommonHeader={default:Header};if(late)mount();
 w.console.info=s=>logs.push(JSON.parse(s.slice('ZENZA_CLICK_TRIAL '.length)));
 w.eval(code+';window.Subject=ClickNavigationTrial;');w.Subject.install(w);
 if(lazy){w.CommonHeader={default:Header};const script=w.document.createElement('script');script.addEventListener('load',mount);w.document.head.append(script);script.dispatchEvent(new w.Event('load'));}else if(!late)mount();
 w.document.addEventListener('click',e=>{if(e.ctrlKey||e.button!==0||e.target.closest('a').pathname.startsWith('/user/'))return;w.Subject.begin(w,e,'sm9',()=>launches++);},true);
 w.document.body.addEventListener('click',()=>observed++);
 return {w,api,logs,click(id='hit',opts={}){w.document.getElementById(id).dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,composed:true,...opts}));},tick:()=>new Promise(r=>w.setTimeout(r,10)),counts:()=>({routes,observed,launches})};
}
for(const lazy of [false,true])test('claimed original click reaches body without official routing; lazy='+lazy,async()=>{const f=fixture({lazy});try{const open=f.w.open;f.click();await f.tick();assert.deepEqual(f.counts(),{routes:0,observed:1,launches:1});assert.equal(f.logs[0].mode,'header-bridge');assert.equal(f.logs[0].headerCallbacksBlocked,1);assert.equal(f.w.open,open);}finally{f.w.close();}});
test('late installation safely stops only header clicks',async()=>{const f=fixture({late:true});try{f.click();await f.tick();assert.deepEqual(f.counts(),{routes:0,observed:0,launches:1});assert.equal(f.logs[0].mode,'header-safe-fallback');f.click('ordinary');await f.tick();assert.deepEqual(f.counts(),{routes:0,observed:1,launches:2});}finally{f.w.close();}});
test('non-video links retain official route',async()=>{const f=fixture();try{f.w.document.querySelector('#hit').href='/user/9';f.click();await f.tick();assert.deepEqual(f.counts(),{routes:1,observed:1,launches:0});}finally{f.w.close();}});
test('Ctrl clicks keep their original treatment',async()=>{const f=fixture();try{f.click('hit',{ctrlKey:true});await f.tick();assert.deepEqual(f.counts(),{routes:0,observed:1,launches:0});}finally{f.w.close();}});
test('unclaimed cancellation is not treated as a Zenza click',()=>{const f=fixture();try{const e={type:'click',ctrlKey:false,metaKey:false,target:f.w.document.querySelector('#hit'),defaultPrevented:true,preventDefault(){}};f.api.emit({nativeEvent:e,href:'/watch/sm9'});assert.equal(f.counts().routes,1);}finally{f.w.close();}});
