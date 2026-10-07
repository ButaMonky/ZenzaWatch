'use strict';

const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

function makeSubject(rel = 'packages/components/src/element/VideoItemElement.js') {
  const events = [];
  class BaseCommandElement {}
  class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
      this.bubbles = options.bubbles;
      this.composed = options.composed;
    }
  }

  const context = createContext({BaseCommandElement, CustomEvent});
  const VideoItemElement = loadClass(
    rel,
    'VideoItemElement',
    context
  );
  const subject = new VideoItemElement();
  subject.props = {thumbnail: 'https://example.invalid/original.jpg'};
  subject.dataset = {};
  subject.dispatchEvent = event => events.push(event);
  return {subject, events};
}

function ownerlessThumbInfo() {
  return {
    status: 'ok',
    data: {
      id: 'sm46778748',
      v: 'sm46778748',
      title: 'ownerless video',
      duration: 123,
      commentCount: 4,
      mylistCount: 5,
      viewCount: 6,
      thumbnail: 'https://example.invalid/thumb.jpg',
      postedAt: '2026-10-04T00:00:00+09:00'
    }
  };
}

describe('AUD-55 ownerless thumb-info video cards', () => {
  it('renders valid ownerless thumb-info without throwing', () => {
    const {subject, events} = makeSubject();

    assert.doesNotThrow(() => subject._applyThumbInfo(ownerlessThumbInfo()));

    assert.strictEqual(subject.dataset.watchId, 'sm46778748');
    assert.strictEqual(subject.dataset.videoId, 'sm46778748');
    assert.strictEqual(subject.dataset.ownerId, 0);
    assert.strictEqual(subject.dataset.ownerName, '');
    assert.strictEqual(subject.dataset.ownerIcon, '');
    assert.strictEqual(subject.dataset.owerUrl, '');
    assert.strictEqual(subject.dataset.isChannel, false);
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].type, 'thumb-info');
  });

  it('preserves existing owner metadata and channel detection', () => {
    const {subject} = makeSubject();
    const info = ownerlessThumbInfo();
    info.data.owner = {
      type: 'channel',
      id: 'ch123',
      name: 'channel owner',
      icon: 'https://example.invalid/icon.jpg',
      url: 'https://ch.nicovideo.jp/ch123'
    };

    subject._applyThumbInfo(info);

    assert.strictEqual(subject.dataset.watchId, 'sm46778748');
    assert.strictEqual(subject.dataset.ownerId, 'ch123');
    assert.strictEqual(subject.dataset.ownerName, 'channel owner');
    assert.strictEqual(subject.dataset.ownerIcon, 'https://example.invalid/icon.jpg');
    assert.strictEqual(subject.dataset.owerUrl, 'https://ch.nicovideo.jp/ch123');
    assert.strictEqual(subject.dataset.isChannel, true);
  });

  it('keeps generated dev dist ownerless rendering in parity with source', () => {
    const {subject, events} = makeSubject('dist/ZenzaWatch-dev.user.js');

    assert.doesNotThrow(() => subject._applyThumbInfo(ownerlessThumbInfo()));

    assert.strictEqual(subject.dataset.watchId, 'sm46778748');
    assert.strictEqual(subject.dataset.ownerId, 0);
    assert.strictEqual(subject.dataset.ownerName, '');
    assert.strictEqual(subject.dataset.ownerIcon, '');
    assert.strictEqual(subject.dataset.owerUrl, '');
    assert.strictEqual(subject.dataset.isChannel, false);
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].type, 'thumb-info');
  });
});
