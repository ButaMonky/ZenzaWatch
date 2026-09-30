import assert from 'power-assert';
const {beginSection,createContext,run,loadClass}=require('../helpers/extractSource');
function subject(){
  const c=createContext();run(beginSection('packages/lib/src/Emitter.js'),c);
  const model=Object.create(loadClass('packages/zenza/src/commentLayer/NicoComment.js','NicoComment',c).prototype);
  const raw={top:[{id:'top'}],naka:[{id:'visible'},{id:'filtered'}],bottom:[{id:'bottom'}]};
  for(const key of ['top','naka','bottom'])model[key+'Group']={nonFilteredMembers:raw[key],members:[]};
  const comment=Object.create(loadClass('src/CommentPlayer.js','NicoCommentPlayer',c).prototype);comment._model=model;
  const player=Object.create(loadClass('src/NicoVideoPlayer.js','NicoVideoPlayer',c).prototype);player._commentPlayer=comment;
  const dialog=Object.create(loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialog',c).prototype);dialog._nicoVideoPlayer=player;
  return {raw,comment,player,dialog};
}
describe('非フィルターコメント一覧の公開API（ZW-018 / Task112）',function(){
  const paths={
    'commentの従来名':h=>h.comment.nonfilteredChatList,
    'commentの共通名':h=>h.comment.nonFilteredChatList,
    'playerのgetter':h=>h.player.nonFilteredChatList,
    'playerのメソッド':h=>h.player.getNonFilteredChatList(),
    'dialogのgetter':h=>h.dialog.nonFilteredChatList,
    'dialogのメソッド':h=>h.dialog.getNonFilteredChatList()
  };
  for(const name of Object.keys(paths))it(name+'でNG対象を含む元の配列を取得できる',function(){
    const h=subject(),list=paths[name](h);assert(list);
    for(const key of ['top','naka','bottom'])assert.strictEqual(list[key],h.raw[key]);
    h.raw.naka.push({id:'added'});assert.equal(paths[name](h).naka.length,3);
  });
  it('通常のフィルター済み一覧は変更しない',function(){
    const h=subject();assert.equal(h.comment.chatList.naka.length,0);assert.equal(h.raw.naka.length,2);
  });
});
