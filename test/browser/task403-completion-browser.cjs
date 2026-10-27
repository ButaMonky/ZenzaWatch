'use strict';
// Offline real-browser acceptance. No user's browser sessions, extensions or network sites.
const fs=require('fs'),path=require('path'),http=require('http'),{spawn}=require('child_process');
const {beginSection,extract}=require('../helpers/extractSource');
const root=path.resolve(__dirname,'../..');
const logs=path.resolve(root,'../../verify-logs/task403');
const mode=process.argv.includes('--dist')?'dist':'source';
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const prefix=path.join(logs,`finish-browser-${mode}-${stamp}`);
const layer='packages/zenza/src/commentLayer/';
const sourceClasses={NgCompositeRules:'src/NgCompositeRules.js',NgCompositeRuleEditor:'src/NgCompositeRuleEditor.js',
 UiVisibilityRegistry:'src/UiVisibilityRegistry.js',ModernAdvancedSettingsModel:'src/ModernAdvancedSettingsModel.js',
 ModernAdvancedSettingsUI:'src/ModernAdvancedSettingsUI.js',Emitter:'packages/lib/src/Emitter.js',
 NicoChat:layer+'NicoChat.js',NicoChatFilter:layer+'NicoChatFilter.js',NicoChatGroup:layer+'NicoChatGroup.js',NicoComment:layer+'NicoComment.js'};
function code(name){
 if(mode==='source')return beginSection(sourceClasses[name]);
 const d=['NgCompositeRuleEditor','UiVisibilityRegistry','ModernAdvancedSettingsModel','ModernAdvancedSettingsUI'].includes(name)?'dist/ZenzaAdvancedSettings.user.js':'dist/ZenzaWatch-dev.user.js';
 if(name==='Emitter'||name==='NicoChat')return rendererCode(sourceClasses[name],[name+'InitFunc'])+'\nconst '+(name==='Emitter'?'{Emitter}':name)+'='+name+'InitFunc();';
 let result=(name==='NgCompositeRules'?'const NG_COLOR_HEX='+extract(d,'NG_COLOR_HEX','var')+';':'')+extract(d,name);
 if(name==='NicoComment')result='const MAX_COMMENT=CommentLayer.MAX_COMMENT;\n'+result;
 return result;
}
// Distribution static constants are extracted from its assignment statements.
function distCode(name){
 if(name!=='NicoChatFilter')return code(name);
 const text=fs.readFileSync(path.join(root,'dist/ZenzaWatch-dev.user.js'),'utf8');
 const start=text.indexOf('NicoChatFilter.SHARED_NG_LEVEL = {'),end=text.indexOf('//===END===',start);
 const matches=text.slice(start,end>start?end:start+1000).match(/NicoChatFilter\.SHARED_NG_(?:LEVEL|SCORE)\s*=\s*\{[^}]*\};/g);
 if(!matches||matches.length!==2)throw Error('Distribution NG constants missing');
 return extract('dist/ZenzaWatch-dev.user.js',name)+'\n'+matches.join('\n');
}
let distributionStatements;
function rendererCode(rel,names){
 if(mode==='source')return beginSection(rel);
 if(!distributionStatements){
  const text=fs.readFileSync(path.join(root,'dist/ZenzaWatch-dev.user.js'),'utf8');distributionStatements=new Map();
  const add=(name,node,value)=>{if(!distributionStatements.has(name))distributionStatements.set(name,[]);distributionStatements.get(name).push({start:node.start,code:value||text.slice(node.start,node.end)})};
  require('@babel/traverse').default(require('@babel/parser').parse(text,{sourceType:'unambiguous',plugins:['classProperties']}),{noScope:true,
   ClassDeclaration(p){if(p.node.id)add(p.node.id.name,p.node)},
   FunctionDeclaration(p){if(p.node.id)add(p.node.id.name,p.node)},
   VariableDeclarator(p){if(p.node.id.type==='Identifier'&&p.node.init)add(p.node.id.name,p.node,'const '+p.node.id.name+'='+text.slice(p.node.init.start,p.node.init.end)+';')},
   ExpressionStatement(p){const func=p.getFunctionParent();if(func&&!(func.parentPath.isVariableDeclarator()&&func.parentPath.node.id.name==='monkey'))return;const e=p.node.expression;if(e.type!=='AssignmentExpression')return;let left=e.left;while(left.type==='MemberExpression')left=left.object;if(left.type==='Identifier')add(left.name,p.node)}
  });
 }
 return names.flatMap(n=>{const parts=distributionStatements.get(n);if(!parts?.length)throw Error('Missing distribution renderer '+n);return parts}).sort((a,b)=>a.start-b.start).map(p=>p.code).join('\n');
}
const bootstrap=`
window.__network=[];window.__errors=[];window.__consoleErrors=[];
const originalConsoleError=console.error;console.error=(...args)=>{window.__consoleErrors.push(args.map(String).join(' '));originalConsoleError(...args)};
addEventListener('error',e=>window.__errors.push(e.message));
addEventListener('unhandledrejection',e=>window.__errors.push(String(e.reason)));
window.fetch=(url)=>{window.__network.push(String(url));throw Error('Offline fixture forbids fetch');};
const ZenzaWatch={};
const util={escapeHtml:s=>String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))};
const textUtil={escapeRegs:s=>s.replace(/[.*+?^$(){}|[\\]\\\\]/g,'\\\\$&')};
`;
const lodash=fs.readFileSync(path.join(root,'node_modules/lodash/lodash.js'),'utf8');
const ordered=['Emitter','NgCompositeRules','NgCompositeRuleEditor','UiVisibilityRegistry','ModernAdvancedSettingsModel','ModernAdvancedSettingsUI','NicoChat','NicoChatFilter','NicoChatGroup','NicoComment'];
const sharedCode=[
 `const Config={props:{baseChatScale:1,baseFontFamily:'sans-serif',baseFontBolder:false,cssFontWeight:400,'commentLayer.protectCA':false,'commentLayer.ownerCommentShadowColor':'#000000','commentLayer.easyCommentOpacity':0.6,'commentLayer.aiCommentOpacity':0.4},getValue(){return false},onkey(){}};`,
 `var global={emitter:new Emitter(),debug:{}};const sleep={idle:()=>Promise.resolve()};`,
 rendererCode(layer+'NicoTextParser.js',['NicoTextParserInitFunc'])+(mode==='dist'?'\nconst NicoTextParser=NicoTextParserInitFunc();':''),rendererCode(layer+'CommentArtProtection.js',['CommentArtProtection']),rendererCode(layer+'OffscreenLayer.js',['OffscreenLayer']),
 rendererCode(layer+'NicoChatViewModel.js',['NicoChatViewModel','FlashNicoChatViewModel','HTML5NicoChatViewModel']),rendererCode(layer+'NicoChatCss3View.js',['NicoChatCss3View']),rendererCode(layer+'NicoCommentCss3PlayerView.js',['NicoCommentCss3PlayerView'])].join('\n');
