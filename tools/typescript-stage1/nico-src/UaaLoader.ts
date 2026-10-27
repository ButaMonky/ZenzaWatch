/**
 * Canonical UaaLoader source (Task470).
 * Preserve the nicoad thanks endpoint, credential mode, default limit and abort forwarding.
 * The API body remains unknown until validated at its consumer boundary.
 */
import type {NetUtilFetcher} from './NicoApiTypes';

declare const netUtil: NetUtilFetcher;

export interface UaaLoadOptions {
  limit?: number;
  signal?: AbortSignal | undefined;
}

export interface UaaLoaderClient {
  load(videoId: string, options?: UaaLoadOptions): Promise<unknown>;
}

const UaaLoader: UaaLoaderClient = {
  load: (videoId: string, {limit = 50, signal}: UaaLoadOptions = {}): Promise<unknown> => {
    const url = `https://api.nicoad.nicovideo.jp/v1/contents/video/${videoId}/thanks?limit=${limit}`;
    return netUtil.fetch(url, {credentials: 'include', signal}).then((res: Response): Promise<unknown> => res.json());
  }
};

export {UaaLoader};
