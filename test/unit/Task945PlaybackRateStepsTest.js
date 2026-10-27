'use strict';
// Discussion #40: speed hotkeys must traverse stable presets in both directions.
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');

function harness(initialRate=1){
  let rate=initialRate;
  const writes=[];
  const config={
    getValue(key){assert.strictEqual(key,'playbackRate');return rate;},
    setValue(key,value){assert.strictEqual(key,'playbackRate');rate=value;writes.push(value);}
  };
  const Dialog=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialog',
    createContext({Emitter:class {}, MediaSessionApi:{updatePositionStateByMedia(){}}}));
  const dialog=Object.create(Dialog.prototype);
  dialog._playerConfig=config;
  return {press:(key,param)=>dialog.execCommand(key,param),get rate(){return rate;},writes};
}

describe('Task945: reversible playback rate shortcuts (Discussion #40)',function(){
  it('returns exactly to 1.0 after four downs and four ups',()=>{
    const h=harness(1);
    for(let i=0;i<4;i++)h.press('shiftDown');
    assert.deepStrictEqual(h.writes,[0.75,0.5,0.25,0.1]);
    for(let i=0;i<4;i++)h.press('shiftUp');
    assert.deepStrictEqual(h.writes.slice(4),[0.25,0.5,0.75,1]);
  });
  it('uses quarter steps through 2 and half steps only between 2 and 3',()=>{
    const h=harness(1.75);
    ['shiftUp','shiftUp','shiftUp','shiftDown','shiftDown','shiftDown']
      .forEach(k=>h.press(k));
    assert.deepStrictEqual(h.writes,[2,2.5,3,2.5,2,1.75]);
  });
  it('snaps manually chosen non-preset rates to the nearest NEXT preset',()=>{
    for(const [start,up,down] of [
      [0.35,0.5,0.25],[1.1,1.25,1],[2.25,2.5,2],
      [3.1,3.25,3],[3.63,3.75,3.5],[9.8,10,9.75]
    ]){
      const rising=harness(start);rising.press('shiftUp');
      assert.strictEqual(rising.rate,up,`up from ${start}`);
      const falling=harness(start);falling.press('shiftDown');
      assert.strictEqual(falling.rate,down,`down from ${start}`);
    }
  });
  it('all preset rates remain reversible, across both step sizes',()=>{
    const h=harness(0.1);
    const ascending=[0.1];
    while(h.rate<10){h.press('shiftUp');ascending.push(h.rate);}
    assert.strictEqual(ascending.length,39);
    assert.deepStrictEqual(ascending.slice(8,14),[2,2.5,3,3.25,3.5,3.75]);
    assert.deepStrictEqual(ascending.slice(-5),[9,9.25,9.5,9.75,10]);
    for(let i=ascending.length-2;i>=0;i--){
      h.press('shiftDown');
      assert.strictEqual(h.rate,ascending[i],`down to preset ${ascending[i]}`);
    }
  });
  it('keeps direct menu speed commands distinct from stepping',()=>{
    const h=harness(1);
    h.press('playbackRate',3);
    assert.strictEqual(h.rate,3);
    h.press('shiftDown');
    assert.strictEqual(h.rate,2.5);
  });
  it('clamps at 0.1 and 10 without drifting or writing off-grid rates',()=>{
    const low=harness(0.1),high=harness(10);
    for(let i=0;i<12;i++){low.press('shiftDown');high.press('shiftUp');}
    assert.strictEqual(low.rate,0.1);
    assert.strictEqual(high.rate,10);
  });
});
