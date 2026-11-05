'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {extractNativePreviewStyles,extractNativePreviewClasses,
 extractNativeTooltipAssets,extractNativeThumbnailStyle}=require('../../tools/qa/scui-native-css-extractor.cjs');
const source=fs.readFileSync(path.join(__dirname,'../../src/VideoControlBar.js'),'utf8');
describe('SCUI structural native style extraction',()=>{
 it('loads the real storyboard CSS and fails closed for missing or duplicate rules',()=>{
  const native=fs.readFileSync(path.join(__dirname,
   '../../packages/zenza/src/storyboard/SeekBarThumbnail.js'),'utf8');
  const actual=extractNativeThumbnailStyle(native);
  assert(actual.includes('.zenzaSeekThumbnail-image'));
  assert(/opacity:\s*0\.8/.test(actual),'must reproduce native 80% opacity');
  assert.throws(()=>extractNativeThumbnailStyle(native.replace(
   'SeekBarThumbnail.__css__ =','RemovedThumb.__css__ =')),
   /SCUI_NATIVE_THUMBNAIL_MISSING_OR_DUPLICATE/);
  const cloned=native.slice(native.indexOf('SeekBarThumbnail.__css__ = ('))
   .split('//===END===')[0];
  assert.throws(()=>extractNativeThumbnailStyle(native+'\n'+cloned),
   /SCUI_NATIVE_THUMBNAIL_MISSING_OR_DUPLICATE/);
 });
 it('extracts all real CommentPreview classes independently of indentation',()=>{
  const names=['CommentPreviewModel','CommentPreviewView','CommentPreviewChatItem','CommentPreview'];
  const classes=extractNativePreviewClasses(source);
  for(const name of names)assert(classes.includes('class '+name+' '));
  assert.equal(extractNativePreviewClasses(source.replace(/^class CommentPreview/m,
   '  class CommentPreview')),classes);
  assert.throws(()=>extractNativePreviewClasses(source.replace('class CommentPreview {',
   'class RenamedCommentPreview {')),
   /SCUI_NATIVE_CLASS_MISSING_CommentPreview|Export .CommentPreview. is not defined/);
 });
 it('reads native fullscreen tooltip CSS and its real action DOM template',()=>{
  const assets=extractNativeTooltipAssets(source);
  assert(assets.css.includes('.seekBarToolTip'));
  assert(assets.template.includes('toggleCommentPreview'));
  assert(assets.template.includes('seekBarThumbnailContainer'));
  assert.throws(()=>extractNativeTooltipAssets(source.replace('SeekBarToolTip.__css__ =',
   'RemovedTooltip.__css__ =')),/SCUI_NATIVE_TOOLTIP_MISSING/);
 });
 it('reads all three REAL VideoControlBar styles',()=>{
  const styles=extractNativePreviewStyles(source);
  assert.deepStrictEqual(Object.keys(styles).sort(),[
   'commentPreview','commentPreview hover','commentPreview list']);
  assert(styles['commentPreview hover'].includes('preview-text-moving'));
  assert(styles['commentPreview list'].includes('.nicoChat'));
  assert(styles.commentPreview.includes('.zenzaCommentPreview'));
  for(const css of Object.values(styles)){
   assert(!css.includes('${CommentPreviewView.'),'known constants must be resolved');
   assert(!css.includes('className:'),'JS call wrappers must not become CSS');
  }
 });
 it('uses the actual numeric static value rather than a frozen copy',()=>{
  const edited=source.replace('CommentPreviewView.ITEM_HEIGHT = 20;',
   'CommentPreviewView.ITEM_HEIGHT = 24;');
  assert.notEqual(edited,source);
  const normal=extractNativePreviewStyles(source);
  const adjusted=extractNativePreviewStyles(edited);
  assert.notDeepStrictEqual(adjusted,normal,
   'native CSS must track the current runtime class constants');
 });
 it('survives whitespace, quotes, comments and line wrapping around className',()=>{
  const baseline=extractNativePreviewStyles(source);
  for(const variant of [
   (s)=>s.replace("{ className: 'commentPreview hover' }",
     "{className:'commentPreview hover'}"),
   (s)=>s.replace("{ className: 'commentPreview hover' }",
     "{ /* ui test */\n className : \"commentPreview hover\" }"),
   (s)=>s.replace("{ className: 'commentPreview hover' }",
     "{ disabled: false, ['other']: 1,\n className: 'commentPreview hover', }"),
   (s)=>"const bait=\"util.addStyle(`bogus`, {className: 'commentPreview hover'})\";\n"+s
  ]){
   const next=extractNativePreviewStyles(variant(source));
   assert.deepStrictEqual(next,baseline);
  }
 });
 it('fails closed when a native style is missing or duplicated',()=>{
  assert.throws(()=>extractNativePreviewStyles(source.replace(
   "className: 'commentPreview hover'","className: 'renamed hover'")),
   /SCUI_NATIVE_STYLE_MISSING_commentPreview hover/);
  assert.throws(()=>extractNativePreviewStyles(source+
   "\nutil.addStyle(`.zenzaCommentPreview{opacity:0}`, {className:'commentPreview'});"),
   /SCUI_NATIVE_STYLE_DUPLICATE_commentPreview/);
 });
 it('rejects interpolation outside the explicitly modeled preview constants',()=>{
  assert(source.includes('${CommentPreviewView.ITEM_HEIGHT}')||
   source.includes('${CommentPreviewView.MAX_HEIGHT}'));
  const mutated=source.replace(
   /\$\{CommentPreviewView\.(ITEM_HEIGHT|MAX_HEIGHT|WIDTH)\}/,
   '${window.location.href}');
  assert.throws(()=>extractNativePreviewStyles(mutated),
   /SCUI_NATIVE_STYLE_UNSUPPORTED_INTERPOLATION/);
 });
});