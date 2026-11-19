const assert = require('node:assert/strict');
const vm = require('node:vm');
const {beginSection} = require('../helpers/extractSource');

describe('X clip clipboard fallback', () => {
  function setup(supports = () => true) {
    const writes = [];
    class ClipboardItem {
      constructor(data) { this.data = data; }
    }
    ClipboardItem.supports = supports;
    const clipboard = {read:async () => [], write:async items => writes.push(items)};
    const api = vm.runInNewContext(beginSection('src/ShareClipClipboard.js') + '\nShareClipClipboard', {
      ClipboardItem, navigator:{clipboard}, TextEncoder, Blob, File, DataView
    });
    return {api, writes, clipboard};
  }
  const file = {name:'日本語.mp4', type:'video/mp4', size:27 * 1024 ** 2};
  it('checks the exact serialized size without allocating a GiB or reading the clipboard', async () => {
    const {api,writes} = setup();
    const headerBytes = 4 + Buffer.byteLength(JSON.stringify({name:file.name,type:file.type}));
    const tooLarge = {...file, size:1024 ** 3 - headerBytes};
    assert.equal(api.copyUnavailableReason({...tooLarge, size:tooLarge.size - 1}), '');
    assert.match(api.copyUnavailableReason(tooLarge), /1 GiB/);
    await assert.rejects(api.copy(tooLarge), /動画を保存/);
    assert.equal(writes.length, 0);
  });
  it('offers manual attachment when the custom format cannot be confirmed', () => {
    for (const supports of [() => false, null]) {
      const {api} = setup(supports);
      assert.equal(api.supported(), false);
      assert.match(api.copyUnavailableReason(file), /動画を保存/);
    }
  });
  it('rejects a header the receiver cannot read and offers a fallback for write failures', async () => {
    const {api,clipboard} = setup();
    assert.match(api.copyUnavailableReason({...file, name:'あ'.repeat(900) + '.mp4'}), /ファイル名/);
    clipboard.write = async () => { throw new DOMException('denied','NotAllowedError'); };
    await assert.rejects(api.copy(new File(['video'],file.name,{type:file.type})), /許可.*動画を保存/);
  });
});
