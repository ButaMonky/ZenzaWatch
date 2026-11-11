import type {
  ZenzaVideoSetGeneration,
  ZenzaElementSourceGeneration,
  ZenzaDialogRequestId,
  ZenzaPlaylistLoadOwner,
  ZenzaPlaylistLoadPort
} from '../nico-src/PlayerLifetimeTypes';

/**
 * Task186: negative compile-time cases for asynchronous playback ownership.
 * This file is included by tsconfig.nico.contract.json (no runtime emission).
 */
declare let setGeneration: ZenzaVideoSetGeneration;
declare let sourceGeneration: ZenzaElementSourceGeneration;
declare let dialogRequest: ZenzaDialogRequestId;
declare const snapshot: ZenzaPlaylistLoadOwner;

// The generations are disjoint despite sharing a numeric representation.
// @ts-expect-error element-source token cannot replace top-level setVideo token
setGeneration = sourceGeneration;
// @ts-expect-error top-level setVideo token cannot replace element-source token
sourceGeneration = setGeneration;
// @ts-expect-error a raw counter cannot bypass the owned generation type
sourceGeneration = 5;
// @ts-expect-error dialog request string cannot be used as a source generation
sourceGeneration = dialogRequest;
// @ts-expect-error an arbitrary string is not an owned request
dialogRequest = 'play-42';
// @ts-expect-error captured ownership must not be mutated by async callbacks
snapshot.requestId = dialogRequest;
// @ts-expect-error captured ownership must include its originating playlist
const missingPlaylist: ZenzaPlaylistLoadOwner = {
  videoInfo: {msgInfo: {}},
  watchId: 'sm9',
  requestId: dialogRequest
};
// @ts-expect-error a partial playlist does not implement the load contract
const missingLoader: ZenzaPlaylistLoadPort = {isEnable: true};
// @ts-expect-error isCurrent must return a boolean
snapshot.playlist.load({}, {}, {}, () => 'yes');

import type {ZenzaPlaylistLoadResult} from '../nico-src/PlayerLifetimeTypes';
// @ts-expect-error undocumented arbitrary statuses are not owned load outcomes
const arbitraryResult: ZenzaPlaylistLoadResult = {status:'whatever'};
// @ts-expect-error a success must supply its display message
const incompleteSuccess: ZenzaPlaylistLoadResult = {status:'ok'};
async function resultCannotBeAny(port:ZenzaPlaylistLoadPort) {
  const result=await port.load({}, {}, {}, () => true);
  // @ts-expect-error result must not silently become any at the actual port
  result.notAResultMethod();
}
void resultCannotBeAny;

import type {ZenzaRootPlayerPort, ZenzaRootPlayerState} from '../nico-src/PlayerLifetimeTypes';
import {RootDispatcher} from '../nico-src/RootDispatcher';
declare const rootPlayer: ZenzaRootPlayerPort;
declare const rootState: ZenzaRootPlayerState;
RootDispatcher.initialize(rootPlayer);
// @ts-expect-error global routing cannot accept an arbitrary object as its player
RootDispatcher.initialize({});
// @ts-expect-error the entry point requires an owning player
RootDispatcher.initialize();
// @ts-expect-error current time is read from the player, not replaced by routing
rootPlayer.currentTime = 10;
// @ts-expect-error the active media endpoint must be a real video element
const wrongMedia: NonNullable<ZenzaRootPlayerPort['_nicoVideoPlayer']> = {_videoPlayer:{videoElement:document.createElement('div')}};
// @ts-expect-error configuration state is not an arbitrary property bag
rootState.playbackRate = 'fast';
