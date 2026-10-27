"""Task924: isolated Chromium mock-player fixture; no logged-in browser or NicoNico requests.
Run with Python Playwright installed (or TASK924_PLAYWRIGHT_PATH set). Screenshots are
actual product dock/toolbar rendered around a mock video, not a full-player acceptance run.
"""
from pathlib import Path
import functools, http.server, json, os, subprocess, sys, threading
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, os.environ.get('TASK924_PLAYWRIGHT_PATH', str(Path.home()/'AppData/Local/Temp/task924-playwright')))
from playwright.sync_api import sync_playwright
OUT = ROOT/'handoff/Notification_QA_20261023'
OUT.mkdir(parents=True, exist_ok=True)
extract = r'''
const {extract,beginSection}=require('./test/helpers/extractSource');
const fs=require('fs'),vm=require('vm');const s=fs.readFileSync('src/VideoControlBar.js','utf8');
const start=s.indexOf('util.addStyle(`'),end=s.indexOf('  `).trim();',s.indexOf('VideoControlBar.__tpl__ ='))+12;
const styles=[]; const context={VideoControlBar:{BASE_HEIGHT:40},ZenzaWatch:{env:'QA',version:'fixture'},ZenzaCommentHistoryCore:{HISTORY_ICON:'H'},util:{toRgba:(hex,a)=>'rgba('+hex.slice(1).match(/../g).map(v=>parseInt(v,16)).join(',')+','+a+')',addStyle:(css,options)=>styles.push({css,options})}};
vm.runInNewContext(s.slice(start,end),context);
process.stdout.write(JSON.stringify({styles,template:context.VideoControlBar.__tpl__,journal:beginSection('src/NotificationJournal.js'),panel:beginSection('src/NotificationHistoryPanel.js'),bar:extract('src/VideoControlBar.js','VideoControlBar'),dialog:extract('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialog')}));
'''
data=json.loads(subprocess.check_output(['node','-e',extract],cwd=ROOT,text=True,encoding='utf-8'))
css=''.join('<style data-mode="'+x['options'].get('className','')+'">'+x['css']+'</style>' for x in data['styles'])
script='class Emitter {}\n'+data['journal']+'\n'+data['panel']+'\n'+data['bar']+'\n'+data['dialog']+r'''
const container=document.querySelector('.zenzaPlayerContainer');
const button=container.querySelector('.notificationHistorySwitch');
const dialog=Object.assign(Object.create(NicoVideoPlayerDialog.prototype),{_state:{isOpen:true},_$playerContainer:[container]});
const bar=Object.create(VideoControlBar.prototype);
const util={dispatchCommand:(_target,command,param)=>dialog._onCommand(command,param)};
document.querySelector('.videoControlBar').addEventListener('click',e=>bar._onClick(e));
for(const type of ['keydown','keyup'])button.addEventListener(type,e=>{if(['Enter',' ','Spacebar'].includes(e.key))e.stopPropagation();});
window.qa={dialog,button,container,journal:NotificationJournal};
window.playerEscapes=0;document.addEventListener('keydown',e=>{if(e.key==='Escape')window.playerEscapes++;});
for(const entry of [
 {category:'like',level:'success',message:'いいね！ありがとうございます',videoId:'sm9'},
 {category:'comment',level:'success',message:'コメントを投稿しました',videoId:'sm9'},
 {category:'network',level:'error',message:'コメント取得に失敗しました',details:{statusCode:400,operation:'manualreload'}}
])NotificationJournal.record(entry);
'''
html='''<!doctype html><html lang="ja"><meta charset="utf-8"><title>Task924 mock-player fixture</title>'''+css+'''<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;font-family:Arial,"Meiryo",sans-serif;background:#181818;color:#eee}
.zenzaPlayerContainer{position:relative;width:100vw;height:100vh;box-sizing:border-box;background:linear-gradient(140deg,#172c34,#29252d)}
.fixture-label{position:absolute;top:12px;left:12px;font-size:12px;color:#ddd;max-width:90%;pointer-events:none}
.mock-video{position:absolute;left:50%;top:30%;transform:translateX(-50%);font-size:20px;color:#999;text-align:center}
</style><body><div class="zenzaPlayerContainer showVideoControlBar is-controlBarActive"><div class="fixture-label">MOCK PLAYER FIXTURE — actual notification dock + toolbar / synthetic records</div><div class="mock-video">Video placeholder</div>'''+data['template']+'</div><script>'+script+'''</script><script type="module">
import {html,render} from '/node_modules/lit-html/lit-html.js';
const host=document.querySelector('.addonMenuContainer');
render(html`<div class="command controlButton" data-command="toggleHLSDebug"><div class="controlButtonInner">hls</div></div>`,host);
window.hlsReady=true;
</script></html>'''
fixture=ROOT/'test/browser/task924-notification-dock.fixture.html'
fixture.write_text(html,encoding='utf-8')
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
report={'label':'Mock-player fixture with actual generated product JS, template/CSS, command owners and lit-html; not logged-in full player','viewports':[],'checks':[]}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE',r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'),headless=True,args=['--no-first-run','--disable-background-networking','--disable-extensions'])
  report['browser']=browser.version
  context=browser.new_context();context.route('**/*',lambda route:route.continue_() if route.request.url.startswith('http://127.0.0.1:') else route.abort())
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  for name,w,h in [('normal',1280,720),('small',480,300),('narrow',320,240),('fullscreen-layout',1920,1080)]:
   page.set_viewport_size({'width':w,'height':h});page.goto(f'http://127.0.0.1:{server.server_port}/test/browser/{fixture.name}')
   page.wait_for_function('window.hlsReady===true')
   page.evaluate('''mode=>{document.querySelectorAll('style[data-mode]').forEach(s=>{const c=s.dataset.mode;s.disabled=c.includes('screenMode')&&!(mode==='small'||mode==='narrow'?c.includes('for-popup'):mode==='fullscreen-layout'?c.includes('for-full')||c.includes('for-screen-full'):false);});}''',name)
   assert page.locator('.notificationHistorySwitch').count()==1
   assert page.locator('.addonMenuContainer [data-command="toggleHLSDebug"]').count()==1
   # Native keyboard activation reaches actual VideoControlBar._onClick and dialog._onCommand.
   page.locator('.notificationHistorySwitch').focus();page.keyboard.press('Enter')
   page.wait_for_selector('.zenzaNotificationDock:not([hidden])');page.wait_for_selector('.znh-entry')
   assert page.locator('.zenzaNotificationDock input').evaluate('(e)=>document.activeElement===e')
   box=page.locator('.zenzaNotificationDock').bounding_box();assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=w+1 and box['y']+box['height']<=h+1,box
   page.screenshot(path=str(OUT/f'task924-mock-{name}.png'))
   report['viewports'].append({'mode':name,'viewport':[w,h],'dock':box,'listVisibleHeight':page.locator('.znh-list').evaluate('(e)=>e.clientHeight'),'screenshot':str(OUT/f'task924-mock-{name}.png')})
   page.keyboard.press('Escape');assert page.locator('.notificationHistorySwitch').evaluate('(e)=>document.activeElement===e')
   assert page.evaluate('window.playerEscapes')==0
  page.locator('.notificationHistorySwitch').focus();page.keyboard.press('Space');page.wait_for_selector('.zenzaNotificationDock:not([hidden])')
  page.evaluate("qa.journal.record({category:'network',level:'error',message:'LIVE QA ERROR 503',details:{statusCode:503}})")
  page.wait_for_function("document.querySelector('.znh-list').textContent.includes('LIVE QA ERROR 503')")
  page.locator('.znh-entry details summary').first.click();assert page.locator('.znh-entry details[open]').count()==1
  page.locator('.znh-close').click();assert page.locator('.zenzaNotificationDock').is_hidden()
  page.evaluate("qa.button.hidden=true;qa.dialog._onCommand('toggle-notificationHistory')")
  page.wait_for_selector('.zenzaNotificationDock:not([hidden])');page.keyboard.press('Escape')
  assert page.evaluate('document.activeElement===qa.container')
  page.evaluate("qa.dialog._onCommand('toggle-notificationHistory');qa.dialog.hide()")
  assert page.locator('.zenzaNotificationDock').count()==0
  # Recreate module instance by page reload; session memory is gone, record must come from IndexedDB.
  page.reload();page.wait_for_function('window.hlsReady===true');page.evaluate("qa.dialog._onCommand('toggle-notificationHistory')")
  page.wait_for_function("document.querySelector('.znh-list').textContent.includes('LIVE QA ERROR 503')")
  report['indexedDB']=page.evaluate('indexedDB.databases()');assert report['indexedDB']
  report['checks']=['HLS lit render preserves adjacent notification button','native Enter and Space activation through product command methods','input focus and Escape consumption/focus restore','native detail expansion and close click','live real journal refresh','hidden-button command and focus fallback','player hide disposes dock','IndexedDB persistence survives module recreation']
  assert not errors,errors
  report['pageErrors']=errors;report['status']='passed' if all(v['listVisibleHeight']>=32 for v in report['viewports']) else 'behavior-passed-narrow-list-visibility-failed';context.close();browser.close()
finally:
 server.shutdown()
 (OUT/'task924-mock-browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))

sys.exit(0 if report.get('status') == 'passed' else 1)
