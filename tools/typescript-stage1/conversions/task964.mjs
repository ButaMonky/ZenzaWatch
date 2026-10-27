// Task964 conversion config: the three largest legacy modules (legacy strictness).
const legacy = (runtime) => ({runtime, cls: 'auto', legacy: true});
export default {
  task: 'task964',
  title: 'video control bar, video info panel and player dialog (legacy strictness)',
  modules: {
    VideoControlBar: {...legacy('src/VideoControlBar.js'), rep: [
      // A setter's return value is ignored by JS; TS forbids `return value` in a setter, so call
      // and return separately (same behaviour).
      ['        this._currentTime = v;\n        return this.applyTransform();\n',
        '        this._currentTime = v;\n        this.applyTransform();\n        return;\n', 1],
    ]},
    VideoInfoPanel: legacy('src/VideoInfoPanel.js'),
    NicoVideoPlayerDialog: legacy('src/NicoVideoPlayerDialog.js'),
  },
  allowlist: [
    ['src\\/(?:VideoInfo|TagListView|CommentInputPanel|CommentPanel|NicoVideoPlayer))\\.js$',
      'src\\/(?:VideoInfo|TagListView|CommentInputPanel|CommentPanel|NicoVideoPlayer|VideoControlBar|VideoInfoPanel|NicoVideoPlayerDialog))\\.js$'],
  ],
};
