/**
 * Canonical TypeScript source for AdDecorationLoader.js (Task468).
 * Preserve request batching, up to 3 workers, no cache and retryable failed chunks.
 */
import type {NetUtilFetcher} from './NicoApiTypes';
declare const netUtil: NetUtilFetcher;

export interface AdDecorationProgress {
  checked: number;
  total: number;
}
export type AdDecorationProgressListener = (progress: AdDecorationProgress) => void;
/** Server decorations are kept unknown: legacy code forwards truthy values verbatim. */
export interface AdDecorationEntry {
  id: unknown;
  decoration: unknown;
}
export interface AdDecorationEnvelope {
  data?: { contents?: AdDecorationEntry[] };
}
export interface AdDecorationClient {
  load(watchIds: readonly string[] | null | undefined): Promise<Map<string, unknown>>;
  loadFresh(watchIds: readonly string[] | null | undefined, onProgress?: AdDecorationProgressListener | null): Promise<Map<string, unknown>>;
}

const AdDecorationLoader: AdDecorationClient = (() => {
  const API_BASE = 'https://api.nicoad.nicovideo.jp/v1/contents/video/decoration';
  const MAX_IDS_PER_REQUEST = 100;
  const MAX_URL_LENGTH = 2000;
  const CONCURRENCY = 3;

  const splitChunks = (ids: string[]): string[][] => {
    const chunks: string[][] = [];
    let current: string[] = [];
    let length = API_BASE.length + '?ids='.length;
    for (const id of ids) {
      const add = (current.length ? 1 : 0) + id.length;
      if (current.length && (current.length >= MAX_IDS_PER_REQUEST || length + add > MAX_URL_LENGTH)) {
        chunks.push(current);
        current = [];
        length = API_BASE.length + '?ids='.length;
      }
      length += (current.length ? 1 : 0) + id.length;
      current.push(id);
    }
    if (current.length) {
      chunks.push(current);
    }
    return chunks;
  };

  class AdDecorationLoader {
    async _fetchChunk(ids: string[]): Promise<AdDecorationEntry[]> {
      const url = `${API_BASE}?ids=${ids.join(',')}`;
      const res = await netUtil.fetch(url, {credentials: 'omit'});
      if (!res.ok) {
        throw new Error(`広告装飾の取得に失敗 (${res.status})`);
      }
      // No runtime schema normalization: preserve legacy response and failures.
      const json = await res.json() as AdDecorationEnvelope | null;
      return (json && json.data && json.data.contents) || [];
    }

    async _loadChunked(
      watchIds: readonly string[] | null | undefined,
      onProgress: AdDecorationProgressListener | null | undefined,
      warnPrefix: string
    ): Promise<Map<string, unknown>> {
      const uniqIds = [...new Set((watchIds || []).filter(Boolean).map(String))];
      const result = new Map<string, unknown>();
      const total = uniqIds.length;
      let checked = 0;
      const chunks = splitChunks(uniqIds);
      let next = 0;
      const worker = async (): Promise<void> => {
        while (next < chunks.length) {
          const chunk = chunks[next++]!;
          let contents: AdDecorationEntry[];
          try {
            contents = await this._fetchChunk(chunk);
          } catch (e) {
            window.console.warn(`${warnPrefix}（このチャンクは今回スキップ）`, e);
            checked += chunk.length;
            if (onProgress) {
              onProgress({checked, total});
            }
            continue;
          }
          const byId = new Map<string, unknown>(
            contents.map(c => [String(c.id), c.decoration] as const)
          );
          for (const id of chunk) {
            result.set(id, byId.get(id) || 'normal');
          }
          checked += chunk.length;
          if (onProgress) {
            onProgress({checked, total});
          }
        }
      };
      await Promise.all(
        Array.from({length: Math.min(CONCURRENCY, chunks.length)}, () => worker())
      );
      return result;
    }

    async load(watchIds: readonly string[] | null | undefined): Promise<Map<string, unknown>> {
      return this._loadChunked(watchIds, null, '広告装飾の取得に失敗');
    }

    async loadFresh(
      watchIds: readonly string[] | null | undefined,
      onProgress?: AdDecorationProgressListener | null
    ): Promise<Map<string, unknown>> {
      return this._loadChunked(watchIds, onProgress, '[デバッグ全件チェック] 広告装飾の取得に失敗');
    }
  }

  return new AdDecorationLoader();
})();

export {AdDecorationLoader};
