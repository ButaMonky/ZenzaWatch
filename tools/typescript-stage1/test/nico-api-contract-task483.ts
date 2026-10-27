// Task483: raw acknowledgement is unknown until the typed decoder succeeds.
import {CommentPostWire} from '../nico-src/CommentPostWire';
import type {AcceptedPostAcknowledgement} from '../nico-src/CommentPostWire';
declare const payload: unknown;
const accepted: AcceptedPostAcknowledgement | null = CommentPostWire.parseAcknowledgement(payload);
if (accepted) {
  const no: number = accepted.no;
  const id: unknown = accepted.id;
  void no; void id;
}
// @ts-expect-error a failed validation cannot be assumed to be a confirmed post
const unconditional: AcceptedPostAcknowledgement = CommentPostWire.parseAcknowledgement(payload);
void unconditional;
// @ts-expect-error normalized comment number is numeric
const malformed: AcceptedPostAcknowledgement = {no: '7', id: undefined};
void malformed;
