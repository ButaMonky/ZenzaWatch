// Task645: compile-only contracts for parseThumbInfo.
import {parseThumbInfo} from '../nico-src/parseThumbInfo';
import type {ThumbInfoResult, ThumbInfoData} from '../nico-src/parseThumbInfo';

const parsed: ThumbInfoResult = parseThumbInfo('<nicovideo_thumb_response status="ok"/>');
if (parsed.status === 'ok') {
  const data: ThumbInfoData = parsed;
  const watchId: string = data.v;
  void watchId;
  // @ts-expect-error owner may be absent (deleted/private owner)
  const ownerName: string = data.owner.name;
  void ownerName;
} else {
  const code: string | null = parsed.code;
  void code;
  // @ts-expect-error failures carry no thumbInfo fields
  void parsed.title;
}
// Already-parsed values pass through with their own type.
const same: {status: 'ok'; v: string} = parseThumbInfo({status: 'ok' as const, v: 'sm9'});
void same;
