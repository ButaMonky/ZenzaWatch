import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Task1043: ▶ の横のボタンは重ねて置き（名前がずれない）、形を上級者設定で選べる
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('kinds are absolutely positioned on an anchor around ▶ and have no text labels',()=>{
 const v=read('nico-src/VideoInfoPanel.ts');
 assert(v.includes('<span class="ownerVideoAnchor">'));
 assert(/\.ownerVideoKinds \{\s*position: absolute;/.test(v));
 assert(!/data-command="ownerVideoLong"[^>]*>動画</.test(v));
 for(const s of ['row','stack','shape','below','off'])assert(v.includes(`data-kinds-style="${s}"]`),s);
 assert(v.includes("Config.onkey('videoInfo.ownerVideoKindsStyle', applyOwnerVideoKindsStyle);"));
});
test('setting is in 画面・映像 with preview and description, default row',()=>{
 assert(read('advanced-src/Config.ts').includes("'videoInfo.ownerVideoKindsStyle': 'row'"));
 const m=read('advanced-src/ModernAdvancedSettingsModel.ts');
 const i=m.indexOf("group('画面・映像','プレイヤーの操作表示'");assert(i>0);
 assert(m.indexOf("['videoInfo.ownerVideoKindsStyle'",i)>i);
 const u=read('advanced-src/ModernAdvancedSettingsUI.ts');
 assert(u.includes("'videoHeader.position','videoInfo.ownerVideoKindsStyle',"));assert(u.includes('zw-example-ownerkinds'));
});
test('Task1044: preview stage grows to fit the lower row instead of clipping',()=>{
 const u=read('advanced-src/ModernAdvancedSettingsUI.ts');
 assert(u.includes("stage.style.height='auto';"));assert(u.includes("stage.style.overflow='visible';"));
});
