'use strict';
const assert = require('assert');
const {waitForDevToolsPort} = require('../browser/lib/chrome-devtools-port.cjs');
describe('検査用Chromeの接続先ファイル', function() {
  it('未作成・書き込みロック・途中の数字を待ち、完成した行を読む', async () => {
    const values = [Object.assign(new Error(), {code: 'ENOENT'}), Object.assign(new Error(), {code: 'EBUSY'}), '', '922', '9222\n/devtools/browser/x'];
    let reads = 0, waits = 0;
    const port = await waitForDevToolsPort(() => { const v = values[reads++]; if (v instanceof Error) throw v; return v; }, async () => { waits++; }, 5);
    assert.strictEqual(port, '9222'); assert.strictEqual(reads, 5); assert.strictEqual(waits, 4);
  });
  it('有効なCRLFの行は待たずに読む', async () => {
    assert.strictEqual(await waitForDevToolsPort(() => '65535\r\n/x', async () => { throw new Error('不要な待機'); }), '65535');
  });
  it('不正な番号が続いても指定した回数で終了する', async () => {
    let reads = 0, waits = 0;
    await assert.rejects(waitForDevToolsPort(() => { reads++; return '65536\n/x'; }, async () => { waits++; }, 3), /timeout waiting/);
    assert.strictEqual(reads, 3); assert.strictEqual(waits, 2);
  });
  it('ロック以外の読み込みエラーは隠さない', async () => {
    const error = Object.assign(new Error('read denied'), {code: 'EACCES'});
    await assert.rejects(waitForDevToolsPort(() => { throw error; }, async () => { throw new Error('不要な待機'); }), e => e === error);
  });
});