function browserSuite(){
 const result={checks:[],geometry:[],limitations:['Offline extracted-class fixture, no signed-in nicovideo or extensions.','Group/model lifecycle and renderer DOM/CSS exercised; full player playback scheduling and slot worker are outside this fixture.','Settings config persistence uses an in-memory adapter.']};
 const check=(ok,label,detail)=>{result.checks.push({pass:!!ok,label,detail});if(!ok)throw Error(label+' '+JSON.stringify(detail));};
 const test=async(label,fn)=>{try{await fn()}catch(e){result.checks.push({pass:false,label,error:e.stack||String(e)})}};
 const copy=v=>JSON.parse(JSON.stringify(v));
 let id=0;
 const node=(field,value,cmp='contains')=>({id:'n'+(++id),field,value,cmp,not:false});
 const rule=(action='hide',extra={})=>({...NgCompositeRuleEditor.newRule(),id:'r'+(++id),enabled:true,name:'Browser acceptance',stopOnMatch:false,conditions:{id:'g'+(++id),kind:'group',mode:'all',nodes:[node('text','BAN')]},action,pattern:'BAN',replacement:'SAFE',...extra});
 function boot(){
  const panel=document.createElement('section');panel.className='zenzaAdvancedSettingPanel show';
  panel.innerHTML='<div class="settingPanelInner"><div id="legacy"></div></div>';document.body.append(panel);
  const defaults={'ngComposite.rules':[],enableFilter:true,wordFilter:'',wordRegFilter:'',wordRegFilterFlags:'i',userIdFilter:'',commandFilter:'',sharedNgLevel:'NONE','filter.fork0':true,backComment:true,'supporterCredit.enable':false,...UiVisibilityRegistry.defaults()};
  const config={default:defaults,values:copy(defaults),writes:[],listeners:new Map(),getValue(k){return this.values[k]},setValue(k,v){this.values[k]=copy(v);this.writes.push([k,copy(v)]);this.listeners.get(k)?.forEach(fn=>fn(v))},onkey(k,fn){if(!this.listeners.has(k))this.listeners.set(k,new Set());this.listeners.get(k).add(fn)},offkey(k,fn){this.listeners.get(k)?.delete(fn)},options:{validateImport(k,v){return k==='ngComposite.rules'?NgCompositeRules.validate(v):typeof v===typeof defaults[k]}},exportJson(){return JSON.stringify(this.values)},import(data){for(const [k,v]of Object.entries(data))if(k in defaults&&this.options.validateImport(k,v))this.setValue(k,v)}};
  const legacy=panel.querySelector('#legacy');
  const model=new ModernAdvancedSettingsModel({config,legacyRoot:legacy,actions:[],screenFilterParams:[],historySchema:[]});
  let reloads=0;
  const ui=new ModernAdvancedSettingsUI({panel,legacyRoot:legacy,model,storage:{getItem(){return null},setItem(){}},onClose(){},confirm(){return true},formatKeyCombo:String,encodeKeyCombo:()=>0,reload(){reloads++}});
  const q=s=>panel.querySelector(s), click=s=>{const el=q(s);check(!!el,'UI control exists '+s);el.click()};
  const open=()=>{click('[data-zw-major="NG・表示対象"]');click('[data-zw-sub="NG・表示対象|複合NGルール（上級者向け）"]');return q('.zw-composite-ng-host').shadowRoot};
  return {panel,config,model,ui,q,click,open,reloads:()=>reloads,destroy(){ui.dispose();panel.remove()}};
 }
 window.__nativeBoot=boot;
 const edit=(root,selector,value)=>{const el=root.querySelector(selector);check(!!el,'Editor control exists '+selector);if(el.type==='checkbox')el.checked=!!value;else el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
 const click=(root,selector)=>{const el=root.querySelector(selector);check(!!el,'Editor action exists '+selector);el.click()};
 const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 return (async()=>{
  await test('B2 create, AND/OR/NOT, actions, duplicate, reorder, delete, save/cancel',async()=>{
   const h=boot();window.__ui=h;let s=h.open();
   check(s.querySelector('.ng-help').open===false,'Help starts collapsed');
   click(s,'[data-ng-act="add"]');check(h.q('[data-zw-save]').disabled,'Incomplete draft blocks save');
   edit(s,'[data-rule="name"]','Browser replacement');edit(s,'[data-node-value]','BAN');edit(s,'[data-rule="enabled"]',true);edit(s,'[data-rule="phase"]','before');
   click(s,'[data-ng-act="add-node"]');
   const nodes=s.querySelectorAll('[data-node-value]');edit(s,'[data-node-value="'+nodes[1].dataset.nodeValue+'"]','safe');
   const not=s.querySelectorAll('[data-node-not]');edit(s,'[data-node-not="'+not[1].dataset.nodeNot+'"]',true);
   edit(s,'[data-group-mode]','any');edit(s,'[data-rule="action"]','replace');edit(s,'[data-rule="pattern"]','BAN');edit(s,'[data-rule="replacement"]','SAFE');
   const original=h.model.get('ngComposite.rules')[0].id;click(s,'[data-ng-act="duplicate"]');
   const drafts=h.model.get('ngComposite.rules');check(drafts.length===2&&drafts[0].id!==drafts[1].id,'Duplicate has unique rule ID');
   const duplicate=drafts[1].id;click(s,'[data-ng-act="up"][data-id="'+duplicate+'"]');check(h.model.get('ngComposite.rules')[0].id===duplicate,'Up reorders rules');
   click(s,'[data-ng-act="down"][data-id="'+duplicate+'"]');check(h.model.get('ngComposite.rules')[0].id===original,'Down reorders rules');
   click(s,'[data-ng-act="delete"]');check(h.model.get('ngComposite.rules').length===1,'Delete removes selected rule');
   check(h.config.writes.length===0,'Editor changes remain draft only');check(!h.q('[data-zw-save]').disabled,'Valid draft enables global save');
   h.click('[data-zw-save]');check(h.config.values['ngComposite.rules'].length===1,'Global save commits rule');check(h.config.values.backComment===true&&h.config.values['supporterCredit.enable']===false,'Global save preserves unrelated settings');
   s=h.q('.zw-composite-ng-host').shadowRoot;edit(s,'[data-rule="name"]','Cancelled change');h.click('[data-zw-cancel]');check(h.model.get('ngComposite.rules')[0].name==='Browser replacement','Cancel restores saved name');
   await frame();const host=h.q('.zw-composite-ng-host'),box=host.getBoundingClientRect();check(box.width>100&&box.height>100,'B2 host has real browser geometry',{width:box.width,height:box.height});
   result.geometry.push({stage:'B2',width:box.width,height:box.height});h.destroy();
  });
  await test('B2 invalid regex, color and strip command block save',async()=>{
   const h=boot();const s=h.open();click(s,'[data-ng-act="add"]');edit(s,'[data-node-value]','BAN');edit(s,'[data-rule="enabled"]',true);
   edit(s,'[data-node-field]','regex');edit(s,'[data-node-value]','(');check(h.q('[data-zw-save]').disabled,'Invalid regex blocks global save');
   edit(s,'[data-node-value]','BAN');edit(s,'[data-rule="action"]','normalize');
   const color=s.querySelector('[data-rule="normalizeColor"]');const opt=document.createElement('option');opt.value='invalid-color';opt.textContent='Invalid test color';color.append(opt);edit(s,'[data-rule="normalizeColor"]','invalid-color');check(h.q('[data-zw-save]').disabled,'Invalid color blocks save');
   edit(s,'[data-rule="normalizeColor"]','white');edit(s,'[data-rule="action"]','strip');edit(s,'[data-rule="strip"]','ue');check(h.q('[data-zw-save]').disabled,'Position strip blocks save');edit(s,'[data-rule="strip"]','red, big');check(!h.q('[data-zw-save]').disabled,'Supported strip repairs draft');check(h.config.writes.length===0,'Invalid drafts never wrote settings');h.destroy();
  });
  await test('Settings backup UI export/import roundtrip',async()=>{
   const h=boot();h.model.set('ngComposite.rules',[rule('hide')]);h.ui._refreshFooter();h.click('[data-zw-save]');
   h.click('[data-zw-major="プレイリスト・検索"]');h.click('[data-zw-sub="プレイリスト・検索|データ管理"]');h.click('[data-zw-backup-export]');
   const box=h.q('[data-zw-backup-json]'),data=JSON.parse(box.value);check(data['ngComposite.rules'].length===1,'Export JSON contains saved composite rule');
   data['ngComposite.rules'][0].name='Imported browser rule';box.value=JSON.stringify(data);h.click('[data-zw-backup-import]');check(h.config.values['ngComposite.rules'][0].name==='Imported browser rule','Import UI forwards validated rule');check(h.reloads()===1,'Import requests reload');h.destroy();
  });
  const offScreen=await OffscreenLayer(Config).get();
  const style=document.createElement('style');style.textContent=NicoTextParser.__css__;document.head.append(style);
  const tpl=document.createElement('template');tpl.innerHTML=NicoCommentCss3PlayerView.__TPL__.replace('%LAYOUT_CSS%','').replace('%OPTION_CSS%','');
  for(const st of tpl.content.querySelectorAll('style'))document.head.append(st.cloneNode(true));
  const screen=document.createElement('div');screen.className='commentLayer';screen.id='acceptance-render';screen.style.cssText='position:relative;top:0;left:0;margin:0;transform:none;width:740px;height:384px;background:#182335;overflow:hidden;';document.body.append(screen);
  function runtime(rules){
   const filter=new NicoChatFilter({compositeRules:rules,sharedNgLevel:'NONE'}),groups=['ue','naka','shita'].map(t=>new NicoChatGroup(t,{nicoChatFilter:filter}));
   const model=Object.create(NicoComment.prototype);Object.assign(model,{topGroup:groups[0],nakaGroup:groups[1],bottomGroup:groups[2],_nicoChatFilter:filter,_wordReplacer:null,nicoScripter:{isEmpty:true,reset(){}},emit(){}});
   return {filter,groups,model,all:()=>groups.flatMap(g=>g.nonFilteredMembers)};
  }
  const data=(no,text,user,cmd='',nicoru=0)=>({no,text,user_id:user,cmd,vpos:1000,date:100+no,thread:1,fork:0,nicoru,threadLabel:'default'});
  async function render(r,stage,atEnd=false){
   screen.replaceChildren();const dom=[];
   for(const group of r.groups)for(const [index,chat] of group.members.entries()){
    const vm=NicoChatViewModel.create(chat,offScreen);vm.ypos=(chat.type==='shita'?300:chat.type==='ue'?10:140)+index*40;vm.slot=index;
    const el=NicoChatCss3View.buildChatDom(vm,chat.type,chat.size,NicoChatCss3View.buildChatCss(vm,chat.type,11,1),document);dom.push(el);
   }
   // Use the production renderer method that inserts DOM and clears hidden/content-visibility.
   const player=Object.create(NicoCommentCss3PlayerView.prototype);Object.assign(player,{commentLayer:screen,subLayer:screen,fragment:document.createDocumentFragment(),subFragment:document.createDocumentFragment(),removingElements:[]});player.fragment.append(...dom);player._updateDom();
   await frame();for(const el of dom)for(const animation of el.getAnimations()){animation.pause();animation.currentTime=atEnd?animation.effect.getComputedTiming().endTime+100:0;}
   await frame();
   const geometry=dom.map(el=>{const b=el.getBoundingClientRect(),st=getComputedStyle(el);return {id:el.id,text:el.textContent,width:b.width,height:b.height,x:b.x,y:b.y,visibility:st.visibility,display:st.display,opacity:st.opacity,inlineOpacity:el.style.opacity,chatOpacityVariable:el.style.getPropertyValue('--chat-opacity'),animationName:st.animationName,animationPlayState:st.animationPlayState,actualAnimationStates:el.getAnimations().map(a=>({playState:a.playState,currentTime:a.currentTime})),inlineStyle:el.style.cssText,contentVisibility:st.contentVisibility,color:st.color,type:['ue','naka','shita'].find(c=>el.classList.contains(c))}});
   result.geometry.push({stage,comments:geometry});
   for(const g of geometry)check(atEnd?g.visibility==='hidden':g.width>0&&g.height>0&&g.visibility==='visible'&&g.display!=='none'&&Number(g.opacity)>0&&g.x>=0&&g.y>=0&&g.x+g.width<=innerWidth&&g.y+g.height<=innerHeight,(atEnd?'Ended comment remains hidden ':'Rendered comment has visible geometry ')+stage+' '+g.text,g);
   return geometry;
  }
  await test('Real NicoChat before-phase replacement, rendering and disabling restore',async()=>{
   const rr=rule('replace',{phase:'before'}),r=runtime([rr]);r.filter.wordFilterList=['BAN'];await r.model.setChats([data(1,'BAN rendered','A','red big ue'),data(2,'middle normal','B'),data(3,'bottom normal','C','shita')],{duration:100,watchId:'sm9'});
   let g=await render(r,'before-replacement');check(g.some(x=>x.text.includes('SAFE rendered')),'Before replacement survives legacy BAN filter');check(r.all()[0].text==='SAFE rendered','Real NicoChat projected text applied');
   r.filter.wordFilterList=[];r.filter.compositeRules=[];g=await render(r,'replacement-restored');check(g.some(x=>x.text.includes('BAN rendered')),'Disabling replacement restores original rendered text');check(r.all()[0].cmd==='red big ue','Original command preserved');
  });
  await test('Actual NicoChat dim remains stable after same-object remove and reinsert',async()=>{
   const r=runtime([rule('dim',{dim:50})]);await r.model.setChats([data(20,'BAN dim lifecycle','D','ue')],{duration:100,watchId:'sm9'});const chat=r.all()[0];
   let g=await render(r,'dim-first-add');check(chat.opacity===0.5&&Number(g[0].inlineOpacity)===0.5,'First dim model and inline CSS are 50 percent',{model:chat.opacity,inline:g[0].inlineOpacity,computed:g[0].opacity});
   r.groups[0].removeChat(chat);g=await render(r,'dim-removed');check(g.length===0,'Dim comment DOM removed');
   r.groups[0].addChat(chat);g=await render(r,'dim-same-object-reinserted');check(chat.opacity===0.5&&Number(g[0].inlineOpacity)===0.5,'Same-object reinsert does not accumulate dim',{model:chat.opacity,inline:g[0].inlineOpacity,computed:g[0].opacity});
  });
  for(const ver of ['flash','html5'])for(const [index,type]of ['ue','naka','shita'].entries())await test('Actual '+ver+' '+type+' animation honors rendered dim opacity',async()=>{
   const r=runtime([rule('dim',{dim:50})]);await r.model.setChats([data(21+index,'BAN dim visible '+type,'D',type+(ver==='html5'?' mincho':''))],{duration:100,watchId:'sm9'});const g=await render(r,'dim-visible-opacity-'+ver+'-'+type);check(Number(g[0].opacity)===0.5,ver+' '+type+' computed opacity honors dim',g[0]);
  });
  for(const [fork,multiplier]of [[2,0.6],[3,0.4]])for(const type of ['ue','naka','shita'])await test('Actual fork'+fork+' '+type+' dim respects configured opacity multiplier',async()=>{
   const r=runtime([rule('dim',{dim:50,scope:'any'})]);await r.model.setChats([{...data(30+fork,'BAN dim fork'+fork+' '+type,'D',type+' mincho'),fork}],{duration:100,watchId:'sm9'});const g=await render(r,'dim-fork'+fork+'-'+type);check(g.length===1,'Fork'+fork+' '+type+' real model remains renderable');check(Math.abs(Number(g[0].opacity)-0.5*multiplier)<1e-6,'Fork'+fork+' '+type+' rendered opacity multiplies dim by setting',{expected:0.5*multiplier,...g[0]});
  });
  for(const ver of ['flash','html5'])for(const fork of [0,2,3])for(const type of ['ue','shita'])await test(ver+' fork'+fork+' '+type+' animation end remains hidden',async()=>{
   const r=runtime([rule('dim',{dim:50,scope:'any'})]);await r.model.setChats([{...data(50+fork,'BAN ending '+type,'D',type+(ver==='html5'?' mincho':'')),fork}],{duration:100,watchId:'sm9'});const g=await render(r,'animation-end-'+ver+'-fork'+fork+'-'+type,true);check(g.length===1&&g[0].visibility==='hidden','Animation ending hides DOM despite opacity multiplier',g[0]);
  });
  for(const [fork,multiplier]of [[0,1],[2,0.6],[3,0.4]])for(const type of ['ue','naka','shita'])await test('Default opacity fork'+fork+' '+type+' preserves existing appearance',async()=>{
   const r=runtime([]);await r.model.setChats([{...data(60+fork,'default '+type,'D',type+' mincho'),fork}],{duration:100,watchId:'sm9'});const g=await render(r,'default-opacity-fork'+fork+'-'+type);check(Math.abs(Number(g[0].opacity)-multiplier)<1e-6,'Default opacity keeps existing setting multiplier',g[0]);check(g[0].inlineOpacity===''&&g[0].chatOpacityVariable==='','Default opacity adds no inline opacity or custom variable',g[0]);
  });
  await test('hideAuthor crosses top/middle/bottom; append/remove/edit/nicoru/settings restoration',async()=>{
   const rr=rule('hideAuthor',{exemptNicoru:true,nicoruMin:1,keepProtectedOnAuthorHide:true}),r=runtime([rr]);
   await r.model.setChats([data(10,'top sibling','A','ue'),data(11,'middle sibling','A'),data(12,'bottom protected','A','shita',1),data(13,'unrelated','B','shita')],{duration:100,watchId:'sm9'});
   let g=await render(r,'author-before-trigger');check(g.length===4,'All initial comments render');
   const trigger=NicoChat.create(data(14,'BAN trigger','A','ue'),{videoDuration:100});r.groups[0].addChat(trigger);
   g=await render(r,'author-trigger-appended');check(g.length===2&&g.some(x=>x.text.includes('bottom protected'))&&g.some(x=>x.text.includes('unrelated')),'Append trigger hides siblings in all groups but protects nicoru');
   r.groups[0].removeChat(trigger);g=await render(r,'author-trigger-removed');check(g.length===4,'Removing hidden trigger restores top/middle/bottom siblings');
   r.groups[0].addChat(trigger);trigger.text='safe edited';trigger.onChange();g=await render(r,'author-trigger-edited');check(g.length===5,'Editing hidden trigger restores siblings and trigger');
   trigger.text='BAN trigger';trigger.onChange();trigger.nicoru=1;g=await render(r,'author-trigger-nicoru-protected');check(g.length===5,'Nicoru change unblocks trigger and siblings');
   trigger.nicoru=0;r.filter.compositeRules=[{...rr,keepProtectedOnAuthorHide:false}];g=await render(r,'author-protection-disabled');check(g.length===1&&g[0].text==='unrelated','Disabling sibling protection hides protected author sibling');
   r.filter.isEnable=false;g=await render(r,'author-filter-disabled');check(g.length===5,'Disabling filter restores every remaining comment');
  });
  check(window.__network.length===0,'No application network requests',window.__network);
  result.browser=navigator.userAgent;result.errors=window.__errors;result.network=window.__network;
  check(result.errors.length===0,'No unhandled page errors',result.errors);
  result.passed=result.checks.filter(x=>x.pass).length;result.failed=result.checks.filter(x=>!x.pass).length;
  window.__result=result;document.title='Task403 acceptance '+result.failed+' failures';return result;
 })();
}
const script=[bootstrap,lodash,beginSection(layer+'CommentLayer.js'),...ordered.map(n=>mode==='dist'?distCode(n):code(n)),sharedCode,`window.__run=${browserSuite.toString()};`].join('\n');
const html='<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; frame-src about:; connect-src \'none\'"></head><body><script>'+script.replace(/<\/script/gi,'<\\/script')+'</script></body></html>';
fs.mkdirSync(logs,{recursive:true});fs.writeFileSync(prefix+'-fixture.html',html);
class Rpc{
 constructor(ws){this.ws=ws;this.serial=0;this.pending=new Map();this.events=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);if(p){clearTimeout(p.timer);this.pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}}else{this.events.push(m);this.onEvent?.(m)}})}
 static async open(url){const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});return new Rpc(ws)}
 call(method,params={}){const id=++this.serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('RPC timeout '+method))},60000);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params}))})}
 close(){this.ws.close()}
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const attempts=[],server=http.createServer((req,res)=>{if(req.url==='/fixture'){res.writeHead(200,{'Content-Type':'text/html; charset=UTF-8'});res.end(html)}else{attempts.push(req.url);res.writeHead(404);res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/fixture';
 const reports=[];
 for(const name of ['chrome','firefox']){
  const exe=name==='chrome'?path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'):'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
  if(!fs.existsSync(exe)){reports.push({name,unavailable:exe});continue}
  const profile=prefix+'-'+name+'-profile';fs.mkdirSync(profile,{recursive:true});
  if(name==='firefox')fs.writeFileSync(path.join(profile,'user.js'),'user_pref("app.update.enabled",false);user_pref("datareporting.healthreport.uploadEnabled",false);user_pref("toolkit.telemetry.enabled",false);user_pref("browser.shell.checkDefaultBrowser",false);user_pref("network.proxy.type",1);user_pref("network.proxy.http","127.0.0.1");user_pref("network.proxy.http_port",9);user_pref("network.proxy.ssl","127.0.0.1");user_pref("network.proxy.ssl_port",9);user_pref("network.proxy.no_proxies_on","127.0.0.1,localhost");');
  let rpc,proc;try{
   const port=await new Promise(resolve=>{const t=http.createServer();t.listen(0,'127.0.0.1',()=>{const p=t.address().port;t.close(()=>resolve(p))})});
   const args=name==='chrome'?['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-default-apps','--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost','--proxy-server=http://127.0.0.1:9','--proxy-bypass-list=127.0.0.1;localhost','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+profile,'--window-size=1365,1000','about:blank']:['--headless','--no-remote','--profile',profile,'--remote-debugging-port',String(port)];
   proc=spawn(exe,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});let stderr='';proc.stderr.on('data',b=>stderr+=b);proc.on('error',e=>stderr+=e.stack);
   let endpoint;for(let i=0;i<100&&!endpoint;i++){try{if(name==='chrome'){const list=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();endpoint=list.find(t=>t.type==='page')?.webSocketDebuggerUrl}else if(stderr.includes('WebDriver BiDi listening on'))endpoint=stderr.match(/WebDriver BiDi listening on (ws:\/\/[^\s]+)/)?.[1]+'/session'}catch{}await wait(100)}
   if(!endpoint)throw Error('No isolated debug endpoint '+stderr);
   rpc=await Rpc.open(endpoint);let report,context;const protocolNetwork=[];
   async function evaluate(expression){if(name==='chrome'){const v=await rpc.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(v.exceptionDetails)throw Error(JSON.stringify(v.exceptionDetails));return v.result.value}const v=await rpc.call('script.evaluate',{expression:'(async()=>JSON.stringify(await ('+expression+')))()',target:{context},awaitPromise:true,resultOwnership:'none'});if(v.type==='exception')throw Error(JSON.stringify(v));return JSON.parse(v.result.value)}
   async function nativeClick(selector,shadow=false){const point=await evaluate(`(async()=>{const el=${shadow?'window.__nativeShadow':'window.__nativeUi.panel'}.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Native target missing');el.scrollIntoView({block:'center'});await new Promise(r=>requestAnimationFrame(r));const b=el.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`);if(name==='chrome'){await rpc.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await rpc.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point})}else await rpc.call('input.performActions',{context,actions:[{type:'pointer',id:'acceptance-mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',x:Math.round(point.x),y:Math.round(point.y),origin:'viewport'},{type:'pointerDown',button:0},{type:'pointerUp',button:0}]}]})}
   if(name==='chrome'){
    const network=protocolNetwork;rpc.onEvent=m=>{if(m.method==='Fetch.requestPaused'){const u=m.params.request.url;if(!u.startsWith('http://127.0.0.1:')&&!u.startsWith('about:')&&!u.startsWith('data:')){network.push(u);rpc.call('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{})}else rpc.call('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>{})}};
    await rpc.call('Fetch.enable',{patterns:[{urlPattern:'*'}]});await rpc.call('Runtime.enable');await rpc.call('Page.enable');console.log('navigation',await rpc.call('Page.navigate',{url}));
    let ready=false;for(let i=0;i<100&&!ready;i++){const v=await rpc.call('Runtime.evaluate',{expression:'typeof window.__run',returnByValue:true});ready=v.result?.value==='function';if(!ready)await wait(100)}
    if(!ready){const diagnostic=await rpc.call('Runtime.evaluate',{expression:'JSON.stringify({url:location.href,title:document.title,html:document.documentElement.outerHTML.slice(0,1500),errors:window.__errors,network:window.__network})',returnByValue:true});throw Error('Fixture bootstrap failed '+JSON.stringify({diagnostic,events:rpc.events.filter(x=>x.method==='Runtime.exceptionThrown')}))}
    const value=await rpc.call('Runtime.evaluate',{expression:'window.__run()',awaitPromise:true,returnByValue:true});if(value.exceptionDetails)throw Error(JSON.stringify(value.exceptionDetails));report=value.result.value;
    const screenshot=await rpc.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(prefix+'-'+name+'.png',Buffer.from(screenshot.data,'base64'));report.protocolNetwork=network;report.version=(await rpc.call('Browser.getVersion')).product;
   }else{
    await rpc.call('session.new',{capabilities:{alwaysMatch:{acceptInsecureCerts:false}}});rpc.onEvent=m=>{if(m.method==='network.beforeRequestSent'){const u=m.params.request.url;if(!u.startsWith('http://127.0.0.1:')&&!u.startsWith('about:')&&!u.startsWith('data:'))protocolNetwork.push(u)}};await rpc.call('session.subscribe',{events:['network.beforeRequestSent']});({context}=await rpc.call('browsingContext.create',{type:'tab'}));await rpc.call('browsingContext.navigate',{context,url,wait:'complete'});
    const v=await rpc.call('script.evaluate',{expression:'window.__run().then(r=>JSON.stringify(r))',target:{context},awaitPromise:true,resultOwnership:'none'});if(v.type==='exception')throw Error(JSON.stringify(v));report=JSON.parse(v.result.value);report.version=report.browser;
    try{const shot=await rpc.call('browsingContext.captureScreenshot',{context,origin:'viewport',format:{type:'image/png'}});fs.writeFileSync(prefix+'-'+name+'.png',Buffer.from(shot.data,'base64'))}catch(e){report.screenshotError=e.message}
   }
   await evaluate('(async()=>{window.__nativeUi=window.__nativeBoot();window.__nativeShadow=window.__nativeUi.open();return true})()');
   await nativeClick('[data-ng-act="add"]',true);await nativeClick('[data-node-value]',true);
   if(name==='chrome')await rpc.call('Input.insertText',{text:'Native BAN'});else await rpc.call('input.performActions',{context,actions:[{type:'key',id:'acceptance-keyboard',actions:[...'Native BAN'].flatMap(value=>[{type:'keyDown',value},{type:'keyUp',value}])}]});
   await nativeClick('[data-zw-save]');const nativeResult=await evaluate('(async()=>{const rules=window.__nativeUi.config.values["ngComposite.rules"];return {count:rules.length,text:rules[0]?.conditions.nodes[0].value,writes:window.__nativeUi.config.writes.length}})()');
   const nativePass=nativeResult.count===1&&nativeResult.text==='Native BAN'&&nativeResult.writes===1;report.checks.push({pass:nativePass,label:'Native mouse and keyboard add/type/global save',detail:nativeResult});nativePass?report.passed++:report.failed++;
   const uiShot=name==='chrome'?await rpc.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}):await rpc.call('browsingContext.captureScreenshot',{context,origin:'viewport',format:{type:'image/png'}});fs.writeFileSync(prefix+'-'+name+'-b2.png',Buffer.from(uiShot.data,'base64'));
   report.protocolNetwork=protocolNetwork;const post=await evaluate('(async()=>({errors:window.__errors,consoleErrors:window.__consoleErrors,network:window.__network}))()');report.errors=post.errors;report.consoleErrors=post.consoleErrors;report.network=post.network;const offlinePass=!protocolNetwork.length&&!post.errors.length&&!post.consoleErrors.length&&!post.network.length;report.checks.push({pass:offlinePass,label:'Native interactions complete without page errors or unexpected network',detail:post});offlinePass?report.passed++:report.failed++;
   report.name=name;reports.push(report);fs.writeFileSync(prefix+'-'+name+'.json',JSON.stringify(report,null,2));
  }catch(e){reports.push({name,error:e.stack||String(e)});console.error(name,e.stack)}finally{rpc?.close();if(proc&&!proc.killed)proc.kill();}
 }
 server.close();const hash=s=>require('crypto').createHash('sha256').update(s).digest('hex');const summary={mode,timestamp:stamp,fixture:prefix+'-fixture.html',fixtureSha256:hash(html),harnessSha256:hash(fs.readFileSync(__filename)),distributionHashes:Object.fromEntries(['ZenzaWatch-dev.user.js','ZenzaAdvancedSettings.user.js'].map(f=>[f,hash(fs.readFileSync(path.join(root,'dist',f)))])),distributionSha256:mode==='dist'?hash(fs.readFileSync(path.join(root,'dist/ZenzaWatch-dev.user.js'))):null,reports,unexpectedLocalRequests:attempts};fs.writeFileSync(prefix+'-summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify({mode,summary:prefix+'-summary.json',reports:reports.map(r=>({name:r.name,version:r.version,passed:r.passed,failed:r.failed,error:r.error,fails:r.checks?.filter(x=>!x.pass)}))},null,2));process.exitCode=reports.some(r=>r.error||r.failed||r.unavailable)?1:0;
}
main().catch(e=>{console.error(e.stack);process.exitCode=1});
