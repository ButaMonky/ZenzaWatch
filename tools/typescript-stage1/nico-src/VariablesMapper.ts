/**
 * Canonical TypeScript source for src/VariablesMapper.js (Task1063: NicoVideoPlayerDialogView.ts から分割).
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// legacy-to-ts: names provided by other bundled modules
declare const Emitter: typeof import('./Emitter').Emitter;
declare const VideoControlBar: typeof import('./VideoControlBar').VideoControlBar;
declare const _: import('./shared-types/Lodash').LodashSubset;
declare const css: typeof import('./css').css;
declare const cssUtil: typeof import('./css').cssUtil;

class VariablesMapper {
  declare config: Loose;
  declare element: Loose;
  declare emitter: Loose;
  declare state: Loose;
  get nextState() {
    const {menuScale, commentLayerOpacity, fullscreenControlBarMode} = this.config.props;
    return {menuScale, commentLayerOpacity, fullscreenControlBarMode};
  }

  get videoControlBarHeight() {
    return(
      (VideoControlBar.BASE_HEIGHT - VideoControlBar.BASE_SEEKBAR_HEIGHT) *
        this.state.menuScale + VideoControlBar.BASE_SEEKBAR_HEIGHT);
  }

  constructor({config, element}: Loose){
    this.config = config;

    this.state = {
      menuScale: 0,
      commentLayerOpacity: 0,
      fullscreenControlBarMode: 'auto'
    };

    this.element = element || document.body;
    this.emitter = new Emitter();

    const update = _.debounce(this.update.bind(this), 500);
    Object.keys(this.state).forEach(key =>
      config.onkey(key, () => {
        // Toolbar-mode selection should apply immediately, not half a second later.
        if (key === 'fullscreenControlBarMode') {
          update.cancel();
          this.update();
        } else {
          update();
        }
      }));
    update();
  }

  on(...args: Loose[]) {
    this.emitter.on(...args);
  }

  shouldUpdate(state?: Loose, nextState?: Loose) {
    return Object.keys(state).some(key => state[key] !== nextState[key]);
  }

  setVar(key?: Loose, value?: Loose) {
    cssUtil.setProps([this.element, key, value]); }

  update() {
    const state = this.state;
    const nextState = this.nextState;

    if (!this.shouldUpdate(state, nextState)) {
      return;
    }

    const {menuScale, commentLayerOpacity, fullscreenControlBarMode} = nextState;

    this.state = nextState;
    Object.assign(this.element.dataset, {fullscreenControlBarMode});
    if (state.menuScale !== menuScale) {
      this.setVar('--zenza-ui-scale', menuScale);
      this.setVar('--zenza-control-bar-height', css.px(this.videoControlBarHeight));
    }
    if (state.commentLayerOpacity !== commentLayerOpacity) {
      this.setVar('--zenza-comment-layer-opacity', commentLayerOpacity);
    }
    this.emitter.emit('update', nextState);
  }

}

export {
  VariablesMapper
};
