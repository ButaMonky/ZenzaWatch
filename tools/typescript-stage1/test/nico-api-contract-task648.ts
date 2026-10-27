// Task648: compile-only contracts for ThreadLoader.
import {ThreadLoader} from '../nico-src/ThreadLoader';
import type {CommentMsgInfo, ThreadLoadResult, PostResult} from '../nico-src/ThreadLoader';

declare const msgInfo: CommentMsgInfo;
void (async () => {
  const loaded: ThreadLoadResult = await ThreadLoader.load(msgInfo, {signal: new AbortController().signal});
  const total: number = loaded.threadInfo.totalResCount;
  void total;
  const posted: PostResult = await ThreadLoader.postChat(msgInfo, 'text', '184', 120);
  const no: number = posted.no;
  void no;
  // @ts-expect-error a comment body is a string
  void ThreadLoader.postChat(msgInfo, 42);
  // @ts-expect-error load options do not take arbitrary keys
  void ThreadLoader.load(msgInfo, {timeout: 1});
})();
