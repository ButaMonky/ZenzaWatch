// Task785: parity of dom / text / ui helpers moved to TypeScript (legacy fixture vs
// generated runtime, identical fakes, results and side effects compared).
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const pair=name=>{const s=NICO_API_BY_NAME[name];return [read(s.fixture),read(s.runtime)];};
const flush=async(n=8)=>{for(let i=0;i<n;i++)await Promise.resolve();};

async function compare(name,symbol,makeWorld,run,label,{expectThrow=false}={}){
  const out=[];
  for(const code of pair(name)){
    const w=makeWorld();
    const subject=loadLegacy(code,symbol,w.globals);
    const r=await settle(()=>run(subject,w));
    await flush();
    out.push({r:snapshot(r),log:snapshot(w.log)});
  }
  if(!expectThrow)assert.equal(out[0].r.ok,true,label+' legacy run failed: '+JSON.stringify(out[0].r.error));
  assert.deepEqual(out[1].r,out[0].r,label+' result');
  assert.deepEqual(out[1].log,out[0].log,label+' side effects');
}
function el(log,tag='div',name=''){
  return {tag,name,dataset:{},style:{},classList:{toggle:(c,on)=>log.push(['toggle',name,c,on])},children:[],
    appendChild(c){this.children.push(c);log.push(['appendChild',name,c.tag]);},append(c){this.children.push(c);log.push(['append',name,c.tag||c]);},
    prepend(c){log.push(['prepend',name,c.className,c.textContent,c.innerHTML]);},
    addEventListener(t,f,o){log.push(['listen',name,t,o]);(this.l=this.l||{})[t]=f;},
    dispatchEvent(e){log.push(['dispatch',name,e.type,e.detail,e.bubbles,e.composed]);return true;},
    select(){log.push(['select',name]);},remove(){log.push(['remove',name]);}};
}

test('ClassList caches classList per element', async()=>{
  await compare('ClassList','ClassList',()=>({log:[],globals:{WeakMap}}),C=>{
    const a={classList:{id:1}},b={classList:{id:2}};
    const first=C(a);a.classList={id:9};
    return [first.id,C(a).id,C(b).id];
  },'cache');
});

test('Clipboard: async API or execCommand fallback', async()=>{
  for(const hasApi of [true,false]){
    await compare('Clipboard','Clipboard',()=>{
      const log=[];const body=el(log,'body','body');
      return {log,globals:{navigator:hasApi?{clipboard:{writeText:async t=>{log.push(['write',t]);}}}:{},
        Fullscreen:{get:()=>null},document:{body,createElement:t=>el(log,t,'clip'),execCommand:c=>log.push(['exec',c])},
        window:{setTimeout:f=>{log.push(['timeout']);f();}}}};
    },async c=>[await c.copyText('copy me')],'api='+hasApi);
  }
});

test('domEvent: custom events and command dispatch', async()=>{
  await compare('domEvent','domEvent',()=>{
    const log=[];
    class CustomEvent{constructor(type,init){this.type=type;Object.assign(this,init);}}
    return {log,globals:{CustomEvent,Object,JSON,global:{emitter:{emitAsync:(...a)=>log.push(['emitAsync',...a])}}}};
  },(d,w)=>{
    const target=el(w.log,'div','t');
    d.dispatchCustomEvent(target,'hello',{a:1},{bubbles:true});
    d.dispatchCustomEvent(target,'plain');
    const r=[d.dispatchCommand(target,'play',3)];
    d.bindCommandDispatcher(target,'click');
    // no [data-command] ancestor: only hides the hover
    target.l.click({target:{closest:()=>null}});
    return r;
  },'events');
  // DOM-EVENT-DATASET-001 was fixed in Task787; see nico-api-task787.test.mjs.
});

test('domUtil: create with dataset/style/props, define guarded', async()=>{
  for(const hasCE of [true,false]){
    await compare('domUtil','domUtil',()=>{
      const log=[];const registry=new Map([['x-known',1]]);
      const customElements={get:n=>registry.get(n),define:(n,c)=>{log.push(['define',n]);registry.set(n,c);}};
      return {log,globals:{Object,self:hasCE?{customElements}:{},customElements,
        document:{createElement:t=>({tag:t,dataset:{},style:{}})}}};
    },u=>{
      const e=u.create('span',{id:'i',className:'c',dataset:{a:'1'},style:{color:'red'}});
      return [e,u.create('b'),u.define('x-known',class{}),u.define('x-new',class{})];
    },'customElements='+hasCE);
  }
});

test('watchResize: ResizeObserver or iframe fallback', async()=>{
  for(const hasRO of [true,false]){
    await compare('watchResize','watchResize',()=>{
      const log=[];const ros=[];
      class ResizeObserver{constructor(cb){this.cb=cb;ros.push(this);}observe(t){log.push(['observe',t.name]);}}
      const iframeWin={addEventListener:(t,f)=>{log.push(['iframe.listen',t]);iframeWin.f=f;}};
      return {log,ros,iframeWin,globals:{window:hasRO?{ResizeObserver}:{},Object,
        document:{createElement:t=>({tag:t,style:{},contentWindow:iframeWin})}}};
    },(watch,w)=>{
      const target={name:'target',parentElement:el(w.log,'div','parent')};
      let calls=0;watch(target,()=>calls++);
      if(w.ros.length){w.ros[0].cb([{target:{}},{target}]);w.ros[0].cb([{target:{}}]);}else{w.iframeWin.f();}
      return calls;
    },'ResizeObserver='+hasRO);
  }
});

