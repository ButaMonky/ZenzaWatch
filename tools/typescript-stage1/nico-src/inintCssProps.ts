/**
 * Canonical TypeScript source for packages/zenza/src/init/inintCssProps.js (Task901).
 */
/**
 * Playlist items wrap raw API/storage records of several formats and are shared with
 * views and other modules that are still JS; this one documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
/** The parts of cssUtil, CONSTANT and global used here. */
declare const cssUtil: {
  addStyle(styles: string, options: {className: string; disabled: boolean}): HTMLStyleElement;
  registerProps(...defs: Loose[]): unknown;
  setProps(...entries: Loose[]): unknown;
  number(v: number): unknown;
  px(v: number): unknown;
};
declare const CONSTANT: {SIDE_PLAYER_WIDTH: number};
declare const global: {innerWidth: number; innerHeight: number};

const initCssProps = (win?: Loose) => {
  win = win || window;
  const LEN = '<length>';
  const LP = '<length-percentage>';
  const CL = '<color>';
  const NUM = '<number>';
  const TP = 'transparent';
  const inherits = true;
  cssUtil.registerProps(
    {name: '--zenza-ui-scale', window: win,
      syntax: NUM, initialValue: cssUtil.number(1), inherits},
    {name: '--zenza-control-bar-height', window: win,
      syntax: LEN, initialValue: cssUtil.px(48), inherits},
    {name: '--zenza-comment-layer-opacity', window: win,
      syntax: NUM, initialValue: cssUtil.number(1),  inherits},
    {name: '--zenza-comment-panel-header-height', window: win,
      syntax: LEN, initialValue: cssUtil.px(64), inherits},
    {name: '--sideView-left-margin', window: win,
      syntax: LP, initialValue: cssUtil.px(CONSTANT.SIDE_PLAYER_WIDTH + 24), inherits},
    {name: '--sideView-top-margin', window: win,
      syntax: LP, initialValue: cssUtil.px(76), inherits},
    {name: '--base-bg-color', window: win,
      syntax: CL, initialValue: TP, inherits},
    {name: '--base-fore-color', window: win,
      syntax: CL, initialValue: TP, inherits},
    {name: '--light-text-color', window: win,
      syntax: CL, initialValue: TP, inherits},
    {name: '--scrollbar-bg-color', window: win,
      syntax: CL, initialValue: TP, inherits},
    {name: '--scrollbar-thumb-color', window: win,
      syntax: CL, initialValue: TP, inherits},
    {name: '--item-border-color', window: win,
      syntax: CL, initialValue: TP, inherits},
    {name: '--hatsune-color', window: win,
      syntax: CL, initialValue: TP, inherits},
    {name: '--enabled-button-color', window: win,
      syntax: CL, initialValue: TP, inherits}
  );
  cssUtil.setProps(
    [document.documentElement, '--inner-width', cssUtil.number(global.innerWidth)],
    [document.documentElement, '--inner-height', cssUtil.number(global.innerHeight)]
  );
};

export {initCssProps};
