import assert from 'power-assert';

const {createPlaylistContext} = require('../helpers/playlistHarness');
const {extract, run} = require('../helpers/extractSource');

describe('Playlist export Blob URL lifetime (Task 232)', function() {
  it('revokes the generated Blob URL after the download anchor cleanup', function() {
    const {c, createPlaylist, item} = createPlaylistContext();
    const events = [];
    const timers = [];

    c.prompt = () => 'playlist-backup';
    c.Blob = class {
      constructor(parts, options) {
        this.parts = parts;
        this.options = options;
      }
    };
    c.URL = {
      createObjectURL(blob) {
        events.push(['create', blob.options.type]);
        return 'blob:playlist-export';
      },
      revokeObjectURL(url) {
        events.push(['revoke', url]);
      }
    };

    const anchor = {
      click() { events.push(['click']); },
      remove() { events.push(['remove']); }
    };
    c.document = {
      createElement(tag) {
        assert.equal(tag, 'a');
        return anchor;
      },
      body: {
        append(node) {
          assert.equal(node, anchor);
          events.push(['append']);
        }
      }
    };
    c.setTimeout = (fn, ms) => {
      timers.push({fn, ms});
      return timers.length;
    };

    const playlist = createPlaylist();
    playlist.model.setItem([item('sm1')]);
    playlist._onExportFileCommand();

    assert.deepEqual(events, [
      ['create', 'application/json'],
      ['append'],
      ['click']
    ]);
    assert.equal(anchor.download, 'playlist-backup.playlist.json');
    assert.equal(anchor.href, 'blob:playlist-export');
    assert.equal(timers.length, 1);
    assert.equal(timers[0].ms, 1000);

    timers[0].fn();

    assert.deepEqual(events.slice(-2), [
      ['remove'],
      ['revoke', 'blob:playlist-export']
    ]);
  });

  it('keeps generated dev dist Blob URL cleanup in parity with source', function() {
    const {c, item} = createPlaylistContext();
    const events = [];
    const timers = [];

    run(`globalThis.DistPlayList = (${extract('dist/ZenzaWatch-dev.user.js', 'PlayList')});`, c);
    c.prompt = () => 'playlist-backup';
    c.Blob = class {
      constructor(parts, options) {
        this.parts = parts;
        this.options = options;
      }
    };
    c.URL = {
      createObjectURL(blob) {
        events.push(['create', blob.options.type]);
        return 'blob:playlist-export';
      },
      revokeObjectURL(url) {
        events.push(['revoke', url]);
      }
    };

    const anchor = {
      click() { events.push(['click']); },
      remove() { events.push(['remove']); }
    };
    c.document = {
      createElement(tag) {
        assert.equal(tag, 'a');
        return anchor;
      },
      body: {
        append(node) {
          assert.equal(node, anchor);
          events.push(['append']);
        }
      }
    };
    c.setTimeout = (fn, ms) => {
      timers.push({fn, ms});
      return timers.length;
    };

    const playlist = new c.DistPlayList();
    playlist.initialize({loop: false, container: null, loader: {}});
    playlist.view = {scrollToItem() {}, scrollTop() {}, hasFocus: false};
    playlist.model.setItem([item('sm1')]);
    playlist._onExportFileCommand();

    assert.deepEqual(events, [
      ['create', 'application/json'],
      ['append'],
      ['click']
    ]);
    assert.equal(anchor.download, 'playlist-backup.playlist.json');
    assert.equal(anchor.href, 'blob:playlist-export');
    assert.equal(timers.length, 1);
    assert.equal(timers[0].ms, 1000);

    timers[0].fn();

    assert.deepEqual(events.slice(-2), [
      ['remove'],
      ['revoke', 'blob:playlist-export']
    ]);
  });
});
