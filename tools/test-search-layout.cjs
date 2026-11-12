// Offline search panel geometry: requires Playwright; never visits NicoNico.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'../src/VideoInfoPanel.js'),'utf8');
const extract=name=>{const marker='VideoSearchForm.'+name+' = (';const start=source.indexOf('`',source.indexOf(marker));return source.slice(start+1,source.indexOf('`',start+1));};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 try {
 const page=await browser.newPage();await page.route('**/*',r=>r.abort());
 const failures=[];
 for(const mode of ['big','wide','normal'])for(const width of [360,800,1212])for(const variant of ['merged','side']){
  await page.setViewportSize({width,height:900});
  await page.setContent('<style>body{margin:0;background:#111;color:#eee}.zenzaWatchVideoHeaderPanel{position:absolute;top:0;left:0;width:100%;height:100px}'+extract('__css__')+'</style><body class="zenzaScreenMode_'+mode+'"><div class="is-open"><div class="zenzaWatchVideoHeaderPanel is-onscreen">'+extract('__tpl__')+'</div></div>');
  await page.evaluate(({variant,classSource,tpl})=>{
   window.Config={namespace:()=>({props:{mode:'tag',sort:'h',word:''},on(){}})};
   window.cssUtil={addStyle(){}};window._={debounce:fn=>fn};window.global={emitter:{on(){}},debug:{}};
   const Form=new Function('Emitter',classSource+';return VideoSearchForm;')(class{});
   Form.__tpl__=tpl;Form.__css__='';Form.UNORDERABLE=['h','p'];
   Form.prototype._initVideoIdPreview=function(){};
   Form.prototype.submit=function(){};
   const header=document.querySelector('.zenzaWatchVideoHeaderPanel');header.innerHTML='';
   new Form({parentNode:header});
   const box=document.querySelector('.searchVideoIdResult');box.classList.add('is-open','is-bare','has-tags','is-mode-'+variant);
   document.querySelector('.searchVideoIdResult-tags').innerHTML='<li class="searchVideoIdResult-tag"><span class="searchVideoIdResult-tagText">東方自作アレンジの長い検索候補</span><span class="searchVideoIdResult-tagCount">32,998件</span></li>';
   document.querySelector('.searchWordInput').focus();
  },{variant,classSource:source.slice(source.indexOf('class VideoSearchForm extends Emitter'),source.indexOf('VideoSearchForm.UNORDERABLE =')),tpl:extract('__tpl__')});
  await page.waitForTimeout(360);
  const bad=await page.evaluate(()=>[...document.querySelectorAll('.searchWordInput,.searchSubmit,.searchInputHead,.searchInputFoot,.searchVideoIdResult,.searchOptionRow select,.searchModeLabel')].filter(el=>{const r=el.getBoundingClientRect();return r.width&& (r.left < -0.5||r.right>innerWidth+0.5||r.top< -0.5)}).map(el=>el.className));
  if(bad.length)failures.push({mode,width,variant,bad});
  await page.locator('label').filter({has:page.locator('input[name="selectContentType"][value="short"]')}).click();
  assert.equal(await page.locator('input[name="selectContentType"][value="short"]').isChecked(),true,JSON.stringify({mode,width,variant,active:await page.evaluate(()=>document.activeElement.tagName)}));
  if(process.env.SEARCH_LAYOUT_SCREENSHOT&&mode==='wide'&&width===800&&variant==='merged')await page.screenshot({path:process.env.SEARCH_LAYOUT_SCREENSHOT});
 }
 assert.deepEqual(failures,[],'search controls must stay inside the viewport');
 console.log('Search layout and radio controls: 18 cases passed');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
