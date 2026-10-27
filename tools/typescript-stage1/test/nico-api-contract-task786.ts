// Task786: compile-only contracts for MediaTimeline and css.
import {MediaTimeline} from '../nico-src/MediaTimeline';
import {css, cssUtil} from '../nico-src/css';

const timeline = MediaTimeline.register('main');
const now: number = timeline.currentTime;
void now;
timeline.syncClock(10);
// @ts-expect-error the clock takes seconds as a number
timeline.syncClock('10');
const paused: boolean = MediaTimeline.get('main').paused;
void paused;

const style: HTMLStyleElement = css.addStyle('.a{}', 'id');
void style;
void css.setProps([document.body, '--x', 1]);
// @ts-expect-error a task is [element, property, value]
void css.setProps(['--x', 1]);
const px: unknown = cssUtil.px(3);
void px;
