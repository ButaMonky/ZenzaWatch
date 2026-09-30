import assert from 'power-assert';
const {beginSection,createContext,run,loadClass}=require('../helpers/extractSource');
function subject(){
  const c=createContext({console:{log(){}}});run(beginSection('packages/lib/src/Emitter.js'),c);
  const Group=loadClass('packages/zenza/src/commentLayer/NicoChatGroup.js','NicoChatGroup',c);
  const filter={on(){},isSafe:x=>!x.hidden,applyFilter:xs=>xs.filter(x=>!x.hidden)};
  const group=new Group('naka',{nicoChatFilter:filter});let changes=0;group.on('change',()=>changes++);
  const a={threadId:1,fork:0,no:1},b={threadId:1,fork:0,no:2};group.addChatArray([a,b]);
  return {group,a,b,changes:()=>changes};
}
describe('不存在コメント削除の保護（ZW-071 / Task113）',function(){
  it('存在しない対象では元配列・表示配列・通知を変えない',function(){
    const h=subject();h.group.removeChat({threadId:1,fork:0,no:99});
    assert.equal(h.group.nonFilteredMembers.length,2);assert.equal(h.group.members.length,2);assert.equal(h.changes(),0);
  });
  it('同じ削除を繰り返しても別のコメントを消さない',function(){
    const h=subject();h.group.removeChat(h.a);h.group.removeChat(h.a);
    assert.equal(h.group.nonFilteredMembers.length,1);assert.strictEqual(h.group.nonFilteredMembers[0],h.b);assert.equal(h.changes(),1);
  });
  it('実在する可視コメントは削除して通知する',function(){
    const h=subject();h.group.removeChat(h.a);assert.equal(h.group.members.length,1);assert.strictEqual(h.group.members[0],h.b);assert.equal(h.changes(),1);
  });
  it('非表示のコメントだけを削除して可視コメントを残す',function(){
    const h=subject(),hidden={threadId:1,fork:0,no:3,hidden:true};h.group.addChat(hidden);h.group.removeChat(hidden);
    assert.equal(h.group.nonFilteredMembers.length,2);assert.equal(h.group.members.length,2);assert.equal(h.changes(),0);
  });
  it('表示キャッシュに対象がなくても他の可視コメントを消さない',function(){
    const h=subject();h.group._filteredMembers=[h.b];const cache=h.group._filteredMembers;
    h.group.removeChat(h.a);assert.equal(cache.length,1);assert.strictEqual(cache[0],h.b);assert.strictEqual(h.group.members[0],h.b);
  });
  it('thread/fork/noの一致だけを削除し、別オブジェクトの同一IDも扱う',function(){
    const h=subject();h.group.addChat({threadId:2,fork:0,no:1});h.group.addChat({threadId:1,fork:1,no:1});
    h.group.removeChat({threadId:1,fork:0,no:1});assert.equal(h.group.nonFilteredMembers.length,3);assert.equal(h.group.nonFilteredMembers.includes(h.a),false);
  });
});
