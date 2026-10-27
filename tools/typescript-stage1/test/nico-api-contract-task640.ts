// Task640: compile-only contracts for netUtil.
import {netUtil} from '../nico-src/netUtil';

const controller = new AbortController();
const response: Promise<Response> = netUtil.fetch('https://www.nicovideo.jp/', {credentials: 'include', timeout: 5000, signal: controller.signal});
void response;
void netUtil.abortableFetch('https://nvapi.nicovideo.jp/v1/x', null);
void netUtil.abortableFetch('https://nvapi.nicovideo.jp/v1/x', {headers: {'X-Frontend-Id': 6}});
// @ts-expect-error timeout is a number of milliseconds
void netUtil.abortableFetch('https://nvapi.nicovideo.jp/v1/x', {timeout: '5s'});
// @ts-expect-error URLs are strings
void netUtil.fetch(new URL('https://www.nicovideo.jp/'));
const jsonp: Promise<unknown> = netUtil.jsonp('https://ext.nicovideo.jp/api', 'cb');
void jsonp;
// @ts-expect-error Task641 removed the unused ajax (NETUTIL-AJAX-001)
void netUtil.ajax({url: '/x'});
