/**
 * Canonical TypeScript source for packages/lib/src/nico/NicoVideoApi.js (Task477).
 * Cross-domain bridge to www.nicovideo.jp (robots.txt iframe) used by netUtil,
 * messageUtil, history, config sync and IndexedDB bridges when ZenzaWatch runs
 * on other NicoNico hosts.
 */
import type {NetFetchOptions} from './NicoApiTypes';

export interface CrossDomainGateOptions {
  baseUrl: string;
  origin: string;
  type: string;
  suffix?: string;
}
export interface GateCommandBody {
  command: string;
  status?: unknown;
  params?: unknown;
  value?: unknown;
}
interface ConfigSyncParams {
  key: string;
  value: unknown;
}

/** packages/lib/src/infra/CrossDomainGate.js (only what this module relies on). */
declare class CrossDomainGate {
  constructor(options: CrossDomainGateOptions);
  _config: {props: Record<string, unknown>};
  _onCommand(body: GateCommandBody, sessionId?: string | null): unknown;
  fetch(url: string, options?: NetFetchOptions): Promise<Response>;
  configBridge(config: unknown): unknown;
  postMessage(...args: unknown[]): unknown;
  sendMessage(...args: unknown[]): unknown;
  pushHistory(path: string, title?: string): unknown;
  bridgeDb(...args: unknown[]): Promise<unknown>;
}

export interface NicoVideoApiClient {
  fetch(...args: Parameters<CrossDomainGate['fetch']>): Promise<Response>;
  configBridge(...args: Parameters<CrossDomainGate['configBridge']>): unknown;
  postMessage(...args: unknown[]): unknown;
  sendMessage(...args: unknown[]): unknown;
  pushHistory(...args: Parameters<CrossDomainGate['pushHistory']>): unknown;
  bridgeDb(...args: unknown[]): Promise<unknown>;
}

const NicoVideoApi: NicoVideoApiClient = (() => {
  let gate: CrossDomainGate | null = null;
  const init = (): CrossDomainGate => {
    if (gate) { return gate; }

    // Legacy: on www.nicovideo.jp itself no bridge is needed and the gate is an
    // empty object, so calling these methods there throws TypeError (callers
    // only use NicoVideoApi on other hosts). Kept as-is.
    if (location.host === 'www.nicovideo.jp') {
      return gate = {} as CrossDomainGate;
    }
    class NVGate extends CrossDomainGate {
      _onCommand({command, status, params, value}: GateCommandBody, sessionId: string | null = null): unknown {
        switch (command) {
          case 'configSync':
              this._config.props[(params as ConfigSyncParams).key] = (params as ConfigSyncParams).value;
            break;
          default:
            return super._onCommand({command, status, params, value}, sessionId);
        }
        return undefined;
      }
    }

    return gate = new NVGate({
      baseUrl: 'https://www.nicovideo.jp/robots.txt',
      origin: 'https://www.nicovideo.jp/',
      type: 'nicovideoApi',
      suffix: location.href
    });
  };

  return {
    fetch(...args: Parameters<CrossDomainGate['fetch']>): Promise<Response> { return init().fetch(...args); },
    configBridge(...args: Parameters<CrossDomainGate['configBridge']>): unknown { return init().configBridge(...args); },
    postMessage(...args: unknown[]): unknown { return init().postMessage(...args); },
    sendMessage(...args: unknown[]): unknown { return init().sendMessage(...args); },
    pushHistory(...args: Parameters<CrossDomainGate['pushHistory']>): unknown { return init().pushHistory(...args); },
    bridgeDb(...args: unknown[]): Promise<unknown>    { return init().bridgeDb(...args); }
  };

})();

export {NicoVideoApi};
