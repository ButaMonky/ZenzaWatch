// import * as _ from 'lodash';
// const emitter;
import {global} from '../../../../src/ZenzaWatchIndex';
import {ClassList} from './ClassListWrapper';
//===BEGIN===
const Fullscreen = {
  now() {
    return !!(this.get() || document.mozFullScreen || document.webkitIsFullScreen);
  },
  get() {
    return document.fullscreenElement || document.fullScreenElement ||
      document.webkitFullscreenElement || document.mozFullScreenElement ||
      document.msFullscreenElement || null;
  },
  request(target) {
    const elm = typeof target === 'string' ? document.getElementById(target) : target;
    if (!elm) {
      return;
    }
    const request = elm.requestFullscreen || elm.requestFullScreen ||
      elm.webkitRequestFullscreen || elm.webkitRequestFullScreen ||
      elm.mozRequestFullScreen || elm.msRequestFullscreen;
    if (typeof request !== 'function') {
      return;
    }
    this._handleEvents();
    return request.call(elm);
  },
  cancel() {
    if (!this.now()) {
      return;
    }
    const exit = document.exitFullscreen || document.cancelFullScreen ||
      document.webkitExitFullscreen || document.webkitCancelFullScreen ||
      document.mozCancelFullScreen || document.msExitFullscreen;
    if (typeof exit === 'function') {
      return exit.call(document);
    }
  },
  _handleEvents() {
    // A fullscreen request may happen repeatedly. Keep one event handler per page.
    if (this._eventsAttached) {
      return;
    }
    this._eventsAttached = true;
    const cl = ClassList(document.body);
    const handle = () => {
      // Do not swallow native fullscreenchange events needed by other listeners.
      const isFull = this.now();
      cl.toggle('is-fullscreen', isFull);
      global.emitter.emit('fullscreenStatusChange', isFull);
    };
    document.addEventListener('webkitfullscreenchange', handle, true);
    document.addEventListener('mozfullscreenchange', handle, true);
    document.addEventListener('MSFullscreenChange', handle, true);
    document.addEventListener('fullscreenchange', handle, true);
  }
};

//===END===

export {Fullscreen};
