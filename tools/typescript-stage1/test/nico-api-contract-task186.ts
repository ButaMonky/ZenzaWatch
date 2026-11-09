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
