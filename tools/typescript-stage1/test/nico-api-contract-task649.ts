// Task649: compile-only contracts for VideoInfoLoader.
import {VideoInfoLoader} from '../nico-src/VideoInfoLoader';
import type {LoadOptions} from '../nico-src/VideoInfoLoader';

const options: LoadOptions = {economy: false};
void VideoInfoLoader.load('sm9', options).then(data => data.watchApiData);
// @ts-expect-error watch ids are strings
void VideoInfoLoader.load(9, options);
// @ts-expect-error economy is a boolean flag
void VideoInfoLoader.load('sm9', {economy: 'yes'});
