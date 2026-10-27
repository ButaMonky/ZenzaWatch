// Task478: callers may observe only a JSON result of unknown shape.
import {CommentPostWire} from '../nico-src/CommentPostWire';
import type {PostWireFailureKind, PostWireFailure} from '../nico-src/CommentPostWire';

const pending: Promise<unknown> = CommentPostWire.fetchJsonWithin(
  new URL('https://comments.invalid/v1/threads/1/comments'),
  {method: 'POST', credentials: 'include', body: '{}'}, 30000
);
void pending;
void CommentPostWire.fetchJsonWithin('/comments', {method: 'POST'});
const kind: PostWireFailureKind = 'header-timeout';
const err: PostWireFailure = Object.assign(new Error('failed'), {kind});
void err;
// @ts-expect-error unknown body cannot be assumed to be a successful acknowledgement
const wrong: Promise<{no: number}> = CommentPostWire.fetchJsonWithin('/comments', {});
void wrong;
// @ts-expect-error timeout is expressed in milliseconds, not a string
void CommentPostWire.fetchJsonWithin('/comments', {}, '30000');
// @ts-expect-error request body must be a valid BodyInit
void CommentPostWire.fetchJsonWithin('/comments', {body: {postKey: 'unsafe'}});
