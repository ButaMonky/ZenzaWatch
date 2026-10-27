// Task477: compile-only contracts for NicoVideoApi.
import {NicoVideoApi} from '../nico-src/NicoVideoApi';

const response: Promise<Response> = NicoVideoApi.fetch('https://www.nicovideo.jp/', {credentials: 'include'});
void response;
void NicoVideoApi.pushHistory('/watch/sm9', 'title');
const db: Promise<unknown> = NicoVideoApi.bridgeDb({name: 'watch'});
void db;
// @ts-expect-error fetch requires a URL string
void NicoVideoApi.fetch(1);
// @ts-expect-error history paths are strings
void NicoVideoApi.pushHistory(9);
