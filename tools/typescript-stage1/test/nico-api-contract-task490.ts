// Task490: callsite may request a post-key but cannot trust the JSON schema.
import {CommentPostWire} from '../nico-src/CommentPostWire';

const raw: Promise<unknown> = CommentPostWire.getPostKey(12, 'ja-jp');
void raw;
void CommentPostWire.getPostKey('123');
const data: unknown = await CommentPostWire.getPostKey(15,'zh-tw');
const key: string | null = CommentPostWire.readPostKey(data);
void key;
// @ts-expect-error a post-key response cannot be assumed to be a string
const unsafe: Promise<string> = CommentPostWire.getPostKey('123');
void unsafe;
// @ts-expect-error threadId is a string or number
void CommentPostWire.getPostKey({id: 1}, 'ja-jp');
// @ts-expect-error language is a string
void CommentPostWire.getPostKey(12, 99);
