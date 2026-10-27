// Task789: compile-only contracts for message/gate and message/messageUtil.
import {gate} from '../nico-src/gate';
import type {GateFetchResult} from '../nico-src/gate';
import {BroadcastEmitter, WindowMessageEmitter, messageUtil} from '../nico-src/messageUtil';

const api = gate();
const white: boolean = api.isWhiteHost('https://www.nicovideo.jp/');
void white;
const status: Promise<number> = api.uFetch({url: 'https://www.nicovideo.jp/', timeout: 1000}, resp => resp.status);
void status;
// @ts-expect-error uFetch needs a url
api.uFetch({timeout: 1000});
const fetched: Promise<GateFetchResult | void> = api.xFetch({url: 'https://www.nicovideo.jp/'}, 'session');
void fetched;
const port: MessagePort = api.post({command: 'hello'}, {sessionId: 's'});
void port;
const {TOKEN} = api.init({prefix: 'nicovideoApi'});
const token: string | null = TOKEN;
void token;
// @ts-expect-error init needs the window-name prefix
api.init({type: 'x'});

const same: boolean = messageUtil.BroadcastEmitter === BroadcastEmitter && messageUtil.WindowMessageEmitter === WindowMessageEmitter;
void same;
const known: number = WindowMessageEmitter.addKnownSource(window);
void known;
const pong: Promise<unknown> = BroadcastEmitter.sendMessagePromise({command: 'ping'}, 500);
void pong;
BroadcastEmitter.sendOpen('sm9', {query: {}});
// @ts-expect-error ping options take a numeric timeout
BroadcastEmitter.ping({timeout: '500'});
