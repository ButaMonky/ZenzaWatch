// Task481: compile-only contracts for GateAPI.
import {GateAPI} from '../nico-src/GateAPI';
import type {GateMessage, GateParams} from '../nico-src/GateAPI';

GateAPI.nicovideo();
GateAPI.search();
GateAPI.nicodic();
GateAPI.smile();
const started: Promise<void> = GateAPI.thumbInfo();
void started;
// @ts-expect-error exApi never existed; Task641 removed the dead src/boot.js call (GATE-EXAPI-001)
GateAPI.exApi();

const request: GateMessage = {body: {command: 'fetch', params: {url: 'https://ext.nicovideo.jp/api/getthumbinfo/sm9'}}, token: 'T'};
void request;
// @ts-expect-error a gate message always carries a command
const bad: GateMessage = {body: {params: {}}};
void bad;
const db: GateParams = {command: 'get', params: {name: 'cache', storeName: 'video', data: {key: 'k'}}};
void db;