test('Fullscreen: state, request/cancel with vendor prefixes, single event binding', async()=>{
  await compare('Fullscreen','Fullscreen',()=>{
    const log=[];const body=el(log,'body','body');
    const doc={body,fullscreenElement:null,webkitIsFullScreen:false,
      getElementById:id=>id==='player'?{webkitRequestFullscreen(){log.push(['webkitRequest']);return 'req';}}:null,
      addEventListener:(t,f,c)=>{log.push(['doc.listen',t,c]);doc.handler=f;},
      webkitExitFullscreen(){log.push(['webkitExit']);return 'exit';}};
    return {log,doc,globals:{document:doc,ClassList:e=>e.classList,
      global:{emitter:{emit:(...a)=>log.push(['emit',...a])}}}};
  },(F,w)=>{
    const r=[F.now(),F.get(),F.request('missing'),F.request({}),F.request('player'),F.request('player'),F.cancel()];
    w.doc.webkitIsFullScreen=true;
    r.push(F.now(),F.cancel());
    w.doc.handler();
    return r;
  },'fullscreen');
});

test('reg: last result, scoped helpers', async()=>{
  await compare('reg','reg',()=>({log:[],globals:{Symbol,WeakMap,Object,Array}}),r=>{
    const out=[r(),typeof r.$,typeof r.scope];
    const scoped=r.scope({});
    out.push(scoped());
    return out;
  },'basic');
  // The VM runs sloppy code, where both versions match; the strict-mode difference fixed by
  // Task787 (TEXT-REG-PRIMITIVE-001) is tested in nico-api-task787.test.mjs.
  await compare('reg','reg',()=>({log:[],globals:{Symbol,WeakMap,Object,Array}}),r=>[r(/a(b)/).exec('xab'),r()],
    'exec on a string (sloppy)');
});

test('textUtil: every helper', async()=>{
  await compare('textUtil','textUtil',()=>({log:[],globals:{Math,decodeURIComponent,encodeURIComponent,URIError,escape,unescape,
    atob:s=>Buffer.from(s,'base64').toString('latin1'),btoa:s=>Buffer.from(s,'latin1').toString('base64'),
    document:{createElement:t=>({tag:t})},Object,JSON,Date,isNaN,parseInt,String}}),t=>[
    t.secToTime(0),t.secToTime(75.9),t.secToTime(3725),
    t.parseQuery('?a=1&b=x%20y&c=1=2&bad=%E0%A4%A&&d'),t.parseQuery(),
    t.parseUrl('https://www.nicovideo.jp/watch/sm9'),t.parseUrl(null),
    t.decodeBase64(t.encodeBase64('日本語テキスト')),t.decodeBase64('%%%'),t.encodeBase64('abc'),
    t.escapeHtml(`<a href="x">'&'</a>`),t.unescapeHtml('&lt;b&gt;&amp;&quot;&#39;'),
    t.escapeToZenkaku(`"title" <&> 'x'`),t.escapeRegs('a.b*c(d)[e]{f}|^$\\'),
    t.convertKansuEi('第二十五話 十話 三十話 一話 壱弐'),
    t.dateToString('2026/10/18 01:02:03'),t.dateToString('not a date'),t.dateToString(0),t.dateToString(null),
    t.isValidJson('{"a":1}'),t.isValidJson('{'),
    t.toRgba('#ff8000',0.5),t.toRgba('#000000'),t.snakeToCamel('font-size-x'),t.camelToSnake('fontSizeX'),t.camelToSnake('aB','-')
  ],'helpers');
});

test('PopupMessage: notify/alert/debug, html opt-in, css once, undefined message', async()=>{
  // Keep the original bright-green notify background. Only white text and
  // the two visible animation opacity points intentionally differ from the
  // legacy fixture. Strictly compare all other CSS and effects.
  const normalizeApprovedTheme = css => css
    .replace('color: #fff;', 'color: rgba(255, 255, 255, 0.8);')
    .replace('20% { opacity: 1; }', '20% { opacity: 0.8; }')
    .replace('80% { opacity: 1; }', '80% { opacity: 0.8; }');
  await compare('PopupMessage','PopupMessage',()=>{
    const log=[];const body=el(log,'body','body');
    const make=()=>{const d={className:'',textContent:undefined,innerHTML:undefined,
      addEventListener:(t,f,o)=>log.push(['div.listen',t,o])};return d;};
    return {log,globals:{css:{addStyle:s=>log.push(['addStyle',normalizeApprovedTheme(s)])},
      document:{createElement:make,querySelector:()=>null,body},
      window:{console:{error:m=>log.push(['error',m]),trace:()=>log.push(['trace'])}},
      console:{log:(...a)=>log.push(['log',...a])}}};
  },p=>{p.notify('saved');p.alert('<b>x</b>');p.alert('<b>y</b>',true);p.debug('dbg');p.notify();},'popups');
});
