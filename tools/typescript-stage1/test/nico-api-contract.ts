// Task457: compile-only contract checks for migrated NicoNico API types.
// Nothing here runs or touches the network.
import {LikeApi} from '../nico-src/LikeApi';
import type {LikeApiError, LikeApiResult} from '../nico-src/LikeApi';
import {NVApi} from '../nico-src/NVApi';
import type {NicoApiErrorKind, NetFetchOptions} from '../nico-src/NicoApiTypes';

// NVApi exposes transport failure as `undefined`, never as a fake Response.
const nv: Promise<Response | undefined> = NVApi.call('https://nvapi.nicovideo.jp/v1/x', {method: 'POST'});
void nv;
// @ts-expect-error a Response must not be assumed after NVApi.call
const nvResponse: Promise<Response> = NVApi.call('https://nvapi.nicovideo.jp/v1/x');
void nvResponse;

// Like supports only the verbs verified for /v1/users/me/likes/items.
void LikeApi.call('sm9', 'POST');
void LikeApi.call('sm9', 'DELETE');
// @ts-expect-error PATCH is not a supported Like method
void LikeApi.call('sm9', 'PATCH');
// @ts-expect-error video IDs are strings in every caller
void LikeApi.like(9);

// Server bodies are unknown until narrowed by the caller.
async function readThanks(): Promise<string> {
  const result: LikeApiResult = await LikeApi.like('sm9');
  // @ts-expect-error unvalidated server body cannot be dereferenced directly
  void result.data;
  if (result && typeof result === 'object' && 'data' in result) {
    const data: unknown = result.data;
    if (data && typeof data === 'object' && 'thanksMessage' in data) {
      return typeof data.thanksMessage === 'string' ? data.thanksMessage : '';
    }
  }
  return '';
}
void readThanks;

// Error classification is a closed union.
function kindOf(error: LikeApiError): NicoApiErrorKind {
  const kind: 'NETWORK' | 'API' = error.kind;
  return kind;
}
void kindOf;

// exactOptionalPropertyTypes: optional fetch options cannot be explicit undefined.
const options: NetFetchOptions = {timeout: 5000, credentials: 'include'};
void options;
// @ts-expect-error timeout must be a number when present
const badOptions: NetFetchOptions = {timeout: '5000'};
void badOptions;
