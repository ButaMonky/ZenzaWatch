import {cssUtil} from '../../../lib/src/css/css';
import {CONSTANT} from '../../../../src/constant';
import {global} from '../../../../src/ZenzaWatchIndex';
// GENERATED FROM tools/typescript-stage1/nico-src/inintCssProps.ts (Task901). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const initCssProps = (win) => {
    win = win || window;
    const LEN = '<length>';
    const LP = '<length-percentage>';
    const CL = '<color>';
    const NUM = '<number>';
    const TP = 'transparent';
    const inherits = true;
    cssUtil.registerProps({ name: '--zenza-ui-scale', window: win,
        syntax: NUM, initialValue: cssUtil.number(1), inherits }, { name: '--zenza-control-bar-height', window: win,
        syntax: LEN, initialValue: cssUtil.px(48), inherits }, { name: '--zenza-comment-layer-opacity', window: win,
        syntax: NUM, initialValue: cssUtil.number(1), inherits }, { name: '--zenza-comment-panel-header-height', window: win,
        syntax: LEN, initialValue: cssUtil.px(64), inherits }, { name: '--sideView-left-margin', window: win,
        syntax: LP, initialValue: cssUtil.px(CONSTANT.SIDE_PLAYER_WIDTH + 24), inherits }, { name: '--sideView-top-margin', window: win,
        syntax: LP, initialValue: cssUtil.px(76), inherits }, { name: '--base-bg-color', window: win,
        syntax: CL, initialValue: TP, inherits }, { name: '--base-fore-color', window: win,
        syntax: CL, initialValue: TP, inherits }, { name: '--light-text-color', window: win,
        syntax: CL, initialValue: TP, inherits }, { name: '--scrollbar-bg-color', window: win,
        syntax: CL, initialValue: TP, inherits }, { name: '--scrollbar-thumb-color', window: win,
        syntax: CL, initialValue: TP, inherits }, { name: '--item-border-color', window: win,
        syntax: CL, initialValue: TP, inherits }, { name: '--hatsune-color', window: win,
        syntax: CL, initialValue: TP, inherits }, { name: '--enabled-button-color', window: win,
        syntax: CL, initialValue: TP, inherits });
    cssUtil.setProps([document.documentElement, '--inner-width', cssUtil.number(global.innerWidth)], [document.documentElement, '--inner-height', cssUtil.number(global.innerHeight)]);
};
//===END===
export {
  initCssProps
};
