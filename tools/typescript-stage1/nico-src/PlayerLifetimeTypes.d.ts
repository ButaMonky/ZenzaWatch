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

export type ZenzaPlaylistLoadResult = Readonly<{
  status?: string;
  message?: string;
}>;

/** The only playlist methods an in-flight dialog callback is permitted to use. */
export interface ZenzaPlaylistLoadPort {
  readonly isEnable: boolean;
  load(
    query: unknown, options: unknown, msgInfo: unknown,
    isCurrent: () => boolean
  ): Promise<any>; // Legacy JS loader result; narrowed in a later stage.
  loadSearchVideo(
    searchWord: string, options: unknown, limit: number,
    isCurrent: () => boolean
  ): Promise<any>; // Legacy JS loader result; narrowed in a later stage.
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
