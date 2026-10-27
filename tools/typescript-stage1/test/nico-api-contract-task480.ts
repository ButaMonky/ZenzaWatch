// Task480 compile-only playback-position protocol contract.
import {PlaybackPosition} from '../nico-src/PlaybackPosition';
import type {PlaybackPositionClient,PlaybackPositionReceipt} from '../nico-src/PlaybackPosition';

const client: PlaybackPositionClient = PlaybackPosition;
const receipt: Promise<PlaybackPositionReceipt> = client.record('sm9',12.5);
void receipt;
void client.record('nm12',0,null,null);
void client.record('so42',5,6,'0');
// @ts-expect-error invalid video id type
void client.record(42,12);
// @ts-expect-error invalid playback seconds type
void client.record('sm9','12');
// @ts-expect-error frontend id is a supported string/number/null
void client.record('sm9',12,{});
async function needsValidation(){
  const response=await client.record('sm9',1);
  const status: number=response.status;
  void status;
  // @ts-expect-error meta status is untrusted and cannot be assumed numeric
  const invalid: number=response.metaStatus;
  return invalid;
}
void needsValidation;
