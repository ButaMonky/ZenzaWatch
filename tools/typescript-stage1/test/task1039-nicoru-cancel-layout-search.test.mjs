import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readNicoFamily} from './dialog-roles.mjs';
// Task1039: ニコるの取り消し・見た目の設定（既定はダークモード風・旧式あり）・横長の狭い画面の大モード・検索の切り替えで検索しない
// Task1060: NicoVideoPlayerDialog は部品に分割したので、分割先も含めて読む。
const read=readNicoFamily; // Task1063: 分割したモジュールは分割先も含めて読む
test('un-nicoru uses the official DELETE endpoint with frontend headers and credentials',()=>{
 const s=read('nico-src/ThreadLoader.ts');
 assert(s.includes("'https://nvapi.nicovideo.jp/v1/users/me/nicoru/send/' + encodeURIComponent(nicoruId)"));
 assert(/method: 'DELETE'/.test(s));assert(s.includes("'x-request-with': 'nicovideo'"));assert(s.includes("credentials: 'include'"));
 assert(/\[0-9A-Za-z\]\+\$\//.test(s),'nicoruId is validated before use');
});
test('nicotta rows send nicoru-cancel for both the new svg and the legacy icon, and loaded nicoruId marks nicotta',()=>{
 const p=read('nico-src/CommentPanel.ts');
 assert(p.includes("closest('.nicoru-icon, .nicoru-legacy-icon')"));
 assert(p.includes("item.classList.contains('nicotta') ? 'nicoru-cancel' : 'nicoru'"));
 assert(p.includes("case 'nicoru-cancel': {"));assert(p.includes('class="nicoru-legacy-icon"'));
 assert(!/\.nicotta \.nicoru-icon \{[^}]*pointer-events: none/.test(p),'nicotta icon must stay clickable to cancel');
 for(const f of ['comment-src/NicoChat.ts','../../packages/zenza/src/commentLayer/NicoChat.js']){
  const c=read(f);assert(c.includes('value.nicotta = !!data.nicotta || !!value.nicoruId'));assert(c.includes('get nicoruId()'));
 }
 const d=read('nico-src/NicoVideoPlayerDialog.ts');assert(d.includes("case 'nicoru-cancel': {"));assert(d.includes('loader.unNicoru('));
});
test('nicoru style setting defaults to dark and offers light and legacy in normal and advanced settings',()=>{
 const conf=read('advanced-src/Config.ts');assert(conf.includes("'commentPanel.nicoruStyle': 'dark'"));
 assert(conf.includes("'commentPanel.nicoruStyle': ['dark', 'light', 'legacy']"));
 const adv=read('advanced-src/ModernAdvancedSettingsModel.ts');assert(adv.includes("['commentPanel.nicoruStyle','ニコるボタンの見た目'"));
 assert(read('nico-src/SettingPanelElement.ts').includes('data-setting-name="commentPanel.nicoruStyle"'));
 const p=read('nico-src/CommentPanel.ts');
 assert(/body, body\.nicoruStyle-dark \{\s*--nicoru-off-fg: #999; --nicoru-off-bg: #262626; --nicoru-on-fg: #fcd842; --nicoru-on-bg: #262626;/.test(p));
 assert(/body\.nicoruStyle-light \{\s*--nicoru-off-fg: #999; --nicoru-off-bg: #fff; --nicoru-on-fg: #262626; --nicoru-on-bg: #fcd842;/.test(p));
});
test('narrow landscape viewports keep the side panel in big mode (Firefox 100% 1212x715)',()=>{
 const d=read('nico-src/NicoVideoPlayerDialog.ts'),v=read('nico-src/VideoInfoPanel.ts');
 assert(d.includes('(width < 1216px) and (min-height: 700px) and (aspect-ratio < 4/3)'));
 assert(d.includes('@media (min-width: 640px) and (width < 1216px) and ((height < 700px) or (aspect-ratio >= 4/3)) {'));
 assert(v.includes('(width < 1216px) and (min-height: 700px) and (aspect-ratio < 4/3) {'));
 assert(v.includes('@media screen and (min-width: 640px) and (aspect-ratio >= 4/3) {'));
});
test('switching keyword/tag or video/short does not submit a search',()=>{
 const v=read('nico-src/VideoInfoPanel.ts');
 assert(v.includes("if ((item as Loose).name === 'mode' || (item as Loose).name === 'selectContentType') { return; }"));
});
