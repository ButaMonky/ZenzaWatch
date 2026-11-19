'use strict';
const assert = require('node:assert/strict');
const {createContext, loadClass} = require('../helpers/extractSource');
const context = createContext({JSONable:class {}});
const Model = loadClass('src/VideoInfo.js', 'VideoInfoModel', context);
function owns(viewer, author, isChannel = false) {
  const data = {viewerInfo:{id:viewer}, watchApiData:{videoDetail:{id:'sm9', channelId:isChannel ? author : null}, uploaderInfo:{id:author}, channelInfo:{id:author}}};
  return new Model(data).isOwnUpload;
}
describe('動画情報モデルの投稿者判定', () => {
  it('ログインユーザーと投稿者のIDが一致する個人投稿を識別できる', () => {
    assert.equal(owns(9, '9'), true);
    for (const args of [[9, 10], [0, 0], [null, null], [9, 9, true]]) { assert.equal(owns(...args), false); }
  });
});
