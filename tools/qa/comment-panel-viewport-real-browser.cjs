'use strict';
// Native component CSS/markup; isolated, network-free layout regression only.
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const {spawnSync,execFileSync}=require('child_process');
const {pathToFileURL}=require('url');
const X=require('../../test/helpers/nativeCssFixture.cjs');
const root=path.resolve(__dirname,'../..');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const ref=arg('--ref'),label=arg('--label')||ref||'candidate',dist=process.argv.includes('--dist');
if(ref&&!/^[a-zA-Z0-9_./-]+$/.test(ref))throw Error('Invalid Git ref');
const read=p=>ref?execFileSync('git',['show',ref+':'+p],{cwd:root,encoding:'utf8',maxBuffer:16e6}):fs.readFileSync(path.join(root,p),'utf8');
const bundle=dist?read('dist/ZenzaWatch-dev.user.js'):null;
const source=p=>bundle||read('src/'+p+'.js');
const constant=source('constant'),info=source('VideoInfoPanel'),dialog=source('NicoVideoPlayerDialog');
const input=source('CommentInputPanel'),bar=source('VideoControlBar'),comments=source('CommentPanel');
const CONSTANT=dist?X.bindingValue(bundle,'CommentInputPanel','CONSTANT'):X.variableValue(constant,'CONSTANT');
CONSTANT.BASE_CSS_VARS=X.staticValue(constant,'CONSTANT.BASE_CSS_VARS');
CONSTANT.SCROLLBAR_CSS=X.staticValue(constant,'CONSTANT.SCROLLBAR_CSS',{CONSTANT});
const scope={CONSTANT,VideoControlBar:{BASE_HEIGHT:CONSTANT.CONTROL_BAR_HEIGHT},ZenzaWatch:{env:'QA',version:label,build:'offline'},util:{toRgba:()=> 'rgba(255,255,204,0.3)'}};
scope.CommandPicker=dist?X.bindingValue(bundle,'CommentInputPanel','CommandPicker'):X.variableValue(input,'CommandPicker');
scope.ZenzaCommentHistoryCore={HISTORY_ICON:X.variableValue(read('packages/comment-history/src/generated/ZenzaCommentHistoryCore.generated.js'),'HISTORY_ICON')};
const templates={dialog:X.staticValue(dialog,'NicoVideoPlayerDialogView.__tpl__',scope),info:X.staticValue(info,'VideoInfoPanel.__tpl__',scope),header:X.staticValue(info,'VideoHeaderPanel.__tpl__',scope),input:X.staticValue(input,'CommentInputPanel.__tpl__',scope),bar:X.staticValue(bar,'VideoControlBar.__tpl__',scope),comments:X.staticValue(comments,'CommentPanelView.__tpl__',scope)};
const styles=[];
function add(src,name){styles.push({name,css:X.labeledStyle(src,name,scope)});}
function base(src,key){styles.push({name:'native-base '+key,css:X.staticValue(src,key,scope)});}
base(constant,'CONSTANT.COMMON_CSS');
for(const name of ['videoControlBar','screenMode for-popup videoControlBar','screenMode for-full videoControlBar','screenMode for-screen-full videoControlBar'])add(bar,name);
for(const name of ['screenMode for-full','screenMode for-popup','screenMode for-dialog','zenza-open'])add(dialog,name);
for(const name of ['videoInfoPanel','screenMode for-full videoInfoPanel','screenMode for-popup videoInfoPanel','screenMode for-dialog videoInfoPanel','screenMode for-popup videoHeaderPanel','screenMode for-dialog videoHeaderPanel','screenMode for-full videoHeaderPanel'])add(info,name);
base(dialog,'NicoVideoPlayerDialogView.__css__');base(input,'CommentInputPanel.__css__');base(info,'VideoHeaderPanel.__css__');base(comments,'CommentPanelView.__css__');
const native={headerClass:X.classText(info,'VideoHeaderPanel'),modeMethod:X.methodText(dialog,'NicoVideoPlayerDialogView','_updateScreenModeStyle'),selectTab:X.methodText(info,'VideoInfoPanel','selectTab')};
const cases=[];
for(const mode of ['normal','big'])for(const [w,h]of [[1213,640],[1215.5,699],[1215,699.5],[991.5,699],[991,699.5],[639.5,500],[1215,699],[1216,699],[1215,700],[992,640],[991,699],[991,700],[800,600],[640,500],[639,500],[480,640],[1280,800],[1920,1080]])for(const header of ['auto','outside'])cases.push({mode,w,h,header});
for(const mode of ['wide','fullscreen','small','sideView'])cases.push({mode,w:1213,h:640,header:'auto',compatOnly:true});
const selected=arg('--only');const effective=selected?cases.filter(c=>c.mode===selected):cases;
const payload={templates,styles,native,cases:effective,label};
const digest=v=>crypto.createHash('sha256').update(v).digest('hex');
const metadata={label,ref,dist,sourceHashes:Object.fromEntries(['VideoInfoPanel','NicoVideoPlayerDialog','CommentInputPanel','VideoControlBar'].map(p=>[p,digest(source(p))])),styles:styles.map(s=>({name:s.name,bytes:s.css.length,sha256:digest(s.css)}))};
const browserCode=fs.readFileSync(path.join(__dirname,'comment-panel-viewport-browser.js'),'utf8');
const html='<!doctype html><meta charset="utf-8"><title>Zenza offline native layout QA</title><style>body{margin:0;background:#181818}iframe{position:absolute;left:0;top:0;border:0}#qa-result{display:none}</style><pre id="qa-result">RUNNING</pre><script>window.QA='+JSON.stringify(payload).replace(/</g,'\\u003c')+';</script><script>'+browserCode.replace(/<\/script/gi,'<\\/script')+'</script>';
const temp=path.join(os.tmpdir(),'zw-panel-native-qa',label.replace(/[^a-zA-Z0-9_-]/g,'_')+(dist?'-dist':''));fs.mkdirSync(temp,{recursive:true});
const fixture=path.join(temp,'fixture.html');fs.writeFileSync(fixture,html);
const browser=process.env.ZENZA_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
if(!fs.existsSync(browser))throw Error('Set ZENZA_BROWSER to an isolated-test Chromium executable');
const args=['--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--disable-gpu','--host-resolver-rules=MAP * ~NOTFOUND','--virtual-time-budget=30000','--user-data-dir='+path.join(temp,'profile'),'--window-size=1600,1050','--dump-dom',pathToFileURL(fixture).href];
const run=spawnSync(browser,args,{encoding:'utf8',timeout:90000,maxBuffer:40e6});
const match=/<pre id="qa-result">([^<]*)<\/pre>/.exec(run.stdout||'');
if(!match||match[1]==='RUNNING'){console.error('NO_RESULT',run.status,run.error?.message,(run.stderr||'').slice(-500));process.exit(2);}
const report=JSON.parse(decodeURIComponent(match[1].replace(/&amp;/g,'&')));
if(report.error){console.error('BROWSER_ERROR',report.error);process.exit(2);}
const failed=report.results.filter(r=>!r.pass);Object.assign(report,{metadata,failed:failed.length});
fs.writeFileSync(path.join(temp,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log('NATIVE_LAYOUT '+label+' '+(dist?'dist':'source')+' cases='+report.results.length+' failed='+failed.length);
for(const r of failed.slice(0,18))console.log('FAIL '+JSON.stringify(r));
for(const r of report.results.filter(r=>r.w===1213&&r.mode==='big'))console.log('TARGET '+JSON.stringify(r));
console.log('REPORT '+path.join(temp,'report.json'));
process.exit(failed.length?1:0);
