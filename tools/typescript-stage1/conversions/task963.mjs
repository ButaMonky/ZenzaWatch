// Task963 conversion config: second batch of large legacy modules (legacy strictness).
const legacy = (runtime) => ({runtime, cls: 'auto', legacy: true});
export default {
  task: 'task963',
  title: 'screen filter, tag list, comment input/panel and video player (legacy strictness)',
  modules: {
    ScreenFilter: legacy('packages/zenza/src/videoPlayer/ScreenFilter.js'),
    TagListView: legacy('src/TagListView.js'),
    CommentInputPanel: legacy('src/CommentInputPanel.js'),
    CommentPanel: legacy('src/CommentPanel.js'),
    NicoVideoPlayer: legacy('src/NicoVideoPlayer.js'),
  },
  allowlist: [
    ['videoPlayer\\/(?:createVideoElement|YouTubeWrapper|SupporterCredit)|',
      'videoPlayer\\/(?:createVideoElement|YouTubeWrapper|SupporterCredit|ScreenFilter)|'],
    ['src\\/(?:VideoInfo))\\.js$', 'src\\/(?:VideoInfo|TagListView|CommentInputPanel|CommentPanel|NicoVideoPlayer))\\.js$'],
  ],
};
