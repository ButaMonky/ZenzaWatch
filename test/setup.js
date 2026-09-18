import jsdom from 'jsdom';
import Module from 'module';
import path from 'path';
// import {ZenzaWatch} from '../src/ZenzaWatchIndex';
// import {Config, util, AsyncEmitter, PopupMessage, WindowMessageEmitter} from '../src/util';

// packages/components/src/dll.js does a live network import of the `lit`
// library (`import * as lit from 'https://esm.run/lit';`) so it can run as
// a Greasemonkey userscript in a real browser. Node refuses to resolve a
// bare network URL specifier and throws ERR_NETWORK_IMPORT_DISALLOWED, which
// aborts module loading for anything that imports dll.js (e.g.
// src/ZenzaWatchIndex.js), even indirectly. Redirect any require of dll.js
// to a same-shape test stub (test/mocks/dll.js) before any test file loads.
// See test/mocks/dll.js for the full explanation.
const dllRealPath = path.resolve(__dirname, '../packages/components/src/dll.js');
const dllMockPath = path.resolve(__dirname, './mocks/dll.js');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, ...rest) {
  const resolved = originalResolveFilename.call(this, request, ...rest);
  return resolved === dllRealPath ? dllMockPath : resolved;
};


const html = `
<!doctype html><html><body>
</body></html>
`;
const config = {
  url: 'http://localhost.nicovideo.jp'
};


console.log('*** run setup...\n\n\n');


// if (typeof window !== 'object') {
  let dom = new jsdom.JSDOM(html, config);

  // `dom` is the JSDOM wrapper instance, not a DOM Document — it has no
  // `.cookie`/`.readyState`/etc. `global.document` must be the real
  // Document from `dom.window.document` (this was previously set to `dom`
  // itself, which happened to work only because nothing loaded under
  // `npm test` read a Document-only property at module-eval time; the
  // jsdom 30 investigation surfaced code paths that do).
  global.document = dom.window.document;
  global.window = dom.window;
  global.self = dom.window;
  global.HTMLElement = () => {};
  // Some files (e.g. packages/lib/src/infra/CacheStorage.js) read
  // `window._` (lodash) at module scope, relying on build.js's flat-scope
  // concatenation with another file that assigns it in the production
  // bundle. Node's real module loader has no such flat scope, so provide
  // the same value here for the test/tooling path.
  global.window._ = require('lodash');
  global._ = global.window._;
  // jsdom 30 (unlike the jsdom 11 previously pinned here) implements the
  // CSSOM `CSS` global on its window. Some files (e.g.
  // packages/lib/src/uQuery.js) reference the bare identifier `CSS`
  // (rather than `window.CSS`), which only resolves in a real browser
  // because `window` there *is* the global scope. Mirror it onto Node's
  // global scope so those files still load under Node.
  global.CSS = global.window.CSS;
  // jsdom's window does not provide a `console` unless the document runs
  // scripts (we don't enable that). src/util.js reads `window.console` at
  // module scope to build its own wrapped logger, so mirror Node's console.
  global.window.console = console;
  global.location = {
    protocol: 'http:'
  };
  global.ZenzaWatch = {
    api: {}
  };
  global.AsyncEmitter = {
    on: () => {}
  };
  // global.Config = Config;
  // global.ZenzaWatch = ZenzaWatch;
  // global.AsyncEmitter = AsyncEmitter;
// }

