// Task475: compile-only contracts for TagEditApi.
import {TagEditApi} from '../nico-src/TagEditApi';
import type {TagEditError, TagEditErrorKind} from '../nico-src/TagEditApi';

const api = new TagEditApi();
void api.load('sm9', 'KEY', {onEditKeyUpdate: (key: string) => void key.length});
void api.add({videoId: 'sm9', tag: 'tag', editKey: 'KEY'});
void api.remove({videoId: 'sm9', editKey: 'KEY', id: '55'});
// @ts-expect-error an edit key is required for every change
void api.add({videoId: 'sm9', tag: 'tag'});
// @ts-expect-error edit key callbacks receive a string key
void api.load('sm9', 'KEY', {onEditKeyUpdate: (key: number) => key});

async function tags(): Promise<number> {
  const data: unknown = await api.load('sm9', 'KEY');
  // @ts-expect-error tag data is unvalidated
  void data.tags;
  return data && typeof data === 'object' ? 1 : 0;
}
void tags;

function retryable(error: TagEditError): boolean {
  const kind: TagEditErrorKind = error.kind;
  return kind === 'KEY_EXPIRED';
}
void retryable;
