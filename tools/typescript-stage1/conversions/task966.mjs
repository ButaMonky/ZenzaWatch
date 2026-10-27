// Task966 conversion config: the userscript entry files (no //===BEGIN===), legacy strictness.
// The ==UserScript== header and imports stay JS in the runtime file (shape 'entry').
// src/_pocket.js is left to the Pocket lane; src/_template.js, _setting.js and _blog.js are
// assembly files of other generators.
const entry = (runtime) => ({runtime, cls: 'auto', legacy: true, entry: true});
export default {
  task: 'task966',
  title: 'userscript entry scripts (legacy strictness)',
  modules: {
    UQueryEntry: entry('src/_uquery.js'),
    CapTubeEntry: entry('src/_captube.js'),
    MaskedWatchEntry: entry('src/_shape.js'),
    HeatSyncEntry: entry('src/_heatsync.js'),
    GamePadEntry: entry('src/_gamepad.js'),
    HlsEntry: entry('src/_hls.js'),
  },
  allowlist: [
    ['VideoControlBar|VideoInfoPanel|NicoVideoPlayerDialog|RootDispatcher|initializer|State|CommentPlayer))\\.js$',
      'VideoControlBar|VideoInfoPanel|NicoVideoPlayerDialog|RootDispatcher|initializer|State|CommentPlayer|_uquery|_captube|_shape|_heatsync|_gamepad|_hls))\\.js$'],
  ],
};
