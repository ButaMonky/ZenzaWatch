'use strict';
// Extract only real util.addStyle(template, {className}) calls from native JS.
// Parsing the AST prevents false matches in comments or CSS literal content.
const {parse}=require('@babel/parser');
const traverse=require('@babel/traverse').default;
const previewKeys=['ITEM_HEIGHT','MAX_HEIGHT','WIDTH'];
function objectName(node){
 return node?.type==='Identifier'?node.name:null;
}
function keyName(node){
 if(node?.type==='Identifier')return node.name;
 if(node?.type==='StringLiteral')return node.value;
 return null;
}
function templateText(node,previewConstants={}){
 if(node?.type!=='TemplateLiteral')throw Error('SCUI_NATIVE_STYLE_NOT_TEMPLATE');
 let css='';
 for(let i=0;i<node.quasis.length;i++){
  const chunk=node.quasis[i].value.cooked;
  if(typeof chunk!=='string')throw Error('SCUI_NATIVE_STYLE_INVALID_ESCAPE');
  css+=chunk;
  if(i<node.expressions.length){
   const expr=node.expressions[i];
   if(expr.type!=='MemberExpression'||expr.computed||
      objectName(expr.object)!=='CommentPreviewView'||
      !Object.prototype.hasOwnProperty.call(previewConstants,keyName(expr.property))){
    throw Error('SCUI_NATIVE_STYLE_UNSUPPORTED_INTERPOLATION');
   }
   css+=String(previewConstants[keyName(expr.property)]);
  }
 }
 return css;
}
function extractPreviewConstants(ast){
 const found=new Map();
 traverse(ast,{AssignmentExpression({node}){
  const left=node.left;
  if(left?.type!=='MemberExpression'||left.computed||
   objectName(left.object)!=='CommentPreviewView')return;
  const name=keyName(left.property);
  if(!previewKeys.includes(name))return;
  if(found.has(name))throw Error('SCUI_NATIVE_CONSTANT_DUPLICATE_'+name);
  if(node.right.type!=='NumericLiteral'||!Number.isFinite(node.right.value)||
     node.right.value<=0)throw Error('SCUI_NATIVE_CONSTANT_NOT_LITERAL_'+name);
  found.set(name,node.right.value);
 }});
 for(const name of previewKeys)if(!found.has(name))throw Error('SCUI_NATIVE_CONSTANT_MISSING_'+name);
 return Object.fromEntries(found);
}
function extractNativePreviewStyles(source){
 const ast=parse(source,{sourceType:'unambiguous'});
 const previewConstants=extractPreviewConstants(ast);
 const wanted=new Set(['commentPreview','commentPreview list','commentPreview hover']);
 const found=new Map();
 traverse(ast,{CallExpression({node}){
  const target=node.callee;
  if(target.type!=='MemberExpression'||target.computed||
    objectName(target.object)!=='util'||keyName(target.property)!=='addStyle')return;
  const opts=node.arguments[1];
  if(opts?.type!=='ObjectExpression')return;
  const prop=opts.properties.find(p=>p.type==='ObjectProperty'&&
    !p.computed&&keyName(p.key)==='className');
  if(prop?.value.type!=='StringLiteral'||!wanted.has(prop.value.value))return;
  const name=prop.value.value;
  if(found.has(name))throw Error('SCUI_NATIVE_STYLE_DUPLICATE_'+name);
  const css=templateText(node.arguments[0],previewConstants);
  if(!css.includes('.zenzaCommentPreview'))throw Error('SCUI_NATIVE_STYLE_INVALID_'+name);
  found.set(name,css);
 }});
 for(const name of wanted)if(!found.has(name))throw Error('SCUI_NATIVE_STYLE_MISSING_'+name);
 return Object.fromEntries(found);
}
// Native CommentPreview is also top-level: don't extract it by indentation-
// sensitive indexOf('  class ...') boundaries, which silently emitted nothing.
function extractNativePreviewClasses(source){
 const names=['CommentPreviewModel','CommentPreviewView',
  'CommentPreviewChatItem','CommentPreview'];
 const statics=['MAX_HEIGHT','WIDTH','HOVER_WIDTH','ITEM_HEIGHT','__tpl__'];
 const ast=parse(source,{sourceType:'unambiguous'}),found=new Map(),staticsFound=new Set();
 const snippets=[];
 traverse(ast,{
  ClassDeclaration({node}){
   const name=node.id?.name;
   if(!names.includes(name))return;
   if(found.has(name))throw Error('SCUI_NATIVE_CLASS_DUPLICATE_'+name);
   found.set(name,true);snippets.push(node);
  },
  ExpressionStatement({node}){
   const expr=node.expression,left=expr?.left;
   if(expr?.type!=='AssignmentExpression'||expr.operator!=='='||
     left?.type!=='MemberExpression'||left.computed||
     objectName(left.object)!=='CommentPreviewView')return;
   const name=keyName(left.property);
   if(statics.includes(name)){
    if(staticsFound.has(name))throw Error('SCUI_NATIVE_STATIC_DUPLICATE_'+name);
    staticsFound.add(name);snippets.push(node);
   }
  }
 });
 for(const name of names)if(!found.has(name))throw Error('SCUI_NATIVE_CLASS_MISSING_'+name);
 for(const name of statics)if(!staticsFound.has(name))throw Error('SCUI_NATIVE_STATIC_MISSING_'+name);
 return snippets.sort((a,b)=>a.start-b.start)
   .map(node=>source.slice(node.start,node.end)).join('\n');
}
function extractNativeTooltipAssets(source){
 const ast=parse(source,{sourceType:'unambiguous'}),assets=new Map();
 traverse(ast,{AssignmentExpression({node}){
  const left=node.left;
  if(left?.type!=='MemberExpression'||left.computed||
     objectName(left.object)!=='SeekBarToolTip')return;
  const key=keyName(left.property);
  if(key!=='__css__'&&key!=='__tpl__')return;
  if(assets.has(key))throw Error('SCUI_NATIVE_TOOLTIP_DUPLICATE_'+key);
  const call=node.right;
  if(call?.type!=='CallExpression'||call.arguments.length||
    call.callee?.type!=='MemberExpression'||
    keyName(call.callee.property)!=='trim'||
    call.callee.object?.type!=='TemplateLiteral'){
    throw Error('SCUI_NATIVE_TOOLTIP_UNSAFE_'+key);
  }
  assets.set(key,templateText(call.callee.object).trim());
 }});
 if(!assets.get('__css__')?.includes('.seekBarToolTip')||
    !assets.get('__tpl__')?.includes('seekBarThumbnailContainer')){
   throw Error('SCUI_NATIVE_TOOLTIP_MISSING');
 }
 return {css:assets.get('__css__'),template:assets.get('__tpl__')};
}
// Storyboard thumbnail CSS is injected by the real SeekBarThumbnail on first
// picture paint. The offline Chromium fixture must include this native rule:
// otherwise it misses the inherited image opacity (.8).
function extractNativeThumbnailStyle(source){
 const ast=parse(source,{sourceType:'unambiguous'}),found=[];
 traverse(ast,{AssignmentExpression({node}){
  const left=node.left;
  if(left?.type!=='MemberExpression'||left.computed||
     objectName(left.object)!=='SeekBarThumbnail'||
     keyName(left.property)!=='__css__')return;
  const call=node.right;
  if(call?.type!=='CallExpression'||call.arguments.length||
     call.callee?.type!=='MemberExpression'||
     keyName(call.callee.property)!=='trim'||
     call.callee.object?.type!=='TemplateLiteral'){
    throw Error('SCUI_NATIVE_THUMBNAIL_UNSAFE');
  }
  found.push(templateText(call.callee.object).trim());
 }});
 if(found.length!==1||!found[0].includes('.zenzaSeekThumbnail-image')){
  throw Error('SCUI_NATIVE_THUMBNAIL_MISSING_OR_DUPLICATE');
 }
 return found[0];
}
module.exports={extractNativePreviewStyles,extractNativePreviewClasses,
 extractNativeTooltipAssets,extractNativeThumbnailStyle};