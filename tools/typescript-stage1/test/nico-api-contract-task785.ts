// Task785: compile-only contracts for the dom / text / ui helpers.
import {ClassList} from '../nico-src/ClassList';
import {Clipboard} from '../nico-src/Clipboard';
import {domEvent} from '../nico-src/domEvent';
import {domUtil} from '../nico-src/domUtil';
import {watchResize} from '../nico-src/watchResize';
import {Fullscreen} from '../nico-src/Fullscreen';
import {textUtil} from '../nico-src/textUtil';
import {PopupMessage} from '../nico-src/PopupMessage';

const list: DOMTokenList = ClassList(document.body);
void list;
void Clipboard.copyText('text');
// @ts-expect-error text is a string
void Clipboard.copyText(1);
domEvent.dispatchCommand(document.body, 'play', 1);
const button: HTMLElement = domUtil.create('button', {dataset: {command: 'play'}, style: {color: 'red'}});
void button;
watchResize(document.body, () => undefined);
const full: boolean = Fullscreen.now();
void full;
void Fullscreen.request('player');
const time: string = textUtil.secToTime(75);
void time;
// @ts-expect-error seconds are numbers
textUtil.secToTime('75');
const query: Record<string, string> = textUtil.parseQuery('?a=1');
void query;
const date: string = textUtil.dateToString(Date.now());
void date;
PopupMessage.notify('saved');
PopupMessage.alert('<b>x</b>', true);
// @ts-expect-error the message is text
PopupMessage.notify(1);
