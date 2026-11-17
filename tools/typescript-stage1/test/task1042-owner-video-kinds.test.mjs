import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readNicoFamily} from './dialog-roles.mjs';
// Task1042: 投稿者の ▶ の横に「動画」「ショート」。▶ はそのまま全部。件数を通知に。
// Task1060: NicoVideoPlayerDialog は部品に分割したので、分割先も含めて読む。
const read=readNicoFamily; // Task1063: 分割したモジュールは分割先も含めて読む
test('owner ▶ reveals persistent video/short buttons with tooltips',()=>{
 const v=read('nico-src/VideoInfoPanel.ts');
 assert(v.includes('data-command="ownerVideoLong"'));assert(v.includes('data-command="ownerVideoShort"'));
 assert(v.includes('title="投稿動画だけをプレイリストで開く（ショートを除く）"'));
 assert(v.includes("ownerVideoButton?.addEventListener('mouseenter', revealOwnerVideoKinds);"));
 assert(!/removeEventListener\('mouseenter', revealOwnerVideoKinds/.test(v),'stays shown once revealed');
 assert(v.includes("{id: this._videoInfo.owner.id, contentType: command === 'ownerVideoShort' ? 'short' : 'long'}"));
});
test('dialog passes contentType only when narrowed, and messages carry counts',()=>{
 const d=read('nico-src/NicoVideoPlayerDialog.ts');
 assert(d.includes("...(contentType === 'all' ? {} : {contentType})"));
 const p=read('nico-src/PlayList.ts');
 assert(p.includes("parts.push(`動画${uploaderCounts.videos}件`)"));assert(p.includes("parts.push(`ショート${uploaderCounts.shorts}件`)"));
 assert(p.includes("'投稿ショート動画はありませんでした'"));
});
