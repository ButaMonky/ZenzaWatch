// Task487: POST key and packet are typed at the network boundary.
import {CommentPostWire} from '../nico-src/CommentPostWire';
import type {CommentPostPacket, CommentPostPacketInput} from '../nico-src/CommentPostWire';

declare const serverReply: unknown;
const key: string | null = CommentPostWire.readPostKey(serverReply);
if (key) {
  const opts: CommentPostPacketInput = {
    text: 'fixture', cmd: 'red', vpos: 12.5, postKey: key, videoId: 'sm9'
  };
  const packet: CommentPostPacket = CommentPostWire.buildPacket(opts);
  const serialized: string = packet.packet;
  const count: number = packet.commandCount;
  void serialized; void count;
}
void key;
// @ts-expect-error unknown response is not a verified posting key
const unsafe: string = serverReply;
void unsafe;
// @ts-expect-error postKey must be a string, not an arbitrary API response
void CommentPostWire.buildPacket({text: 'x', postKey: serverReply, videoId: 'sm9'});
// @ts-expect-error playback position must be numeric
void CommentPostWire.buildPacket({text: 'x', postKey: 'k', videoId: 'sm9', vpos: '20'});
