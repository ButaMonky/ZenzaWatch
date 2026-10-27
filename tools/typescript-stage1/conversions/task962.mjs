// Task962 conversion config: first batch of large legacy modules (legacy strictness).
const legacy = (runtime) => ({runtime, cls: 'auto', legacy: true});
export default {
  task: 'task962',
  title: 'storyboard view/worker, heat map, supporter credit and video info (legacy strictness)',
  modules: {
    StoryboardView: legacy('packages/zenza/src/storyboard/StoryboardView.js'),
    HeatMapWorker: legacy('packages/zenza/src/heatMap/HeatMapWorker.js'),
    SupporterCredit: legacy('packages/zenza/src/videoPlayer/SupporterCredit.js'),
    StoryboardWorker: legacy('packages/zenza/src/storyboard/StoryboardWorker.js'),
    VideoInfo: {...legacy('src/VideoInfo.js'), rep: [
      // Task962 (VIDEOINFO-DUP-GETTER-001): DmcInfo defined contentKeyTimeout twice; only the
      // later getter (with the 600s default) ever took effect. Drop the shadowed one.
      ['  get contentKeyTimeout() {\n    return this._session.contentKeyTimeout;\n  }\n', '', 1],
    ]},
  },
  allowlist: [
    ['^packages\\/(?:', '^(?:packages\\/(?:'],
    ['menu\\/HoverMenu))\\.js$', 'menu\\/HoverMenu))|src\\/(?:VideoInfo))\\.js$'],
    ['storyboard\\/(?:Storyboard|StoryboardInfoModel|SeekBarThumbnail)|',
      'storyboard\\/(?:Storyboard|StoryboardInfoModel|SeekBarThumbnail|StoryboardView|StoryboardWorker)|heatMap\\/HeatMapWorker|'],
    ['videoPlayer\\/(?:createVideoElement|YouTubeWrapper)|', 'videoPlayer\\/(?:createVideoElement|YouTubeWrapper|SupporterCredit)|'],
  ],
};
