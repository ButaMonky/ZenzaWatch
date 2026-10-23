'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {beginSection,extract,createContext,run}=require('../helpers/extractSource');
const targets=[
  ['source','packages/zenza/src/commentLayer/OffscreenLayer.js'],
  ['generated Dev','dist/ZenzaWatch-dev.user.js']
];
function harness(rel){
  const dom=new JSDOM('<!doctype html><html><body></body></html>',{
    url:'https://example.test/'
  });
  dom.window.console.time=()=>{};
  dom.window.console.timeEnd=()=>{};
  const events=[],handlers=new Map();
  const config={
    props:{baseFontFamily:'Arial',baseFontBolder:true,
      cssFontWeight:'bold',baseChatScale:1},
    onkey(name,fn){handlers.set(name,fn);}
  };
  const ctx=createContext({
    document:dom.window.document,window:dom.window,
    NicoTextParser:{__css__:'.nicoChat { visibility: hidden; }'},
    global:{emitter:{emit:(...args)=>events.push(args)}}
  });
  run(beginSection('packages/lib/src/Emitter.js')+
    '\nglobalThis.__realEmitter=Emitter;',ctx);
  const code=extract(rel,'OffscreenLayer','var');
  run('const OffscreenLayer='+code+';globalThis.__createOffscreen=OffscreenLayer;',ctx);
  return {dom,events,handlers,config,layer:ctx.__createOffscreen(config)};
}
function loadFrame(h){
  const frame=h.dom.window.document.querySelector('iframe');
  assert(frame,'OffscreenLayer must create its measuring iframe');
  assert.strictEqual(frame.getAttribute('sandbox'),'allow-same-origin');
  const ready=frame.onload;
  const doc=frame.contentWindow.document;
  doc.open();doc.write(frame.srcdoc);doc.close();
  if(frame.onload===ready && typeof ready==='function')ready();
  return frame;
}
for(const [label,source] of targets){
  describe('Task706 actual Emitter + OffscreenLayer: '+label,function(){
    this.timeout(15000);
    it('shares the readiness promise and resolves only after frame load',async()=>{
      const h=harness(source);
      try{
        const a=h.layer.get(),b=h.layer.get();
        assert.strictEqual(a,b);
        assert.strictEqual(h.dom.window.document.querySelectorAll('iframe').length,1);
        let resolved=false;a.then(()=>resolved=true);
        await Promise.resolve();
        assert.strictEqual(resolved,false);
        loadFrame(h);
        const layer=await a;
        assert(layer.getTextField());
        assert.strictEqual(typeof layer.optionCss,'string');
        assert.strictEqual(await b,layer);
      }finally{h.dom.window.close();}
    });
    it('emits font CSS updates and exposes numeric text metrics',async()=>{
      const h=harness(source);
      try{
        const ready=h.layer.get();loadFrame(h);
        const layer=await ready;
        assert.match(layer.optionCss,/font-weight/);
        assert(h.events.some(([name])=>name==='updateOptionCss'));
        const field=layer.getTextField();
        field.setText('hello');
        field.setType('naka','medium','','html5');
        field.setFontSizePixel(26);
        const measurement=field.measureChat({},'hello',26,
          'naka','medium','','html5');
        assert(Number.isFinite(measurement.width));
        assert(Number.isFinite(measurement.height));
        h.config.props.baseFontFamily='Test Sans';
        h.handlers.get('baseFontFamily')();
        assert.match(layer.optionCss,/Test Sans/);
        assert.strictEqual(layer.optionCss,h.layer.optionCss);
      }finally{h.dom.window.close();}
    });
  });
}
