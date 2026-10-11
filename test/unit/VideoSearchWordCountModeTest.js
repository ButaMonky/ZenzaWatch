'use strict';
const assert=require('assert');
const {createContext,extract,run}=require('../helpers/extractSource');
function fakeClassList(initial=[]) {
  const values=new Set(initial);
  return {add:s=>values.add(s),remove:s=>values.delete(s),
    contains:s=>values.has(s),toggle(s,v){if(v){values.add(s);}else{values.delete(s);}}};
}
function harness(mode='on-demand') {
  const timers=new Map(),calls=[];
  let nextId=1;
  const win={setTimeout(cb){const id=nextId++;timers.set(id,cb);return id;},
    clearTimeout(id){timers.delete(id);}};
  const context=createContext({Emitter:class {},window:win});
  context.window=Object.assign(context,win);
  run(extract('src/VideoInfoPanel.js','VideoSearchForm')+
    ';globalThis.Subject=VideoSearchForm;',context);
  const Search=context.Subject;
  Search.WORD_COUNT_DELAY_MS=300;
  Search.WORD_COUNT_CACHE_SIZE=200;
  Search.MAX_VIDEO_ID_TAGS=10;
  Search.fetchWordCount=(word,kind,filter)=>{
    calls.push({word,kind,filter});
    return Promise.resolve(calls.length*10);
  };
  const label={textContent:''};
  const count={textContent:'',classList:fakeClassList(),offsetWidth:0};
  const row={title:'',classList:fakeClassList(),
    querySelector:s=>s.includes('searchLabel')?label:count};
  const tagItems=[];
  const box={classList:fakeClassList(['is-open']),
    querySelector:s=>s==='.searchVideoIdResult-search'?row:null,
    querySelectorAll:s=>s.includes('tag')?tagItems:[]};
  const view=Object.create(Search.prototype);
  Object.assign(view,{_config:{props:{wordCountMode:mode}},_videoIdBox:box,
    _word:{value:'テスト'},_videoIdBare:true,_wordCountCache:new Map(),
    _wordCountSeq:0,_wordCountTimer:null,_tagCountGeneration:0,_tagCountTimer:null,
    _form:{mode:{value:'tag'},f_range:{value:0},l_range:{value:0},genre:{value:'all'},
      elements:{namedItem(){return null;}}}});
  const tick=async()=>{
    const active=[...timers.values()];timers.clear();
    active.forEach(fn=>fn());
    for(let n=0;n<8;n++)await Promise.resolve();
  };
  return {view,Search,box,row,label,count,tagItems,calls,timers,tick};
}
function makeTag(word) {
  const count={textContent:'',classList:fakeClassList()};
  return {dataset:{word},classList:fakeClassList(),
    querySelector:s=>s==='.searchVideoIdResult-tagCount'?count:null,count};
}
describe('Task318 search hit-count traffic policy',()=>{
  it('uses explicit on-demand, auto and off settings with safe fallback',()=>{
    const h=harness('unexpected');
    assert.strictEqual(h.view.wordCountMode,'on-demand');
    for(const m of ['on-demand','auto','off']) {
      h.view._config.props.wordCountMode=m;
      assert.strictEqual(h.view.wordCountMode,m);
    }
  });
  it('on-demand makes zero requests on input; a deliberate request counts once',async()=>{
    const h=harness();
    h.view._updateVideoIdSearchRow();
    await h.tick();
    assert.strictEqual(h.calls.length,0);
    h.view._updateVideoIdSearchRow(false,true);
    await h.tick();
    assert.strictEqual(h.calls.length,1);
    h.view._updateVideoIdSearchRow(false,true);
    await h.tick();
    assert.strictEqual(h.calls.length,1,'cache hit must not repeat the API request');
  });
  it('auto fetches the search row after debounce, off never fetches',async()=>{
    const auto=harness('auto');
    auto.view._updateVideoIdSearchRow();
    assert.strictEqual(auto.calls.length,0);
    await auto.tick();
    assert.strictEqual(auto.calls.length,1);
    const off=harness('off');
    off.view._updateVideoIdSearchRow(false,true);
    await off.tick();
    assert.strictEqual(off.calls.length,0);
    assert.strictEqual(off.count.textContent,'');
  });
  it('invalidates queued and stale count work on dismissal and mode changes',async()=>{
    const h=harness('auto');
    h.view._updateVideoIdSearchRow();
    h.view._cancelPendingWordCounts();
    await h.tick();
    assert.strictEqual(h.calls.length,0);
    h.view._config.props.wordCountMode='off';
    h.view._updateVideoIdSearchRow(true,true);
    await h.tick();
    assert.strictEqual(h.calls.length,0);
  });
  it('auto counts visible tag suggestions at a bounded pace and reuses cache',async()=>{
    const h=harness('auto');
    h.tagItems.push(makeTag('候補一'),makeTag('候補二'));
    h.view._scheduleAutomaticTagCounts();
    await h.tick();
    assert.strictEqual(h.calls.length,1,'do not burst all suggestion requests at once');
    await h.tick();
    assert.strictEqual(h.calls.length,2);
    assert.strictEqual(h.tagItems[0].count.textContent,'10件');
    assert.strictEqual(h.tagItems[1].count.textContent,'20件');
    h.view._scheduleAutomaticTagCounts();
    await h.tick();await h.tick();
    assert.strictEqual(h.calls.length,2,'cache must avoid repeated calls');
  });
  it('off prevents selected suggestion requests, regardless of keyboard or hover',async()=>{
    const h=harness('off');
    const li=makeTag('候補');
    h.view._requestTagCount(li,'候補');
    await h.tick();
    assert.strictEqual(h.calls.length,0);
    assert.strictEqual(li.count.textContent,'');
  });
  it('owner-only cannot calculate hit counts through the normal search API',async()=>{
    const h=harness('auto');
    h.view._form.elements.namedItem=()=>({type:'checkbox',checked:true,disabled:false});
    h.view._updateVideoIdSearchRow();
    h.tagItems.push(makeTag('候補'));
    h.view._scheduleAutomaticTagCounts();
    await h.tick();await h.tick();
    assert.strictEqual(h.calls.length,0);
  });
});
describe('Task318 search setting descriptions',()=>{
  it('provides clearly distinguished, validated preferences for hit counts and playlist size',()=>{
    const {loadClass}=require('../helpers/extractSource');
    const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',
      createContext({}));
    const defaults={'videoSearch.wordCountMode':'on-demand',
      'videoSearch.videoIdSuggestMode':'merged','search.limit':1000};
    const model=new Model({config:{default:defaults,
      getValue:key=>defaults[key]},actions:[]});
    const count=model.descriptor('videoSearch.wordCountMode');
    const limit=model.descriptor('search.limit');
    assert.strictEqual(count.subcategory,'検索');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(count.options.map(o=>o.value))),
      ['on-demand','auto','off']);
    assert(count.description.includes('通信'));
    assert(limit.description.includes('別'));
    assert.strictEqual(model.get('search.limit'),1000);
  });
});
describe('Task318 explicit selection and cancellation',()=>{
  it('keyboard selection of the search row requests once in on-demand mode',async()=>{
    const h=harness();
    h.Search.VIDEO_ID_REG=/^(sm|nm|so|ss)\d+$/i;
    h.view._videoIdNavKey='tag:候補';
    h.view._videoIdNavItems=()=>[
      {key:'search',type:'search',el:h.row},
      {key:'tag:候補',type:'tag',word:'候補'}];
    h.view._updateVideoIdSelection=()=>{};
    h.view._onVideoIdKeyDown({key:'ArrowDown',keyCode:40,
      preventDefault(){},stopPropagation(){}});
    assert.strictEqual(h.view._videoIdNavKey,'search');
    await h.tick();
    assert.strictEqual(h.calls.length,1);
  });
  it('cancels pending automatic suggestion counts before a hidden menu can send requests',async()=>{
    const h=harness('auto');
    h.tagItems.push(makeTag('候補A'),makeTag('候補B'));
    h.view._scheduleAutomaticTagCounts();
    h.box.classList.remove('is-open');
    h.view._cancelPendingWordCounts();
    await h.tick();await h.tick();
    assert.strictEqual(h.calls.length,0);
  });
});