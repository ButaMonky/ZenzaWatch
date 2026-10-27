// Task498: nvComment server JSON remains unknown after validating read targets.
import {CommentReadAdapter} from '../nico-src/CommentReadAdapter';

declare const payload: unknown;
declare const messageInfo: unknown;
const key: unknown = CommentReadAdapter.threadKey(payload);
const threads: unknown = CommentReadAdapter.threads(payload, messageInfo);
void key; void threads;
// @ts-expect-error a validated thread-key envelope is still not guaranteed as a typed string
const unsafeKey: {threadKey: string} = CommentReadAdapter.threadKey(payload);
void unsafeKey;
// @ts-expect-error raw server comment lists must not be assumed correctly shaped
const unsafeThreads: {threads: Array<{id: string}>} = CommentReadAdapter.threads(payload,messageInfo);
void unsafeThreads;
// @ts-expect-error thread validation needs corresponding expected message targets
void CommentReadAdapter.threads(payload);
