const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {readExternal,sanitizeExternal,siteEnabled}=require('./generated/settings.js');
const {linkTargets,textTargets,validVideoId}=require('./generated/targets.js');
const {mountOverlay}=require('./generated/overlay.js');
const base='https://example.org/';
test('offline target rules handle configurable prefixes and bounded redirect URLs',()=>{
 const defaults=readExternal({});
 assert.deepEqual(linkTargets('https://www.nicovideo.jp/watch/ss123',base,defaults),['ss123']);
 assert.deepEqual(linkTargets('https://www.nicovideo.jp/watch/123',base,defaults),['123']);
 assert.deepEqual(textTargets('sm9',defaults),[]);
 const s=readExternal({'externalLinks.redirects':true,'externalLinks.textIds':true,'externalLinks.prefixes':'sm ss xyz'});
 assert.deepEqual(textTargets('sm9 / ss45 xyz123',s),['sm9','ss45','xyz123']);
 assert.deepEqual(textTargets('asm9 sm9a _ss45 sm9_',s),[]);
 assert.deepEqual(linkTargets('https://youtube.com/redirect?q='+encodeURIComponent('https://www.nicovideo.jp/watch/sm9'),base,s),['sm9']);
 assert.deepEqual(linkTargets('https://example.org/?a='+encodeURIComponent('https://www.nicovideo.jp/watch/sm9')+'&b='+encodeURIComponent('https://www.nicovideo.jp/watch/ss2'),base,s),['sm9','ss2']);
 for(const url of ['javascript:alert(1)','https://www.nicovideo.jp.evil.test/watch/sm9','https://u:p@www.nicovideo.jp/watch/sm9','https://www.nicovideo.jp/watch/nm9'])assert.deepEqual(linkTargets(url,base,s),[]);
 assert(!validVideoId('sm9/../../'));assert(validVideoId('ss123'));assert(!validVideoId('s9'));
});
test('site policies use domain boundaries, exclusion wins, invalid allow lists fail closed',()=>{
 const s=readExternal({'externalLinks.siteMode':'allow','externalLinks.sites':'example.org','externalLinks.excludedSites':'bad.example.org'});
 assert(siteEnabled('sub.example.org',s));assert(!siteEnabled('bad.example.org',s));assert(!siteEnabled('notexample.org',s));
 assert(!siteEnabled('example.org',readExternal({'externalLinks.enabled':false})));
 assert(siteEnabled('https://example.org/',readExternal({'externalLinks.siteMode':'allow','externalLinks.sites':'https://example.org/'})));
 assert(!siteEnabled('https://example.org/private/x',readExternal({'externalLinks.siteMode':'allow','externalLinks.sites':'*://*.example.org/*','externalLinks.excludedSites':'https://example.org/private/*'})));
 assert(!siteEnabled('https://example.org/',readExternal({'externalLinks.siteMode':'allow','externalLinks.sites':'/invalid/'})));
 assert.equal(sanitizeExternal({'externalLinks.size':'bad'})['externalLinks.size'],'small');
});
function fixture(){return new JSDOM('<main><a href="https://www.nicovideo.jp/watch/sm9">movie</a><p>ss123</p><code>sm4</code><textarea>sm5</textarea></main>',{url:base,pretendToBeVisual:true}).window;}
test('one isolated overlay leaves original markup unchanged and does no scanning or requests',()=>{
 const w=fixture(),d=w.document,main=d.querySelector('main'),before=main.outerHTML;let requests=0,observers=0,opens=0;
 w.fetch=()=>requests++;w.MutationObserver=class{constructor(){observers++;}};
 let shadow;const attach=w.Element.prototype.attachShadow;w.Element.prototype.attachShadow=function(o){shadow=attach.call(this,o);return shadow;};
 const api=mountOverlay(w,readExternal({'externalLinks.textIds':true,'externalLinks.displayMode':'hover'}),async()=>opens++);
 const host=d.querySelector('[data-zenza-external-overlay]');
 const hover=el=>el.dispatchEvent(new w.Event('pointerover',{bubbles:true}));
 hover(d.querySelector('a'));assert.equal(host.style.display,'block');assert.equal(shadow.querySelector('button').textContent,'Zen');
 shadow.querySelector('button').click();assert.equal(opens,0,'synthetic input must not authorize playback');
 hover(d.querySelector('p'));assert.equal(host.style.display,'block');hover(d.querySelector('code'));assert.equal(host.style.display,'none');
 assert.equal(main.outerHTML,before);assert.equal(requests,0);assert.equal(observers,0);
 api.dispose();assert(!d.querySelector('[data-zenza-external-overlay]'));w.close();
});
test('disabled mode adds no DOM; live link changes and ambiguous text do not open stale targets',()=>{
 const w=fixture(),d=w.document;const disabled=mountOverlay(w,readExternal({'externalLinks.enabled':false}),async()=>{});assert(!d.querySelector('[data-zenza-external-overlay]'));disabled.dispose();
 const api=mountOverlay(w,readExternal({'externalLinks.textIds':true,'externalLinks.displayMode':'hover'}),async()=>{}),host=d.querySelector('[data-zenza-external-overlay]');
 const p=d.querySelector('p');p.textContent='sm1 ss2';p.dispatchEvent(new w.Event('pointerover',{bubbles:true}));assert.equal(host.style.display,'none');
 const a=d.querySelector('a');a.dispatchEvent(new w.Event('focusin',{bubbles:true}));assert.equal(host.style.display,'block');
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(host.style.display,'none');api.dispose();w.close();
});

