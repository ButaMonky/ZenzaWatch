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
  it('retains the current tab when a trusted request has no background-capable manager', () => {
    const api = vm.runInNewContext(beginSection('src/ShareClipClipboard.js') + '\nShareClipClipboard',{
      document:{documentElement:{dataset:{}}}, window:{dispatchEvent(){},open:assert.fail}, Event
    });
    const draft = api.reserveDraft(true);
    for (const run of [() => draft.complete(file,''), () => draft.openText('本文')]) {
      assert.throws(run,error => error.stage === 'draft-reserve' && error.reason === 'draft-background-unavailable');
    }
  });
  it('never opens a foreground fallback if the background manager misses the reservation',async () => {
    let expire;
    const api = vm.runInNewContext(beginSection('src/ShareClipClipboard.js') + '\nShareClipClipboard',{
      document:{documentElement:{dataset:{zenzaDraftTicket:'stale'}}},
      location:{origin:'https://www.nicovideo.jp'},window:{postMessage(){},open:assert.fail},
      MessageChannel:class { constructor() { this.port1 = {postMessage(){},close(){}}; this.port2 = {}; }},
      setTimeout(fn){ expire = fn; },clearTimeout(){}
    });
    const draft = api.reserveDraft(true);
    const pending = draft.complete(file,'本文');
    expire();
    await assert.rejects(pending,error => error.stage === 'draft-reserve' && error.reason === 'draft-background-unavailable');
  });
  it('uses one acknowledged reservation for a text draft without sending a file',async () => {
    const messages = [];
    let port, reserve;
    const api = vm.runInNewContext(beginSection('src/ShareClipClipboard.js') + '\nShareClipClipboard',{
      document:{documentElement:{dataset:{zenzaDraftTicket:'fixture'}}},
      location:{origin:'https://www.nicovideo.jp'},window:{postMessage(msg){ reserve = msg; },open:assert.fail},
      MessageChannel:class { constructor() {
        this.port1 = port = {postMessage:msg => messages.push(msg),close(){}};
        this.port2 = {};
      }},setTimeout,clearTimeout
    });
    const draft = api.reserveDraft(true);
    assert.equal(reserve.background,true);
    const opened = draft.openText('本文');
    assert.equal(messages.length,0);
    port.onmessage({data:{reserved:true}});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(messages[0].type,'open-text');
    assert.equal(messages[0].text,'本文');
    assert.equal(Object.hasOwn(messages[0],'file'),false);
    port.onmessage({data:{opened:true}});
    await opened;
    await assert.rejects(draft.openText('再送'),/受付を終了/);
  });
  it('keeps the bridge open for X media preparation and returns its specific failure', async () => {
    let port, timeout, sent = 0, now = 0;
    const api = vm.runInNewContext(beginSection('src/ShareClipClipboard.js') + '\nShareClipClipboard',{
      document:{documentElement:{dataset:{zenzaDraftTicket:'fixture'}},hasFocus:()=>false},
      location:{origin:'https://www.nicovideo.jp'},window:{postMessage(){}},
      MessageChannel:class { constructor() {
        this.port1 = port = {postMessage(message){ if (message.type === 'complete') sent++; },close(){}};
        this.port2 = {};
      }},
      Date:class extends Date { static now(){return now;} },
      setTimeout(fn,delay){ timeout = {fn,delay}; return timeout; },clearTimeout(){}
    });
    const draft = api.reserveDraft();
    port.onmessage({data:{reserved:true}});
    const stages = [];
    const pending = draft.complete(file,'',(stage) => stages.push(stage));
    await new Promise(resolve => setImmediate(resolve));
    port.onmessage({data:{stage:'draft-attach',percent:100}});
    const transferWait = timeout.delay;
    for (const stage of ['draft-received','draft-prepare']) {
      port.onmessage({data:{stage}});
      assert.equal(stages.at(-1),stage);
      assert(timeout.delay > 315000 && timeout.delay > transferWait);
    }
    const native = percent => port.onmessage({data:{stage:'draft-prepare',percent}});
    native(26);
    const idle = timeout;
    now += 240000;
    native(26);native(15);native(undefined);
    port.onmessage({data:{stage:'draft-attach',percent:100}});
    assert.equal(timeout,idle,'duplicate, stale and byte-transfer progress cannot reset the native wait');
    native(27);
    assert.notEqual(timeout,idle);
    for (const percent of [40,60,80,98]) { now += 240000; native(percent); }
    assert(timeout.delay > 0 && now + timeout.delay <= 21 * 60000,'increasing percent still has a hard deadline');
    port.onmessage({data:{error:'Xがこの動画を受け付けませんでした。',reason:'draft-media-rejected'}});
    await assert.rejects(pending,error => error.stage === 'draft-prepare' && error.reason === 'draft-media-rejected');
    assert.equal(sent,1);
  });
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
