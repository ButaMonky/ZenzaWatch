const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'../src/VideoInfoPanel.js'),'utf8');
const extract=name=>{const start=source.indexOf('`',source.indexOf('VideoSearchForm.'+name+' = ('));return source.slice(start+1,source.indexOf('`',start+1));};
(async()=>{
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
try{
const page=await browser.newPage({reducedMotion:'no-preference'});await page.route('**/*',r=>r.abort());
for(const mode of ['normal','big','wide']){
await page.setViewportSize({width:800,height:700});
await page.setContent('<style>body{margin:0;background:#111;color:#ccc;font:14px Arial}.zenzaWatchVideoHeaderPanel{position:absolute;top:30px;left:0;width:100%;height:100px}'+extract('__css__')+'</style><body class="zenzaScreenMode_'+mode+' is-mouseMoving"><div class="is-open"><div class="zenzaWatchVideoHeaderPanel is-onscreen">'+extract('__tpl__')+'</div></div>');
await page.mouse.move(1,1);
const input=page.locator('.searchWordInput'),initial=await input.boundingBox();
const sample=()=>page.evaluate(async()=>{const values=[];const start=performance.now();while(performance.now()-start<450){await new Promise(requestAnimationFrame);values.push(document.querySelector('.searchWordInput').getBoundingClientRect().top);}return values;});
await page.mouse.move(initial.x+initial.width/2,initial.y+initial.height/2);
const hovered=await sample();
assert.equal(await page.locator('.searchInputHead').evaluate(e=>getComputedStyle(e).visibility),'hidden','hover alone must not open controls');
assert.equal(await page.locator('.searchInputFoot').evaluate(e=>getComputedStyle(e).display),'none','hover alone must not open filters');
assert(Math.abs(initial.y-(30+(mode==='normal'?36:64)))<=1,'closed input must retain its original higher position');
await input.focus();const focused=await sample();
await page.mouse.move(1,1);await input.evaluate(e=>e.blur());const closed=await sample();
const displacement=Math.max(...hovered,...focused,...closed,...[initial.y])-Math.min(...hovered,...focused,...closed,...[initial.y]);
console.log(mode+': input vertical displacement '+displacement+'px');
assert(displacement<=1,'search input must remain anchored through hover/focus/blur; animations are enabled');
}
console.log('Search animation anchoring: 3 cases passed');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