test('selection detection excludes code and respects disabled text detection',()=>{
 const w=fixture(),d=w.document;
 w.Range.prototype.getBoundingClientRect=()=>({right:100,top:100});
 const api=mountOverlay(w,readExternal({'externalLinks.displayMode':'selection','externalLinks.textIds':true}),async()=>{});
 const host=d.querySelector('[data-zenza-external-overlay]');
 function select(el){const r=d.createRange();r.selectNodeContents(el);w.getSelection().removeAllRanges();w.getSelection().addRange(r);d.dispatchEvent(new w.Event('selectionchange'));}
 select(d.querySelector('p'));assert.equal(host.style.display,'block');
 select(d.querySelector('code'));assert.equal(host.style.display,'none');
 api.dispose();const other=mountOverlay(w,readExternal({'externalLinks.displayMode':'selection'}),async()=>{});
 select(d.querySelector('p'));assert.equal(d.querySelector('[data-zenza-external-overlay]').style.display,'none');other.dispose();w.close();
});

test('settings can be re-enabled and explicitly saved through shared schema',()=>{
 const {openExternalSettings}=require('./generated/settings-panel.js');
 const w=fixture(),d=w.document;let shadow,saved;
 const attach=w.Element.prototype.attachShadow;w.Element.prototype.attachShadow=function(o){shadow=attach.call(this,o);return shadow;};
 openExternalSettings(d,{'externalLinks.enabled':false,'externalLinks.prefixes':'sm ss'},v=>saved=v);
 const enabled=shadow.querySelector('[data-key="externalLinks.enabled"]'),prefix=shadow.querySelector('[data-key="externalLinks.prefixes"]');
 assert.equal(enabled.disabled,false);assert.equal(prefix.disabled,true);
 enabled.checked=true;enabled.dispatchEvent(new w.Event('change'));assert.equal(prefix.disabled,false);
 prefix.value='sm xyz';assert.equal(saved,undefined);
 const saveButton=[...shadow.querySelectorAll('button')].find(button=>button.textContent==='保存');
 assert(saveButton,'explicit save action is available');saveButton.click();assert.equal(saved['externalLinks.prefixes'],'sm xyz');assert.equal(saved['externalLinks.enabled'],true);
 assert(!d.querySelector('[data-zenza-external-settings]'));w.close();
});

test('activation resolves replacement text instead of detached hover text',async()=>{
 const w=fixture(),d=w.document;let activate,opened;
 const add=w.HTMLButtonElement.prototype.addEventListener;
 w.HTMLButtonElement.prototype.addEventListener=function(type,fn,...rest){if(type==='click')activate=fn;return add.call(this,type,fn,...rest);};
 const api=mountOverlay(w,readExternal({'externalLinks.textIds':true,'externalLinks.displayMode':'hover'}),async id=>{opened=id;});
 const p=d.querySelector('p');p.dispatchEvent(new w.Event('pointerover',{bubbles:true}));p.textContent='sm10';
 // Invoke the captured handler as a unit test; synthetic DOM clicks stay rejected separately.
 await activate({isTrusted:true,preventDefault(){},stopPropagation(){}});assert.equal(opened,'sm10');
 p.dispatchEvent(new w.Event('pointerover',{bubbles:true}));p.setAttribute('contenteditable','true');opened=null;
 await activate({isTrusted:true,preventDefault(){},stopPropagation(){}});assert.equal(opened,null);
 api.dispose();w.close();
});

