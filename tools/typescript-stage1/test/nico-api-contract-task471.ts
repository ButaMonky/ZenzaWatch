// Task471: compile-only contracts for MylistApiLoader.
import {MylistApiLoader} from '../nico-src/MylistApiLoader';
import type {MylistError, MylistOk} from '../nico-src/MylistApiLoader';

async function add(): Promise<string> {
  const ok: MylistOk = await MylistApiLoader.addDeflistItem('sm9', 'memo');
  return ok.status === 'ok' ? ok.message : '';
}
void add;
void MylistApiLoader.addMylistItem('sm9', 7, null, {frontendId: 6});
void MylistApiLoader.removeMylistItem('sm9', '7');
// @ts-expect-error a group ID is required to remove from a mylist
void MylistApiLoader.removeMylistItem('sm9');
// @ts-expect-error frontend options use numbers
void MylistApiLoader.getMylistList({frontendId: '6'});

async function lists(): Promise<number> {
  const data: unknown = await MylistApiLoader.getMylistList();
  // @ts-expect-error mylists are unvalidated
  void data.length;
  return Array.isArray(data) ? data.length : 0;
}
void lists;

function describe(error: MylistError): string {
  return `${error.status}:${String(error.code)}`;
}
void describe;
