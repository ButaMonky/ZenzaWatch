const assert = require('node:assert/strict');
const vm = require('node:vm');
const {beginSection} = require('../helpers/extractSource');

describe('first-use share panel', () => {
  function fixture(asynchronous = true) {
    const requests = [], opened = [], alerts = [];
    let closes = 0;
    const panel = {open:(...args) => opened.push(args),close:() => { closes++; }};
    const create = () => {
      if (!asynchronous) { requests.push({}); return panel; }
      return new Promise((resolve,reject) => requests.push({ready:() => resolve(panel),reject}));
    };
    const api = vm.runInNewContext(beginSection('src/VideoSharePanel.js') +
      '\ncreateVideoSharePanel = create; VideoSharePanel',{create,PopupMessage:{alert:text => alerts.push(text)}});
    return {api,requests,opened,alerts,closes:() => closes};
  }
  it('loads on first open, honors the most recent selection, then reuses the panel',async () => {
    const {api,requests,opened,closes} = fixture();
    api.close();
    assert.equal(requests.length,0);
    api.open('first',10);
    api.open('second',20);
    assert.equal(requests.length,1);
    requests[0].ready();
    await Promise.resolve();
    assert.deepEqual(opened,[['second',20]]);
    api.close();
    assert.equal(closes(),1);
    api.open('third',30);
    assert.deepEqual(opened,[['second',20],['third',30]]);
    assert.equal(requests.length,1);
  });
  it('does not open a stale video after the player closed during loading',async () => {
    const {api,requests,opened} = fixture();
    api.open('old video');
    api.close();
    requests[0].ready();
    await Promise.resolve();
    assert.deepEqual(opened,[]);
    api.open('current video');
    assert.deepEqual(opened,[['current video']]);
  });
  it('lets a failed first load be retried and leaves closed requests silent',async () => {
    const {api,requests,opened,alerts} = fixture();
    api.open('first');
    requests[0].reject(Error('unavailable'));
    await Promise.resolve();
    assert.equal(alerts.length,1);
    api.open('closed');
    api.close();
    requests[1].reject(Error('unavailable'));
    await Promise.resolve();
    assert.equal(alerts.length,1);
    api.open('retry');
    requests[2].ready();
    await Promise.resolve();
    assert.deepEqual(opened,[['retry']]);
  });
  it('handles the first click synchronously when the local factory is already available', () => {
    const {api,requests,opened} = fixture(false);
    assert.equal(requests.length,0);
    api.open('first');
    assert.deepEqual(opened,[['first']]);
    assert.equal(requests.length,1);
  });
});
