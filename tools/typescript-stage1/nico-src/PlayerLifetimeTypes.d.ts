/**
 * Task186: compile-time lifetime identities for the two player layers.
 *
 * These are phantom/branded types: the actual runtime values remain numbers
 * (video source generations) and strings (dialog requests). They distinguish
 * three independent asynchronous ownership domains without changing runtime.
 */
declare const zenzaVideoSetGenerationBrand: unique symbol;
declare const zenzaElementSourceGenerationBrand: unique symbol;
declare const zenzaDialogRequestIdBrand: unique symbol;

export type ZenzaVideoSetGeneration = number & {
  readonly [zenzaVideoSetGenerationBrand]: 'video-set';
};
export type ZenzaElementSourceGeneration = number & {
  readonly [zenzaElementSourceGenerationBrand]: 'element-source';
};
export type ZenzaDialogRequestId = string & {
  readonly [zenzaDialogRequestIdBrand]: 'dialog-request';
};

export type ZenzaPlaylistLoadResult =
  | Readonly<{status: 'ok'; message: string}>
  | Readonly<{status: 'fail'; message: string}>
  | Readonly<{status: 'superseded'; message: string}>;

/** The only playlist methods an in-flight dialog callback is permitted to use. */
export interface ZenzaPlaylistLoadPort {
  readonly isEnable: boolean;
  load(
    query: unknown, options: unknown, msgInfo: unknown,
    isCurrent: () => boolean
  ): Promise<ZenzaPlaylistLoadResult>;
  loadSearchVideo(
    searchWord: string, options: unknown, limit: number,
    isCurrent: () => boolean
  ): Promise<ZenzaPlaylistLoadResult>;
  insertCurrentVideo(videoInfo: unknown): unknown;
  scrollToActiveItem(): void;
}

/** Frozen identity of the originating video/model/request/playlist. */
export type ZenzaPlaylistLoadOwner = Readonly<{
  videoInfo: Readonly<{msgInfo: unknown}>;
  watchId: string | null | undefined;
  requestId: ZenzaDialogRequestId | null | undefined;
  playlist: ZenzaPlaylistLoadPort;
}>;

/** Only the player capabilities used by global command routing. */
export interface ZenzaRootPlayerPort {
  readonly currentTime: number;
  readonly _nicoVideoPlayer?: {
    readonly _videoPlayer?: {
      readonly _body?: HTMLElement | null;
      readonly videoElement?: HTMLVideoElement | null;
    };
    readonly drawableVideoElement?: HTMLVideoElement | null;
    readonly commentViewModel?: unknown;
  };
  on(event: 'command', callback: (command: string, params?: unknown) => unknown): unknown;
  on(event: 'close', callback: () => void): unknown;
  execCommand(command: string, params?: unknown): unknown;
}
export interface ZenzaRootPlayerState {
  videoInfo?: {
    readonly videoId: string;
    readonly watchId?: string;
    readonly watchUrl?: string;
    readonly title?: string;
    readonly isCommunityVideo?: boolean;
    readonly isMymemory?: boolean;
  } | null;
  isEnableFilter: boolean;
  isBackComment: boolean;
  isShowComment: boolean;
  isLoop: boolean;
  isMute: boolean;
  isDebug: boolean;
  sharedNgLevel: string | number;
  screenMode: string;
  playbackRate: number;
}
