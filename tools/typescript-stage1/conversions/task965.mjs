// Task965 conversion config: the remaining large //===BEGIN=== modules (legacy strictness).
// Skipped on purpose: DataStorage (also bundled in MylistPocket, Pocket lane), DialogElement
// (also bundled in ZenzaHLS), sceneSearch/* (SCUI lane), entry files without //===BEGIN===.
const legacy = (runtime) => ({runtime, cls: 'auto', legacy: true});
export default {
  task: 'task965',
  title: 'shortcut actions, elements, dispatcher, initializer, state and comment player (legacy strictness)',
  modules: {
    ShortcutActions: legacy('packages/zenza/src/ShortcutActions.js'),
    PipPageThumbnail: legacy('packages/zenza/src/videoPlayer/PipPageThumbnail.js'),
    BaseCommandElement: legacy('packages/components/src/element/BaseCommandElement.js'),
    SettingPanelElement: legacy('packages/components/src/element/SettingPanelElement.js'),
    VideoItemElement: legacy('packages/components/src/element/VideoItemElement.js'),
    RootDispatcher: legacy('src/RootDispatcher.js'),
    initializer: legacy('src/initializer.js'),
    State: legacy('src/State.js'),
    CommentPlayer: legacy('src/CommentPlayer.js'),
  },
  allowlist: [
    ['videoPlayer\\/(?:createVideoElement|YouTubeWrapper|SupporterCredit|ScreenFilter)',
      'videoPlayer\\/(?:createVideoElement|YouTubeWrapper|SupporterCredit|ScreenFilter|PipPageThumbnail)'],
    ['ShortcutKeyEmitter|menu\\/HoverMenu))',
      'ShortcutKeyEmitter|ShortcutActions|menu\\/HoverMenu)|components\\/src\\/element\\/(?:BaseCommandElement|SettingPanelElement|VideoItemElement))'],
    ['src\\/(?:VideoInfo|TagListView|CommentInputPanel|CommentPanel|NicoVideoPlayer|VideoControlBar|VideoInfoPanel|NicoVideoPlayerDialog))\\.js$',
      'src\\/(?:VideoInfo|TagListView|CommentInputPanel|CommentPanel|NicoVideoPlayer|VideoControlBar|VideoInfoPanel|NicoVideoPlayerDialog|RootDispatcher|initializer|State|CommentPlayer))\\.js$'],
  ],
};
