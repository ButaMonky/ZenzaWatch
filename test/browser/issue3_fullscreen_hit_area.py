"""In-memory Chromium reproduction. No NicoNico requests, user profiles or credentials."""
from pathlib import Path
import json, os, sys, unittest
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
RUNTIME=Path(os.environ.get('ISSUE3_RUNTIME',ROOT/'src/VideoControlBar.js'))
def fullscreen_css():
 source=RUNTIME.read_text(encoding='utf-8')
 marker="{className: 'screenMode for-screen-full videoControlBar'"
 end=source.index(marker)
 start=source.rfind('util.addStyle(`',0,end)
 assert start>=0, 'fullscreen control-bar stylesheet not found'
 css=source[start+len('util.addStyle(`'):source.rfind('`',start,end)]
 assert '${' not in css, 'fullscreen styles should be static'
 assert '.controlItemContainer.right > .scalingUI' in css, 'seek hit-area fix missing from fullscreen style'
 return css

class HitAreaTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.p=sync_playwright().start()
  cls.browser=cls.p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None),headless=True,args=['--no-sandbox'])
 @classmethod
 def tearDownClass(cls):
  cls.browser.close();cls.p.stop()
 def setUp(self):
  self.page=self.browser.new_page(viewport={'width':1280,'height':720})
  self.page.set_content((ROOT/'test/fixtures/issue3-fullscreen-hit-area.html').read_text())
  # Inject the exact current production fullscreen CSS, not a hand-copied
  # approximation. The fixture retains only reduced base styles/DOM.
  self.page.evaluate('''css=>{
   const style=document.createElement('style');
   style.className='screenMode for-screen-full issue3-hit-area';
   style.textContent=css;
   document.head.appendChild(style);
   style.disabled=true;
   style.dataset.switch='off';
  }''',fullscreen_css())
  self.enable_full(True)
 def tearDown(self): self.page.close()
 def enable_full(self,on):
  self.page.evaluate('''on=>document.querySelectorAll('style.for-screen-full').forEach(s=>{s.disabled=!on;s.dataset.switch=on?'on':'off';})''',on)
 def move_gap(self):
  self.page.mouse.move(30,30)
  self.page.mouse.move(1260,718)
 def test_right_end_gap_delivers_mousemove_and_seek(self):
  self.move_gap()
  self.assertEqual(self.page.evaluate('document.elementFromPoint(1260,718).className'),'seekRange')
  self.assertGreater(self.page.evaluate('evidence.moves.length'),0)
  self.assertEqual(self.page.locator('.seekBarToolTip').evaluate('e=>getComputedStyle(e).visibility'),'visible')
  self.page.mouse.click(1260,718)
  self.assertGreater(self.page.evaluate('evidence.inputs.at(-1)||0'),570)
 def test_native_drag_from_unobstructed_area_still_reaches_end(self):
  self.page.mouse.move(640,718);self.page.mouse.down()
  self.page.mouse.move(1260,718,steps=8);self.page.mouse.up()
  self.assertGreater(self.page.evaluate('evidence.inputs.at(-1)||0'),570)
 def test_disabled_fix_reproduces_blocked_right_end(self):
  # RED proof: with exactly the new rule disabled, the old fullscreen
  # controls remain above the seek strip and intercept direct input.
  self.page.locator('style.issue3-hit-area').evaluate('s=>s.disabled=true')
  self.move_gap()
  blocked=self.page.evaluate('document.elementFromPoint(1260,718)?.className')
  self.assertNotEqual(blocked,'seekRange')
  before=len(self.page.evaluate('evidence.inputs'))
  self.page.mouse.click(1260,718)
  self.assertEqual(len(self.page.evaluate('evidence.inputs')),before)
  # GREEN proof: the same viewport and position work with the fix enabled.
  self.page.locator('style.issue3-hit-area').evaluate('s=>s.disabled=false')
  self.move_gap()
  self.assertEqual(self.page.evaluate('document.elementFromPoint(1260,718).className'),'seekRange')
  self.page.mouse.click(1260,718)
  self.assertGreater(self.page.evaluate('evidence.inputs.at(-1)||0'),570)
 def test_open_menu_keeps_seek_gap_clickable(self):
  self.page.locator('.videoServerTypeMenu').click()
  self.page.locator('div.videoControlBar').evaluate("e=>e.classList.add('is-menuOpen')")
  self.move_gap()
  self.assertEqual(self.page.evaluate('document.elementFromPoint(1260,718).className'),'seekRange')
  self.page.mouse.click(1260,718)
  self.assertGreater(self.page.evaluate('evidence.inputs.at(-1)||0'),570)
 def test_buttons_keep_clicks_and_bubbling(self):
  for selector,command in [('.settingPanelSwitch','settingPanel'),('.fullscreenSwitch','fullscreen'),('.commentHistorySwitch','toggle-commentHistoryPanel'),('.screenFilterSwitch','toggle-screenFilterPanel')]:
   self.page.locator(selector).click()
   self.assertEqual(self.page.evaluate('evidence.commands.at(-1)'),command)
 def test_menu_items_still_receive_clicks_after_focus(self):
  self.page.locator('.videoServerTypeMenu').click()
  item=self.page.locator('[data-command="quality"]').first
  self.assertTrue(item.is_visible())
  item.click()
  self.assertEqual(self.page.evaluate('evidence.commands.at(-1)'),'quality')
 def test_fullscreen_layers_unchanged(self):
  self.assertEqual(self.page.locator('.seekBarContainer').evaluate('e=>getComputedStyle(e).zIndex'),'300')
  self.assertEqual(self.page.locator('.controlItemContainer.right').evaluate('e=>getComputedStyle(e).zIndex'),'310')
  self.page.locator('div.videoControlBar').evaluate("e=>e.classList.add('is-menuOpen')")
  self.assertEqual(self.page.locator('.controlItemContainer.right').evaluate('e=>getComputedStyle(e).zIndex'),'320')
 def test_rule_is_disabled_outside_native_fullscreen(self):
  self.enable_full(False)
  self.assertEqual(self.page.locator('.controlItemContainer.right').evaluate('e=>getComputedStyle(e).pointerEvents'),'auto')
  self.assertEqual(self.page.locator('.scalingUI').evaluate('e=>getComputedStyle(e).pointerEvents'),'auto')

 def test_native_button_keyboard_activation_survives(self):
  self.page.locator('.commentHistorySwitch').focus()
  self.page.keyboard.press('Enter')
  self.assertEqual(self.page.evaluate('evidence.commands.at(-1)'),'toggle-commentHistoryPanel')
 def test_focus_suppression_and_popup_override_are_preserved(self):
  button=self.page.locator('.videoServerTypeMenu')
  button.focus()
  self.assertEqual(button.evaluate('e=>getComputedStyle(e).pointerEvents'),'none')
  self.assertEqual(button.locator('.zenzaPopupMenu').evaluate('e=>getComputedStyle(e).pointerEvents'),'auto')
 def test_tooltips_and_closed_popups_do_not_capture_input(self):
  self.page.locator('.settingPanelSwitch').hover()
  self.assertEqual(self.page.locator('.settingPanelSwitch .tooltip').evaluate('e=>getComputedStyle(e).pointerEvents'),'none')
  self.assertEqual(self.page.locator('.videoServerTypeSelectMenu').evaluate('e=>getComputedStyle(e).pointerEvents'),'none')
 def test_geometry_is_identical_with_and_without_the_hit_area_fix(self):
  script="() => Array.from(document.querySelectorAll('div.videoControlBar, .controlItemContainer.right, .scalingUI, .controlButton, .seekBar, .seekRange')).map(e=>e.getBoundingClientRect().toJSON())"
  after=self.page.evaluate(script)
  self.page.locator('style.issue3-hit-area').evaluate('e=>e.disabled=true')
  self.assertEqual(after,self.page.evaluate(script))
 def test_four_widths_five_scales_and_240_seek_points(self):
  points=0
  for width in (960,1280,1920,2560):
   self.page.set_viewport_size({'width':width,'height':720})
   for scale in (.75,1,1.25,1.5,2):
    self.page.evaluate("s=>{document.documentElement.style.setProperty('--zenza-ui-scale',s);document.documentElement.style.setProperty('--zenza-control-bar-height',(40*s)+'px');}",scale)
    for fraction in (.9,.95,.99,.999):
     for distance in (1,3,5):
      x=min(width-1,width*fraction);y=720-distance
      self.page.mouse.move(30,30)
      self.page.mouse.move(x,y)
      hit=self.page.evaluate('([x,y])=>document.elementFromPoint(x,y)?.className',[x,y])
      self.assertEqual(hit,'seekRange',(width,scale,x,y,hit))
      self.assertEqual(self.page.locator('.seekBarToolTip').evaluate('e=>getComputedStyle(e).visibility'),'visible')
      self.page.mouse.click(x,y)
      value=float(self.page.locator('.seekRange').input_value())
      self.assertLessEqual(abs(value-600*x/width),5,(width,scale,x,y,value))
      points+=1
  self.assertEqual(points,240)
 def test_repeated_fullscreen_stylesheet_entry_and_exit(self):
  for unused in range(5):
   self.enable_full(False)
   self.assertEqual(self.page.locator('.controlItemContainer.right').evaluate('e=>getComputedStyle(e).pointerEvents'),'auto')
   self.enable_full(True)
   self.move_gap()
   self.assertEqual(self.page.evaluate('document.elementFromPoint(1260,718).className'),'seekRange')

if __name__=='__main__': unittest.main(verbosity=2)
