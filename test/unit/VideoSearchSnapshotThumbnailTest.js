'use strict';
const assert=require('assert');
const {NicoSearchApiV2Loader}=require('../../packages/lib/src/nico/VideoSearch');

// Regression for Issue #27 / Task644 VS-SNAPSHOT-THUMB-002.
// Exercise the actual production snapshot parser; no NicoNico network requests.
const item=(id,thumbnailUrl)=>({
  contentId:id,title:'Snapshot '+id,description:'<b>title</b>',
  thumbnailUrl,startTime:'2024-01-02T03:04:05Z',lengthSeconds:61
});
const parse=items=>NicoSearchApiV2Loader.parseResult(JSON.stringify({
  meta:{status:200,totalCount:items.length},data:items
}));

describe('Issue #27 Snapshot thumbnailUrl normalization',()=>{
  it('removes terminal .M without referencing non-existent thumbnail_url',()=>{
    const result=parse([item('sm100','https://example.invalid/thumb.M')]);
    assert.equal(result.status,'ok');
    assert.equal(result.count,1);
    assert.equal(result.list.length,1);
    assert.equal(result.list[0].thumbnail_url,'https://example.invalid/thumb');
    assert.equal(result.list[0].is_middle_thumbnail,true);
  });
  it('keeps embedded .M unchanged but retains native middle-thumbnail flag',()=>{
    const result=parse([item('sm101','https://example.invalid/thumb.Mx')]);
    assert.equal(result.list[0].thumbnail_url,'https://example.invalid/thumb.Mx');
    assert.equal(result.list[0].is_middle_thumbnail,true);
  });
  it('does not modify a normal thumbnail URL and preserves its counters',()=>{
    const data=item('sm102','https://example.invalid/thumb.jpg');
    data.likeCounter=19;
    const result=parse([data]);
    assert.equal(result.list[0].thumbnail_url,data.thumbnailUrl);
    assert.equal(result.list[0].is_middle_thumbnail,undefined);
    assert.equal(result.list[0].like_counter,19);
  });
  it('preserves the original high-sm-id middle-thumbnail rule',()=>{
    const result=parse([item('sm30000000','https://example.invalid/thumb.jpg')]);
    assert.equal(result.list[0].thumbnail_url,'https://example.invalid/thumb.jpg');
    assert.equal(result.list[0].is_middle_thumbnail,true);
  });
  it('does not throw for absent and null optional thumbnail URLs',()=>{
    const absent=item('sm103',undefined);
    delete absent.thumbnailUrl;
    const result=parse([absent,item('sm104',null)]);
    assert.equal(result.status,'ok');
    assert.equal(result.list.length,2);
    assert.equal(result.list[0].thumbnail_url,undefined);
    assert.equal(result.list[1].thumbnail_url,null);
    assert.equal(result.list[0].is_middle_thumbnail,undefined);
    assert.equal(result.list[1].is_middle_thumbnail,undefined);
  });
  it('parses mixed thumbnail records in their original search order',()=>{
    const result=parse([
      item('sm105','https://example.invalid/a.M'),
      item('nm106','https://example.invalid/b.jpg'),
      item('sm107','https://example.invalid/c.M')
    ]);
    assert.deepEqual(result.list.map(x=>x.id),['sm105','nm106','sm107']);
    assert.deepEqual(result.list.map(x=>x.thumbnail_url),[
      'https://example.invalid/a','https://example.invalid/b.jpg',
      'https://example.invalid/c'
    ]);
  });
});
