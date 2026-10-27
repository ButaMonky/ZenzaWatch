// Task851: compile-only contracts for the small packages/zenza modules.
import {createVideoElement} from '../nico-src/createVideoElement';
import {initializeExternalSite} from '../nico-src/externalStartup';
import {PlayerSession} from '../nico-src/PlayerSession';
import {saveMymemory} from '../nico-src/saveMymemory';
import {PlayListSession} from '../nico-src/PlayListSession';
import {PagePreviewGuard} from '../nico-src/PagePreviewGuard';
import {FrameLayer} from '../nico-src/FrameLayer';

const video: HTMLVideoElement = createVideoElement();
void video;
void initializeExternalSite({host: 'www.google.com', pathname: '/search', initializePlayer: () => {},
  connect: () => {}, readUser: () => {}});
// @ts-expect-error the player initializer is required
void initializeExternalSite({host: 'x', pathname: '/', connect: () => {}, readUser: () => {}});
const has: boolean = PlayerSession.init(sessionStorage).hasRecord();
void has;
saveMymemory({currentTime: 1, getMymemory: () => '<html></html>'}, {title: 't', watchId: 'sm9'});
// @ts-expect-error the player must provide getMymemory()
saveMymemory({currentTime: 1}, {});
PlayListSession.save({items: [], index: 0});
const max: number = PlayListSession.MAX_ITEMS;
void max;
const guard = new PagePreviewGuard({on: () => {}, off: () => {}});
guard.dispose();
const layer = new FrameLayer({container: document.body, html: '<p></p>'});
const frameWindow: Promise<Window> = layer.wait();
void frameWindow;