test('inline mode is default for existing settings and preserves later user choice',()=>{
 assert.equal(readExternal({}).activation,'inline');
 assert.equal(readExternal({'externalLinks.activation':'hover'}).activation,'inline');
 assert.equal(readExternal({'externalLinks.displayMode':'hover'}).activation,'hover');
});

test('inline buttons follow added, changed and removed links without rewriting them',async()=>{
 const {mountInlineButtons}=require('./generated/inline-buttons.js');
 const w=fixture(),d=w.document,a=d.querySelector('a'),original=a.outerHTML;let requests=0,opened=0;
 w.fetch=()=>requests++;const shadows=[];const attach=w.Element.prototype.attachShadow;w.Element.prototype.attachShadow=function(o){const root=attach.call(this,o);shadows.push(root);return root;};
 const api=mountInlineButtons(w,readExternal({}),async()=>opened++),tick=()=>new Promise(r=>w.setTimeout(r,25));
 assert.equal(d.querySelectorAll('[data-zenza-external-inline]').length,1);assert.equal(a.outerHTML,original);
 shadows[0].querySelector('button').click();assert.equal(opened,0);
 const second=a.cloneNode(true);d.querySelector('main').append(second);await tick();assert.equal(d.querySelectorAll('[data-zenza-external-inline]').length,2);
 second.href='https://example.org/other';await tick();assert.equal(d.querySelectorAll('[data-zenza-external-inline]').length,1);
 a.remove();await tick();assert.equal(d.querySelectorAll('[data-zenza-external-inline]').length,0);
 api.dispose();second.href='https://www.nicovideo.jp/watch/sm9';await tick();assert.equal(d.querySelectorAll('[data-zenza-external-inline]').length,0);assert.equal(requests,0);
 const hover=mountInlineButtons(w,readExternal({'externalLinks.displayMode':'hover'}),async()=>{});assert.equal(d.querySelectorAll('[data-zenza-external-inline]').length,0);hover.dispose();w.close();
});

test('display preflight waits for visibility and suppresses only confirmed unavailable links',async()=>{
 const {mountInlineButtons}=require('./generated/inline-buttons.js');const w=fixture(),d=w.document;let callback,checks=0,resolve;
 w.IntersectionObserver=class {constructor(fn){callback=fn;}observe(){}unobserve(){}disconnect(){}};
 const api=mountInlineButtons(w,readExternal({'externalLinks.preflight':'display'}),async()=>{},()=>{checks++;return new Promise(r=>resolve=r);});
 const a=d.querySelector('a'),host=d.querySelector('[data-zenza-external-inline]');assert.equal(checks,0);assert.equal(host.style.display,'none');
 callback([{target:a,isIntersecting:true}]);assert.equal(checks,1);resolve('unknown');await Promise.resolve();assert.equal(host.style.display,'inline-block');api.dispose();
 const hidden=mountInlineButtons(w,readExternal({'externalLinks.preflight':'display'}),async()=>{},async()=>'unavailable');callback([{target:a,isIntersecting:true}]);await Promise.resolve();assert.equal(d.querySelector('[data-zenza-external-inline]').style.display,'none');hidden.dispose();w.close();
});
test('hover preflight ignores stale results after target disappears',async()=>{
 const w=fixture(),d=w.document;let resolve;
 const api=mountOverlay(w,readExternal({'externalLinks.displayMode':'hover','externalLinks.preflight':'display'}),async()=>{},()=>new Promise(r=>resolve=r));
 d.querySelector('a').dispatchEvent(new w.Event('pointerover',{bubbles:true}));d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));resolve('available');await Promise.resolve();assert.equal(d.querySelector('[data-zenza-external-overlay]').style.display,'none');api.dispose();w.close();
});

test('hover preflight cancels the previous gap-hide timer while checking',async()=>{
 const w=fixture(),d=w.document;
 const api=mountOverlay(w,readExternal({'externalLinks.displayMode':'hover','externalLinks.preflight':'display'}),async()=>{},()=>new Promise(r=>w.setTimeout(()=>r('available'),300)));
 d.querySelector('p').dispatchEvent(new w.Event('pointerover',{bubbles:true}));
 d.querySelector('a').dispatchEvent(new w.Event('pointerover',{bubbles:true}));
 await new Promise(r=>w.setTimeout(r,350));assert.equal(d.querySelector('[data-zenza-external-overlay]').style.display,'block');api.dispose();w.close();
});
