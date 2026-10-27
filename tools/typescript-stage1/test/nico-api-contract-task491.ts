// Task491: submitting a comment returns untrusted JSON for ACK validation.
import {CommentPostWire} from '../nico-src/CommentPostWire';

const raw: Promise<unknown> = CommentPostWire.postComment(
  new URL('https://comments.invalid/v1/threads/10/comments'),
  JSON.stringify({body:'fixture',postKey:'fixture-key'})
);
void raw;
// @ts-expect-error server response cannot be assumed to contain a comment number
const confirmed: Promise<{no: number}> = CommentPostWire.postComment('/comments', '{}');
void confirmed;
// @ts-expect-error body must already be a JSON string
void CommentPostWire.postComment('/comments', {body:'fixture'});
// @ts-expect-error URL must be a string or URL
void CommentPostWire.postComment(55, '{}');
