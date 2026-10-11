'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
const api=()=>loadClass('src/RelatedMenuOrder.js','RelatedMenuOrder',createContext({}));
const keys=o=>Array.from(o,x=>x.key);
describe('Task318 unified related menu ordering',()=>{
  it('lists the seven built-in entries, links and registered actions in a stable default order',()=>{
    const Order=api();
    const items=Order.entries([{id:'history',label:'履歴',enabled:true}],
      [{id:'external',label:'登録機能'}]);
    assert.strictEqual(Order.STANDARD.length,7);
    assert.deepStrictEqual(keys(items),[
      'builtin:official','builtin:ad','builtin:twitter','builtin:original',
      'builtin:tree','builtin:tree-playlist','builtin:copy-url',
      'link:history','action:external']);
  });
  it('allows a saved mixed order and appends newly registered actions',()=>{
    const Order=api();
    const result=Order.entries([{id:'history',label:'履歴'}],
      [{id:'new',label:'追加登録'}],['link:history','builtin:tree','action:old']);
    assert.deepStrictEqual(keys(result).slice(0,3),
      ['link:history','builtin:tree','action:old']);
    assert.strictEqual(result[2].present,false);
    assert.strictEqual(result.at(-1).key,'action:new');
  });
  it('preserves an unavailable external action ID for future registration',()=>{
    const Order=api();
    const wanted=['action:offline','builtin:copy-url','link:gone'];
    const dormant=Order.entries([],[],wanted);
    assert.strictEqual(dormant[0].present,false);
    assert.strictEqual(dormant[2].present,false);
    const restored=Order.entries([],[{id:'offline',label:'戻ってきたアクション'}],wanted);
    assert.strictEqual(restored[0].present,true);
    assert.strictEqual(restored[0].label,'戻ってきたアクション');
  });
  it('rejects injection-shaped, duplicated and excessive persisted keys',()=>{
    const Order=api();
    for(const order of [
      'not-an-array',null,['builtin:imaginary'],['link:a','link:a'],
      ['action:<img>'],['link:a b'],Array(257).fill('action:x')]){
      assert.strictEqual(Order.validateOrder(order),false);
    }
    assert.strictEqual(Order.validateOrder([]),true);
    assert.strictEqual(Order.validateOrder(['builtin:official','action:valid-1']),true);
    assert.deepStrictEqual(Array.from(Order.orderedKeys(['action:missing','builtin:ad'],
      ['builtin:official','builtin:ad','action:active'])),
      ['builtin:ad','builtin:official','action:active']);
  });
});

describe('Task318 related-menu hidden row validation',()=>{
  it('keeps a separate bounded list of suppressed item IDs',()=>{
    const Order=api();
    const hidden=['builtin:official','link:history','action:temporary'];
    assert(Order.validateHiddenItems(hidden));
    assert(Order.isHidden('builtin:official',hidden));
    assert(!Order.isHidden('builtin:copy-url',hidden));
    assert(!Order.isHidden('builtin:official',['builtin:official','builtin:official']));
    assert(!Order.validateHiddenItems(['builtin:invalid']));
    assert(!Order.validateHiddenItems(['action:code<script>']));
  });
});
