const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {JSDOM, VirtualConsole} = require('jsdom');
const {createBuildSandbox, runBuild, removeDir} = require('../helpers/buildSandbox');

describe('CapTube standalone startup from the actual build (ZW-051 startup)', function() {
  this.timeout(180000);
  let sandbox;
  afterEach(function() { if (sandbox) { removeDir(sandbox); sandbox = null; } });
  it('creates its controls and handles the play shortcut without injected addon dependencies', function() {
    sandbox = createBuildSandbox();
    const built = runBuild(sandbox);
    assert.strictEqual(built.status, 0, built.stdout + built.stderr);
    const source = fs.readFileSync(path.join(sandbox, 'dist/CapTube.user.js'), 'utf8');
    const errors = [];
    const console = new VirtualConsole();
    console.on('jsdomError', error => errors.push(error));
    const dom = new JSDOM('<!doctype html><html><head></head><body><video class="html5-main-video"></video></body></html>', {
      url: 'https://www.youtube.com/watch?v=fixture', runScripts: 'outside-only',
      pretendToBeVisual: true, virtualConsole: console
    });
    try {
      const w = dom.window;
      w.fetch = () => { throw new Error('Network must not be used at startup'); };
      w.Worker = function() { throw new Error('Worker must not start until a capture'); };
      let plays = 0;
      const video = w.document.querySelector('video');
      Object.defineProperty(video, 'paused', {value: true});
      video.play = () => { plays++; return Promise.resolve(); };
      w.eval(source);
      assert.ok(w.document.querySelector('#CapTubePreviewContainer'));
      assert.ok(w.document.querySelector('#CapTubeMeterContainer'));
      assert.ok(w.document.querySelector('style.CapTube'));
      w.dispatchEvent(new w.KeyboardEvent('keypress', {key: 'w'}));
      assert.strictEqual(plays, 1);
      assert.deepStrictEqual(errors, []);
    } finally { dom.window.close(); }
  });
});
