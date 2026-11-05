'use strict';
// Strict, non-evaluating extraction of the actual native seek markup/styles/
// handlers. Anything unexpected fails instead of silently using fake CSS.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {parse}=require('@babel/parser');
const traverse=require('@babel/traverse').default;
const {JSDOM}=require('jsdom');
const ROOT=path.resolve(__dirname,'../..');
const src=fs.readFileSync(path.join(ROOT,'src/VideoControlBar.js'),'utf8');
const constants=fs.readFileSync(path.join(ROOT,'src/constant.js'),'utf8');
const ast=parse(src,{sourceType:'unambiguous'});
const constAst=parse(constants,{sourceType:'unambiguous'});
const name=node=>node?.type==='Identifier'?node.name:
 node?.type==='StringLiteral'?node.value:null;
let barHeight=null;
traverse(constAst,{VariableDeclarator({node}){
 if(name(node.id)!=='CONSTANT'||node.init?.type!=='ObjectExpression')return;
 const prop=node.init.properties.find(p=>name(p.key)==='CONTROL_BAR_HEIGHT');
 if(prop?.value?.type!=='NumericLiteral')throw Error('VCB_CONST_HEIGHT_CHANGED');
 barHeight=prop.value.value;
}});
if(!Number.isFinite(barHeight)||barHeight<=0)throw Error('VCB_CONST_HEIGHT_MISSING');
const cssKeys=['videoControlBar','screenMode for-popup videoControlBar',
 'screenMode for-full videoControlBar','screenMode for-screen-full videoControlBar'];
const methods=['_getTimelineGeometry','_timeToPos',
 '_posToTime','_onSeekRangeInput','_onSeekBarMouseDown',
 '_scheduleStoryboardLongPress','_cancelStoryboardLongPress',
 '_onSeekBarMouseMove','_onWheelSeek','_beginMouseDrag',
 '_endMouseDrag','_onBodyMouseUp','_onWindowBlur',
 '_bindDragEvent','_unbindDragEvent'];
const wheelKeys=['enable','disable','onWheel','onMouseUp','dispatchSeek',
 'refresh','isActive','duration','pos','currentTime'];
const css=new Map(),classMethods=new Map(),wheelMethods=[],tooltipMethods=[];
let markup=null;
function template(node,mode){
 if(node?.type!=='TemplateLiteral')throw Error('VCB_EXPECTED_TEMPLATE_'+mode);
 const allowCSS=new Map([
  ['VideoControlBar.BASE_HEIGHT',String(barHeight)],
  ["util.toRgba('#ffffcc', 0.3)",'rgba(255,255,204,0.3)']
 ]);
 const allowHTML=new Map([
  ['ZenzaWatch.env','QA'],
  ["ZenzaWatch.build || '-'",'qa-build'],
  ['ZenzaWatch.version','qa-version'],
  ["ZenzaWatch.env === 'DEV' ? '(Dev)' : ''",''],
  ['ZenzaCommentHistoryCore.HISTORY_ICON','◫']
 ]);
 let text='';
 for(let i=0;i<node.quasis.length;i++){
  const q=node.quasis[i].value.cooked;
  if(typeof q!=='string')throw Error('VCB_INVALID_TEMPLATE');
  text+=q;
  if(i<node.expressions.length){
   const e=node.expressions[i],literal=src.slice(e.start,e.end);
   const mapped=(mode==='html'?allowHTML:allowCSS).get(literal);
   if(mapped===undefined)throw Error('VCB_UNAPPROVED_INTERPOLATION_'+literal);
   text+=mapped;
  }
 }
 return text;
}
traverse(ast,{
 ClassDeclaration({node}){
  const owner=name(node.id);
  if(owner==='VideoControlBar'){
   for(const method of node.body.body){
    if(method.type==='ClassMethod'&&methods.includes(name(method.key))){
     if(classMethods.has(name(method.key)))throw Error('VCB_METHOD_DUPLICATE');
     classMethods.set(name(method.key),src.slice(method.start,method.end));
    }
   }
  }
  if(owner==='SeekBarToolTip'){
   const item=node.body.body.find(m=>m.type==='ClassMethod'&&name(m.key)==='update');
   if(!item)throw Error('VCB_TOOLTIP_UPDATE_MISSING');
   tooltipMethods.push(src.slice(item.start,item.end));
  }
  if(owner==='WheelSeeker'){
   for(const method of node.body.body){
    if(method.type==='ClassMethod'&&wheelKeys.includes(name(method.key))){
     wheelMethods.push(src.slice(method.start,method.end));
    }
   }
  }
 },
 AssignmentExpression({node}){
  if(name(node.left?.object)!=='VideoControlBar'||name(node.left?.property)!=='__tpl__')return;
  if(markup!==null)throw Error('VCB_HTML_DUPLICATE');
  const call=node.right;
  if(call.type!=='CallExpression'||name(call.callee?.property)!=='trim'||
   call.callee.object?.type!=='TemplateLiteral')throw Error('VCB_HTML_UNSAFE');
  markup=template(call.callee.object,'html').trim();
 },
 CallExpression({node}){
  if(name(node.callee?.object)!=='util'||name(node.callee?.property)!=='addStyle')return;
  const opts=node.arguments[1];
  if(opts?.type!=='ObjectExpression')return;
  const property=opts.properties.find(p=>name(p.key)==='className');
  const key=property?.value?.value;
  if(!cssKeys.includes(key))return;
  if(css.has(key))throw Error('VCB_CSS_DUPLICATE_'+key);
  css.set(key,template(node.arguments[0],'css'));
 }
});
if(!markup||css.size!==cssKeys.length||classMethods.size!==methods.length||
 tooltipMethods.length!==1||wheelMethods.length<12)
 throw Error('VCB_SOURCE_CONTRACT_INCOMPLETE '+JSON.stringify({
  markup:!!markup,css:css.size,methods:classMethods.size}));
const dom=new JSDOM('<!doctype html><body></body>');
const tpl=dom.window.document.createElement('template');tpl.innerHTML=markup;
const root=tpl.content.firstElementChild;
if(!root?.matches('.videoControlBar'))throw Error('VCB_ROOT_NOT_REAL');
const seek=root.querySelector('.seekBar'),range=root.querySelector('input.seekRange');
if(!seek||!range||range.type!=='range')throw Error('VCB_NATIVE_RANGE_MISSING');
seek.id='seek';range.id='range';range.max='1000';range.value='0';
for(const type of ['left','center','right'])
 if(!root.querySelector('.controlItemContainer.'+type+' .scalingUI'))
  throw Error('VCB_REAL_CONTROL_MISSING_'+type);
const classes=methods.map(x=>classMethods.get(x)).join('\n');
const checksum=crypto.createHash('sha256').update(src).digest('hex');
module.exports={markup:root.outerHTML,css:Object.fromEntries(css),
 methods:'class NativeSeekHandlers {\n'+classes+'\n}',
 tooltipMethods:'class NativeTooltipHandlers {\n'+tooltipMethods.join('\n')+'\n}',
 wheelMethods:'class NativeWheelHandlers {\n'+wheelMethods.join('\n')+'\n}',
 methodsList:methods,checksum,barHeight,cssKeys};
