// Task850: uQuery moved to TypeScript. Runs the legacy fixture and the generated runtime
// on the real Emitter and a jsdom document; everything except the recorded fixes must
// match, and the fixes are asserted as old-vs-new differences.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,legacySection,snapshot,settle,REPO} from './nico-api-harness.mjs';

emitNico();
const {JSDOM}=createRequire(REPO+'/package.json')('jsdom');
const spec=NICO_API_BY_NAME.uQuery;
const versions={old:read(spec.fixture),new:read(spec.runtime)};
const emitterSection=legacySection(read('packages/lib/src/Emitter.js'));
const bundle=code=>'//===BEGIN===\n'+emitterSection+'\n'+legacySection(code)+'\n//===END===';
const flush=async(n=20)=>{for(let i=0;i<n;i++)await Promise.resolve();};

const HTML=`<!doctype html><body>
<div id="root" class="box a"><ul class="list"><li class="item one" data-x="1">one</li><li class="item two">two</li></ul>
<span class="item three">three</span><input id="in" value="v0"><p id="empty"></p></div>
<div id="other"><b class="item">b</b></div></body>`;

function world(){
  const dom=new JSDOM(HTML,{pretendToBeVisual:true});
  const w=dom.window;const log=[];const raf=[];
  const throttle={raf:fn=>{let queued=false;return (...a)=>{if(queued)return;queued=true;raf.push(()=>{queued=false;fn(...a);});};}};
  const globals={window:w,document:w.document,HTMLElement:w.HTMLElement,Node:w.Node,Document:w.Document,
    EventTarget:w.EventTarget,HTMLCollection:w.HTMLCollection,NodeList:w.NodeList,Window:w.Window,
    CSS:w.CSS||{},CSSStyleValue:w.CSSStyleValue||function(){},throttle,bounce:{},
    console:{warn:(...a)=>log.push(['warn',a[0]]),log(){},error(){}},setTimeout,Promise,Symbol};
  return {dom,w,doc:w.document,log,globals,runRaf(){const l=raf.splice(0);l.forEach(f=>f());}};
}
const load=(k,w)=>loadLegacy(bundle(versions[k]),'uQuery',w.globals);
const show=x=>x&&typeof x==='object'&&'outerHTML' in x?x.outerHTML:x;
const list=$a=>Array.from($a,show);

async function compare(run,label){
  const out=[];
  for(const k of ['old','new']){
    const w=world();const $=load(k,w);
    const r=await settle(()=>run($,w));
    await flush();
    out.push({r:snapshot(r),log:snapshot(w.log),body:w.doc.body.innerHTML});
  }
  assert.equal(out[0].r.ok,true,label+' legacy run failed: '+JSON.stringify(out[0].r.error));
  assert.deepEqual(out[1].r,out[0].r,label+' result');
  assert.deepEqual(out[1].log,out[0].log,label+' log');
  assert.equal(out[1].body,out[0].body,label+' DOM');
}

test('uQuery: construction, traversal and accessors',{timeout:30000},async()=>{
  await compare(($,w)=>{
    const r=[];
    const $items=$('.item');r.push(list($items),$items.length,show($items.na),show($items.nz),String($items[Symbol.toStringTag]));
    r.push(list($('#root').find('li')),list($('#root').find('li').end()),list($('#root').query('.two')));
    r.push(list($(w.doc.querySelectorAll('li'))),list($([1,2,3])),list($($items)),$(42).length,list($({a:1})));
    r.push(list($('#root .two').closest('#root')),list($('li').parent()),list($('#root, #root li').independency));
    const m=$('#root').mapQuery({$items:'.item',_$lis:'li',first:'li',_input:'input'});
    r.push(Object.keys(m.$),Object.keys(m.e),list(m.result.$items),show(m.result.first));
    r.push(list($('li, li').uniq),list($('li').clone()),$('li').htmls.length,$('li').nodes.length,show($('li').firstNode));
    const seen=[];$('li').each(function(i,e){seen.push([i,this===e]);});r.push(seen);
    r.push(list($`<i class="t">${'x'}</i><em>y</em>`),list($('<s>z</s>')),list($.html`<u>${1}</u>`),$.isTL`a${1}b`,$.isTL('a'));
    r.push([...$('li').getHtmls()].length,[...$('li').getNodes()].length,$('li').array.length,$('li').toArray().length);
    const each=[];$.each([5,6],function(i,v){each.push([i,v,this.valueOf()]);});r.push(each,$.proxy(function(){return this.k;},{k:9})());
    return r;
  },'construct');
});

test('uQuery: classes, css, attributes, props, values and text',{timeout:30000},async()=>{
  await compare(($,w)=>{
    const r=[];const $li=$('li');
    $li.addClass('x y');$li.removeClass('y');$li.toggleClass('z');$li.toggleClass('one',false);$li.toggleClass('w',true);
    r.push(list($li),$li.hasClass('x z'),$li.hasClass('one'),$li.hasClass('two'),$('.two').hasClass('two'));
    $li.css({color:'red','background-color':'blue',width:10,marginTop:'3px'});$li.css('font-size','12px');
    r.push($li.css('color'),$li.css('font-size'),$li.css(null)===$li,list($li));
    $li.setAttribute('title','t');$li.attr({'data-a':'1',role:'x'});$li.attr('role','');r.push($li.attr('title'),$li.attr('nope'),list($li));
    $li.prop('tabIndex',3);r.push($li.prop('tabIndex'),$li.prop({hidden:true})===$li,$li.prop('nothing'));
    r.push($('#empty').val(),$('#in').val(),$('#in').val('v1')===undefined,$('#in').val(),$('li').val());
    r.push($('li').text(),$('#empty').text(),$('li').text('T')===undefined,list($('li')));
    r.push($('li').data('x'),$('#empty').hasFocus());
    $('#in').focus();r.push($('#in').hasFocus(),w.doc.activeElement.id);$('#in').blur();r.push(w.doc.activeElement.tagName);
    $('li').hide();r.push(list($('li')));$('li').show();r.push(list($('li')));
    const walked=$('li').walk.className;r.push(Array.from(walked));$('li').walk.title='W';r.push(list($('li')));
    r.push(Array.from($('li').walk.getAttribute('title')));
    return r;
  },'attributes');
});

