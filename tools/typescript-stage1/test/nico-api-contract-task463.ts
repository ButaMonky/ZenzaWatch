// Task463: compile-only contracts for TagSuggestLoader / PlaylistApiLoader.
import {TagSuggestLoader} from '../nico-src/TagSuggestLoader';
import {PlaylistApiLoader} from '../nico-src/PlaylistApiLoader';

// Suggestions are validated strings, so string methods are allowed.
async function first(): Promise<string> {
  const list: string[] = await TagSuggestLoader.load('東方');
  return list[0]?.toUpperCase() ?? '';
}
void first;
void TagSuggestLoader.load(null);
// @ts-expect-error a word must be text
void TagSuggestLoader.load(1);

// Playlist types are a closed set; items stay unknown until narrowed.
void PlaylistApiLoader.load({type: 'series', id: 1});
void PlaylistApiLoader.load({type: 'user-uploaded', id: '1', options: {page: 2}}, {frontendId: 6});
// @ts-expect-error unsupported playlist type
void PlaylistApiLoader.load({type: 'ranking'});
async function count(): Promise<number> {
  const items: unknown = await PlaylistApiLoader.load({type: 'watchlater'});
  // @ts-expect-error unknown items cannot be indexed directly
  void items.length;
  return Array.isArray(items) ? items.length : 0;
}
void count;
