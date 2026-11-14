import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Task1041: しおりの保存一覧の「続きへ」で再生できない（終わりの位置が「ここまで見た」に残る）
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const d=read('nico-src/NicoVideoPlayerDialog.ts');
test('near-end helper treats the last 3 seconds as completed',()=>{
 const m=d.match(/static isNearPlaybackEnd\(seconds:unknown,duration:unknown\):boolean \{([\s\S]*?)\n  \}/);assert(m);
 const fn=new Function('seconds','duration',m[1].replace(/:unknown/g,''));
 assert.equal(fn(86,88),true);assert.equal(fn(88,88),true);assert.equal(fn(80,88),false);
 assert.equal(fn(10,NaN),false);assert.equal(fn(10,0),false);
});
test('local automatic position is not saved at the end or after ended',()=>{
 assert(d.includes("const nearEnd=NicoVideoPlayerDialog.isNearPlaybackEnd(ct,this.duration)||!!this._state?.isEnded;"));
 assert(d.includes('&&ct>0&&!nearEnd&&'));
});
test('opening a saved end position starts from the beginning instead of ending at once',()=>{
 assert(d.includes("this.execCommand('notify', '保存されていた位置が動画の最後だったため、最初から再生します');"));
 assert(d.includes("isNearPlaybackEnd(time,this._state.videoInfo?.duration)?0:time"));
 const p=read('p12-src/ManualBookmarkPanel.ts');
 assert(p.includes('seek.disabled=time<0||!this.deps.openLibraryPosition;'));
});
