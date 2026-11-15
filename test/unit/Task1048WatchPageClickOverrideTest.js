'use strict';
// Task1048: 公式の視聴ページでも「動画リンクをZenzaWatchで開く」が働き、公式プレイヤーを止めてから開く。
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ts=fs.readFileSync(path.join(__dirname,'../../tools/typescript-stage1/nico-src/HoverMenu.ts'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'../../packages/zenza/src/menu/HoverMenu.js'),'utf8');
describe('Task1048 click-to-open on official watch pages',()=>{
  for(const [name,src] of [['ts',ts],['runtime',js]]){
    it(name+': the watch-page exclusion is gone and the official player is paused',()=>{
      assert(!/!nicoUtil\.isGinzaWatchUrl\(\)\s*&&\s*\n?\s*this\._playerConfig\.props\.overrideWatchLink/.test(src));
      assert(/if \(nicoUtil\.isGinzaWatchUrl\(\)\) \{\s*HoverMenu\.pauseOfficialPlayer\(\);/.test(src));
      assert(src.includes("grid-area_\\\\[player\\\\] video"));
    });
  }
});
