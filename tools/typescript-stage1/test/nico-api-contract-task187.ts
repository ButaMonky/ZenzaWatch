import type {ZenzaHlsEngine, ZenzaHlsLifetime} from '../nico-src/HlsLifecycleTypes';
/** Negative checks for HLS ownership and teardown (Task187).
 * Compile via tsconfig.nico.contract.json. No live network or runtime export.
 */
declare const hlsActive: ZenzaHlsEngine;
const activeHls: ZenzaHlsLifetime = {phase: 'active', engine: hlsActive};
const destroyedHls: ZenzaHlsLifetime = {phase: 'disposed', engine: null};
activeHls.engine.stopLoad();
if (destroyedHls.phase === 'disposed') {
  const none: null = destroyedHls.engine;
  void none;
}
// @ts-expect-error disposed state cannot retain an engine
const invalidDisposed: ZenzaHlsLifetime = {phase: 'disposed', engine: hlsActive};
// @ts-expect-error active state cannot contain null
const invalidActive: ZenzaHlsLifetime = {phase: 'active', engine: null};
// @ts-expect-error a media element, not a numeric ID, must be attached
hlsActive.attachMedia(42);
// @ts-expect-error loadSource must receive a URL string, not an arbitrary object
hlsActive.loadSource({url: 'ignored'});
// @ts-expect-error an engine without destroy cannot fulfill ownership
const incompleteHls: ZenzaHlsEngine = {loadSource(src: string) {void src;}};

import type {ZenzaHlsReadinessStage, ZenzaHlsReadinessRecord} from '../nico-src/HlsLifecycleTypes';
declare let hlsStage: ZenzaHlsReadinessStage;
declare const hlsProgress: ZenzaHlsReadinessRecord;
const progressFlag: boolean = hlsProgress[hlsStage];
const progressMs: number | undefined = hlsProgress.at.firstProgress;
void progressFlag; void progressMs;
// @ts-expect-error unknown hls.js events do not count as playback readiness
hlsStage = 'FRAG_LOADED';
// @ts-expect-error synthetic manifest has not reached real media canplay
hlsStage = 'canplay';
// @ts-expect-error manifestLoaded is not one of the five stages
hlsStage = 'manifestLoaded';
// @ts-expect-error every stage must exist in a fully initialized readiness state
const incompleteReadiness: ZenzaHlsReadinessRecord = {
  manifestReady: true, mediaCanPlay: false, firstPlaying: false,
  firstProgress: false, origin: 0, at: {}, playingTime: null
};