test('uQuery: insertion, removal and raf batching',{timeout:30000},async()=>{
  await compare(async($,w)=>{
    const r=[];const $ul=$('ul');
    $ul.append('<li>a1</li>');$ul.append(w.doc.createElement('hr'));$ul.prepend($('<li>p</li>'));
    $('#empty').after('after').before('before');$('#empty').insert('append','x',w.doc.createElement('br'));
    $('<i>to</i>').appendTo('#other');$('<i>pre</i>').prependTo(w.doc.querySelector('#other'));$('<i>q</i>').appendTo('#missing');
    $('b').remove();
    const $raf=$('li');$raf.raf.addClass('r1');$raf.raf.css('color','green');$raf.raf.attr('data-r','1');
    const rafPromise=$raf.raf.promise;r.push(list($('li')));w.runRaf();r.push(list($('li')),$raf.raf.promise!==rafPromise,await rafPromise.then(()=>'resolved'));
    $('li').raf.cancel();
    return r;
  },'insert');
});

test('uQuery: events (namespaces, off variants, dblclick, ready)',{timeout:30000},async()=>{
  await compare(async($,w)=>{
    const calls=[];const $li=$('li');
    const a=e=>calls.push(['a',e.type,e.target.textContent]);const b=e=>calls.push(['b',e.type]);
    $li.on('click',a);$li.on('click.ns',b);$li.on('click',a);$li.on('mouseover.ns',b);$li.on('x',null);
    const fire=(sel,type)=>w.doc.querySelector(sel).dispatchEvent(new w.w.Event(type,{bubbles:true}));
    fire('.one','click');fire('.one','mouseover');
    $li.off('click',a);fire('.one','click');
    $li.on('click',a);$li.off('.ns');fire('.one','click');fire('.one','mouseover');
    $li.on('click.k',b);$li.off('click');fire('.one','click');
    $li.on('click',a);$li.off();fire('.one','click');
    $li.dblclick({d:1},e=>calls.push(['dbl',e.data]));fire('.two','dblclick');
    const ready=await $.ready(()=>'r');const done=await $.complete(()=>'c');
    return [calls,ready,done];
  },'events');
});

// ---- fixes: old vs new ----
function both(fn){const out={};for(const k of ['old','new']){const w=world();const $=load(k,w);
  try{out[k]=snapshot(fn($,w));}catch(e){out[k]=['threw',e.name];}}return out;}

test('UQ-TOSNAKE-001 / UQ-DATA-001: data-* names, single JSON encoding, missing element',()=>{
  const r=both($=>{const $li=$('li');$li.data('fooBar',{v:1});$li.data({plainKey:'s'});
    return [$li.attr('data-foo-bar'),$li.attr('data-foo-ar'),$li.attr('data-plain-key'),$li.attr('data-plain-ey'),$li.data('fooBar')];});
  assert.deepEqual(r.old,[null,'{"v":1}',null,'"\\"s\\""',{v:1}]);
  assert.deepEqual(r.new,['{"v":1}',null,'"s"',null,{v:1}]);
  const missing=both($=>$('#empty').data('none'));
  assert.deepEqual(missing.old,['threw','TypeError']);assert.equal(missing.new,null);
});

test('UQ-CLICK-ARGS-001: click(handler) binds, click() triggers',()=>{
  const r=both(($,w)=>{const calls=[];w.doc.querySelector('.one').addEventListener('click',()=>calls.push('native'));
    $('.one').click(()=>calls.push('handler'));const afterBind=calls.slice();$('.one').click();return [afterBind,calls];});
  assert.deepEqual(r.old,[['native'],['native']]);
  assert.deepEqual(r.new,[[],['native','handler']]);
});

test('UQ-PARENTS-001 / UQ-SHADOW-NEW-001 / UQ-CSS-CUSTOMPROP-001',()=>{
  const parents=both($=>Array.from($('.one').parents(),e=>e.nodeName));
  assert.deepEqual(parents.old,[]);assert.deepEqual(parents.new,['UL','DIV','BODY','HTML','#document']);
  const sel=both($=>Array.from($('.one').parents('div'),e=>e.id));
  assert.deepEqual(sel.old,[]);assert.deepEqual(sel.new,['root']);
  const shadow=both($=>{const s=$('#other').shadow();return [s.length,String(s[0])];});
  assert.deepEqual(shadow.old,['threw','TypeError']);assert.deepEqual(shadow.new,[1,'[object ShadowRoot]']);
  const custom=both(($,w)=>{$('#root').css('--zenzaX','5px');$('#root').css({'--y-z':'1'});
    const s=w.doc.querySelector('#root').style;return [s.getPropertyValue('--zenzaX'),s.getPropertyValue('--y-z')];});
  assert.deepEqual(custom.old,['','']);assert.deepEqual(custom.new,['5px','1']);
});
