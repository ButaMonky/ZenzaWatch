/** Type-only contract for hls.js owned by ZenzaVideoElement (Task187).
 * The real hls.js object remains created/destroyed by the existing runtime.
 * No code/URL/load order or Hls.js version is changed by these declarations.
 */
export interface ZenzaHlsEngine {
  readonly config: Record<string, unknown>;
  readonly levels: ReadonlyArray<Readonly<{bitrate?: number}>>;
  readonly currentLevel: number;
  readonly bandwidthEstimate: number;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  loadSource(src: string): void;
  startLoad(position?: number): void;
  attachMedia(video: HTMLMediaElement): void;
  stopLoad(): void;
  detachMedia(): void;
  destroy(): void;
}
export type ZenzaHlsLifetime =
  | Readonly<{phase: 'active'; engine: ZenzaHlsEngine}>
  | Readonly<{phase: 'disposed'; engine: null}>;
export type ZenzaHlsErrorData = Readonly<{
  fatal: boolean;
  type: string;
  details: string;
  response?: Readonly<{code: number}>;
}>;

/** Playback readiness stages are not interchangeable with hls.js event names. */
export type ZenzaHlsReadinessStage =
  | 'manifestReady'
  | 'mediaCanPlay'
  | 'firstPlaying'
  | 'firstProgress'
  | 'firstFrame';
export type ZenzaHlsReadinessRecord = Record<ZenzaHlsReadinessStage, boolean> & {
  origin: number;
  at: Partial<Record<ZenzaHlsReadinessStage, number>>;
  playingTime: number | null;
};
