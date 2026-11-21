/** Task469: typed gateway boundary for legacy thumbnail XML lookup. */
declare const RequestDiagnostics: typeof import('./RequestDiagnostics').RequestDiagnostics;
export interface ThumbInfoGatewayResult {
  status: string;
  readonly [key: string]: unknown;
}
export interface ThumbInfoSuccess extends ThumbInfoGatewayResult {
  status: 'ok';
}
interface ThumbInfoGate {
  fetch(url: string, options: {_format: 'text'; expireTime: number}): Promise<ThumbInfoGatewayResult>;
}
export interface ThumbInfoLoaderClient {
  /** On first creation legacy initGate() returns undefined; subsequent calls return the gate. */
  initGate(): ThumbInfoGate | undefined;
  load(watchId: string): Promise<ThumbInfoSuccess>;
}
declare const CrossDomainGate: new(options: {
  baseUrl: string; origin: string; type: 'thumbInfo';
}) => ThumbInfoGate;

const ThumbInfoLoader: ThumbInfoLoaderClient = (() => {
  const BASE_URL = 'https://ext.nicovideo.jp/';
  const MESSAGE_ORIGIN = 'https://ext.nicovideo.jp/';
  let gate: ThumbInfoGate | null = null;
  const initGate = () => {
    if (gate) { return gate; }
    gate = new CrossDomainGate({
      baseUrl: BASE_URL,
      origin: MESSAGE_ORIGIN,
      type: 'thumbInfo'
    });
    return undefined;
  };

  const load = async (watchId: string): Promise<ThumbInfoSuccess> => {
    initGate();
    const url = `${BASE_URL}api/getthumbinfo/${watchId}`;
    const ticket = typeof RequestDiagnostics === 'undefined' ? null :
      RequestDiagnostics.begin('thumb-info',watchId,'response',undefined,undefined,{url,method:'GET'});
    const thumbInfo = await gate!.fetch(url,
        {_format: 'text', expireTime: 24 * 60 * 60 * 1000})
        .catch((e: {message?: unknown}) => {
          ticket?.failure(e);
          throw {status:'fail', message:e?.message || `gate.fetch('${watchId}') failed`};
        });
    if (thumbInfo?.status !== 'ok') {
      const code = thumbInfo?.code;
      ticket?.failure(code === 'DELETED' || code === 'NOT_FOUND' ? {reason:'not found'} :
        typeof code === 'string' && code !== 'INVALID_RESPONSE' ? {kind:'service',errorCode:code} :
        {kind:'schema',missing:'thumb.status'});
      return Promise.reject(thumbInfo ?? {status:'fail',code:'INVALID_RESPONSE'});
    }
    ticket?.success();
    return thumbInfo as ThumbInfoSuccess;
  };
  return {initGate, load};
})();

export {ThumbInfoLoader};
