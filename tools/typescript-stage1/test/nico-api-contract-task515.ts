// Task515: compile-only surface contract for thumbnail observation in the DOM.
import {VideoItemObserver} from '../nico-src/VideoItemObserver';
import type {VideoItemObserveOptions} from '../nico-src/VideoItemObserver';

const container: Element = document.createElement('div');
const opts: VideoItemObserveOptions = {query: 'zenza-video-item', container};
VideoItemObserver.observe(opts);
VideoItemObserver.observe();
VideoItemObserver.unobserve({container});
// @ts-expect-error a container must be a DOM element, not a string
VideoItemObserver.observe({container: 'any'});
// @ts-expect-error explicit unobserve requires a container
VideoItemObserver.unobserve({});
// @ts-expect-error query is a selector string
VideoItemObserver.observe({query: 42, container});
