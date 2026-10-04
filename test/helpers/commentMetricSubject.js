const {beginSection,createContext,run}=require('./extractSource');
// DOM dimensions are controlled only in this unit harness. The browser comparison
// uses the real iframe, stylesheet, offsetWidth and offsetHeight independently.
async function subject({fontSupport=true}={}) {
  const count={width:0,height:0,writes:0},events=[],listeners=new Map();
  const eventTarget=()=>{const hooks=new Map();return {addEventListener(k,fn){if(!hooks.has(k))hooks.set(k,[]);hooks.get(k).push(fn);},fire(k){for(const fn of hooks.get(k)||[])fn();}};};
  const fontSet=Object.assign(eventTarget(),{status:'loaded',size:0,ready:Promise.resolve()});
  const innerWindow=Object.assign(eventTarget(),{devicePixelRatio:1});
  const optionStyle={innerHTML:''};
  const span={className:'',style:{},isConnected:false,get offsetWidth(){count.width++;return span.w;},get offsetHeight(){count.height++;return span.h;},w:180,h:29};
  Object.defineProperty(span,'innerHTML',{get:()=>span.html||'',set(v){count.writes++;span.html=v;}});
  const layer={append(node){node.isConnected=true;},removeChild(node){node.isConnected=false;}};
  const innerDoc={fonts:fontSupport?fontSet:undefined,defaultView:innerWindow,getElementById:k=>({offScreenLayer:layer,optionCss:optionStyle,layoutCss:{innerHTML:'fixed-css'}}[k])};
  innerWindow.document=innerDoc;
  span.ownerDocument=innerDoc;
  const frame={contentWindow:innerWindow,style:{},setAttribute(){}};
  Object.defineProperty(frame,'srcdoc',{get:()=>'',set(){Promise.resolve().then(()=>frame.onload());}});
  const document={createElement:name=>name==='iframe'?frame:span,body:{append(){}}};
  const config={props:{baseFontFamily:'',baseFontBolder:true,cssFontWeight:'bold',baseChatScale:1},onkey(k,fn){if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(fn);},set(k,v){this.props[k]=v;for(const fn of listeners.get(k)||[])fn(v);}};
  const ctx=createContext({document,console:{time(){},timeEnd(){},log(){}},global:{emitter:{emit:(...args)=>events.push(args)}},NicoTextParser:{__css__:'fixed-css'}});
  run(beginSection('packages/lib/src/Emitter.js'),ctx);
  run(beginSection('packages/zenza/src/commentLayer/OffscreenLayer.js')+';globalThis.makeLayer=OffscreenLayer;',ctx);
  const off=await ctx.makeLayer(config).get();await Promise.resolve();
  return {ctx,off,field:off.getTextField(),count,span,config,fontSet,innerWindow,optionStyle,events};
}
module.exports={subject};
