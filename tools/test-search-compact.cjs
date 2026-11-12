const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'../src/VideoInfoPanel.js'),'utf8');
const extract=name=>{const marker='VideoSearchForm.'+name+' = (';const start=source.indexOf('`',source.indexOf(marker));return source.slice(start+1,source.indexOf('`',start+1));};
const fit=source.slice(source.indexOf('    _updateFocus() {'),source.indexOf('    get word()',source.indexOf('    _updateFocus() {'))).trim();
(async()=>{
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try{
const page=await browser.newPage({reducedMotion:'reduce'});await page.route('**/*',r=>r.abort());
let cases=0;
for(const mode of ['normal','big','wide'])for(const height of [360,900])for(const font of [14,20])for(const variant of ['merged','side','delayed']){
await page.setViewportSize({width:360,height});
await page.setContent('<style>body{margin:0;background:#111;color:#ccc;font:'+font+'px Arial}.zenzaWatchVideoHeaderPanel{position:absolute;top:30px;left:0;width:100%;height:100px}'+extract('__css__')+' *{animation:none!important;transition:none!important;scroll-behavior:auto!important}</style><body class="zenzaScreenMode_'+mode+'"><div class="is-open"><div class="zenzaWatchVideoHeaderPanel is-onscreen">'+extract('__tpl__')+'</div></div>');
await page.evaluate(({variant,fit})=>{
const panel=document.querySelector('.zenzaVideoSearchPanel');
const box=panel.querySelector('.searchVideoIdResult');box.classList.add('is-open','is-word','is-bare','has-tags','is-mode-'+variant);
panel.querySelector('.searchVideoIdResult-tags').innerHTML=Array.from({length:10},(_,i)=>'<li class="searchVideoIdResult-tag"><span class="searchVideoIdResult-tagText">東方の検索候補 '+i+'</span><span class="searchVideoIdResult-tagCount">32,998件</span></li>').join('');
panel.querySelector('.searchWordInput').focus();
const obj=new Function('return ({'+fit+'})')();obj._view=panel;obj._updateFocus();
},{variant,fit});
await page.waitForTimeout(400);
const result=await page.evaluate(()=>{
const p=document.querySelector('.zenzaVideoSearchPanel'),tags=p.querySelector('.searchVideoIdResult-tags'),list=p.querySelector('.searchVideoIdResult-list'),foot=p.querySelector('.searchInputFoot'),head=p.querySelector('.searchInputHead');
const rows=[...head.querySelectorAll('.searchModeRow')].map(e=>e.getBoundingClientRect());
const before={nested:tags.scrollHeight>tags.clientHeight+1,cardScroll:list.clientHeight>0&&list.scrollHeight>list.clientHeight+1,after:foot.getBoundingClientRect().top>=tags.getBoundingClientRect().bottom-1,oneRow:Math.abs(rows[0].top-rows[1].top)<2,inside:p.getBoundingClientRect().bottom<=innerHeight+1};
p.scrollTop=p.scrollHeight;
return {...before,footerReachable:foot.getBoundingClientRect().bottom<=innerHeight+1,overflow:[...head.querySelectorAll('label')].some(e=>e.getBoundingClientRect().right>p.getBoundingClientRect().right+1),scrollable:p.scrollHeight>p.clientHeight+1};
});
assert.deepEqual({...result,scrollable:undefined},{nested:false,cardScroll:false,after:true,oneRow:true,inside:true,footerReachable:true,overflow:false,scrollable:undefined},JSON.stringify({mode,height,font,variant,result}));
if(height===900)assert.equal(result.scrollable,false,'tall viewport must show all candidates');
if(height===360)assert.equal(result.scrollable,true,'short viewport must scroll whole panel');
await page.locator('input[name="selectContentType"][value="short"]').evaluate(e=>e.closest('label').click());
assert.equal(await page.locator('input[name="selectContentType"][value="short"]').isChecked(),true);
cases++;
}
// Video-ID cards, menu scaling, and viewport resize use the same outer scroller.
for(const width of [360,800])for(const scale of [1,1.25]){
await page.setViewportSize({width,height:900});
await page.evaluate(({scale,fit})=>{
const panel=document.querySelector('.zenzaVideoSearchPanel'),header=panel.parentElement;
header.style.transform='scale('+scale+')';header.style.transformOrigin='top left';header.style.width=(100/scale)+'%';
const box=panel.querySelector('.searchVideoIdResult');box.classList.remove('is-word','is-mode-delayed');box.classList.add('is-mode-side');
panel.querySelector('.searchVideoIdResult-list').innerHTML=Array.from({length:5},()=>'<div class="searchVideoCard"><div class="searchVideoCard-main"><div class="searchVideoCard-thumb"></div><div>テスト動画</div></div><button type="button">再生</button></div>').join('');
panel.querySelector('.searchWordInput').focus();
const obj=new Function('return ({'+fit+'})')();obj._view=panel;window.fitFixture=()=>obj._updateFocus();window.fitFixture();
},{scale,fit});
for(const height of [900,360]){
await page.setViewportSize({width,height});
await page.evaluate(()=>window.fitFixture());
const result=await page.evaluate(()=>{
const panel=document.querySelector('.zenzaVideoSearchPanel'),foot=panel.querySelector('.searchInputFoot'),list=panel.querySelector('.searchVideoIdResult-list');
const right=panel.getBoundingClientRect().right;
const clipped=[...panel.querySelectorAll('.searchVideoCard, .searchVideoIdResult-tag')].some(e=>e.getBoundingClientRect().right>right+1);
const nested=list.scrollHeight>list.clientHeight+1;
const after=foot.getBoundingClientRect().top>=list.getBoundingClientRect().bottom-1;
panel.scrollTop=panel.scrollHeight;
return {clipped,nested,after,reachable:foot.getBoundingClientRect().bottom<=innerHeight+1};
});
assert.deepEqual(result,{clipped:false,nested:false,after:true,reachable:true},JSON.stringify({width,scale,height,result}));
cases++;
}
}
// Exercise real initialization and its focus/resize wiring, without API preview work.
await page.setViewportSize({width:800,height:900});
await page.evaluate(({classSource,tpl})=>{
window.Config={namespace:()=>({props:{mode:'tag',sort:'h',word:'東方'},on(){}})};
window.cssUtil={addStyle(){}};
window._={debounce:fn=>fn};
window.global={emitter:{on(){}},debug:{}};
const Form=new Function('Emitter',classSource+';return VideoSearchForm;')(class{});
Form.__tpl__=tpl;Form.__css__='';Form.UNORDERABLE=['h','p'];
Form.prototype._initVideoIdPreview=function(){};
const header=document.querySelector('.zenzaWatchVideoHeaderPanel');
header.innerHTML='';header.style.transform='none';header.style.width='100%';
window.realSearchFixture=new Form({parentNode:header});
window.realSearchFixture._word.focus();
},{classSource:source.slice(source.indexOf('class VideoSearchForm extends Emitter'),source.indexOf('VideoSearchForm.UNORDERABLE =')),tpl:extract('__tpl__')});
await page.waitForTimeout(50);
const initial=await page.locator('.zenzaVideoSearchPanel').evaluate(e=>parseFloat(e.style.getPropertyValue('--search-available-height')));
assert(initial>600,'focusin must measure viewport space');
await page.setViewportSize({width:800,height:360});
await page.waitForTimeout(100);
const resized=await page.locator('.zenzaVideoSearchPanel').evaluate(e=>parseFloat(e.style.getPropertyValue('--search-available-height')));
assert(resized<300&&resized>100,'resize listener must refresh available height');
cases++;
if(process.env.SEARCH_LAYOUT_SCREENSHOT){await page.setViewportSize({width:800,height:700});await page.evaluate(()=>{window.fitFixture();document.querySelector('.zenzaVideoSearchPanel').scrollTop=0;});await page.screenshot({path:process.env.SEARCH_LAYOUT_SCREENSHOT});}
console.log('Compact search layout: '+cases+' cases passed');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
