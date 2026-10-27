// Task488: only a successful, validated nvComment envelope exposes unknown data.
import {CommentPostWire} from '../nico-src/CommentPostWire';

declare const networkResponse: unknown;
const body: unknown = CommentPostWire.unwrapApiEnvelope(networkResponse);
void body;
// @ts-expect-error response JSON remains unknown after meta validation
const confirmedNo: number = CommentPostWire.unwrapApiEnvelope(networkResponse);
void confirmedNo;
// @ts-expect-error cannot assume postKey exists in arbitrary API response
const postKey: {postKey: string} = CommentPostWire.unwrapApiEnvelope(networkResponse);
void postKey;
// The separate posting decoder must validate successful ACK fields.
const accepted = CommentPostWire.parseAcknowledgement(body);
if (accepted) {
  const no: number = accepted.no;
  void no;
}
