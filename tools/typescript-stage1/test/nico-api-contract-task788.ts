// Task788: compile-only contracts for TextLabel and VideoCaptureUtil.
import {TextLabel} from '../nico-src/TextLabel';
import {VideoCaptureUtil} from '../nico-src/VideoCaptureUtil';

declare const container: HTMLElement;
declare const video: HTMLVideoElement;

const label = TextLabel.create({container, name: 'time', text: '00:00', style: {widthPx: 44, fontSizePx: 12}});
const drawn: Promise<void> = label.drawText('00:01');
void drawn;
// @ts-expect-error a container element is required
TextLabel.create({name: 'x'});
// @ts-expect-error widthPx is a number of pixels
TextLabel.create({container, style: {widthPx: '44'}});

const shot: Promise<HTMLCanvasElement> = VideoCaptureUtil.capture('https://example.invalid/v.mp4', 3, {timeout: 1000});
void shot;
// @ts-expect-error the position is given in seconds as a number
VideoCaptureUtil.capture('https://example.invalid/v.mp4', '3');
const pair: Promise<{canvas: HTMLCanvasElement}> = VideoCaptureUtil.videoToCanvas(video);
void pair;
VideoCaptureUtil.capTube({title: 't', videoId: 'v', author: 'a'});
// @ts-expect-error capTube needs the author too
VideoCaptureUtil.capTube({title: 't', videoId: 'v'});
const thumb: Promise<unknown> | undefined = VideoCaptureUtil.capTubeThumbnail(320, 180);
void thumb;
