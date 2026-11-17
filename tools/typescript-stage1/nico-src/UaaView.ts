/**
 * Canonical TypeScript source for src/UaaView.js (Task1063: VideoInfoPanel.ts から分割).
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// legacy-to-ts: names provided by other bundled modules
declare const BaseViewComponent: typeof import('./BaseViewComponent').BaseViewComponent;
declare const Config: Loose;
declare const UaaLoader: typeof import('./UaaLoader').UaaLoader;
declare const ZenzaWatch: Loose;
declare const css: typeof import('./css').css;
declare const textUtil: typeof import('./textUtil').textUtil;

// typoじゃなくてブロック回避のため名前を変えてる
class UaaView extends BaseViewComponent {
  declare setState: Loose;
  declare _props: Loose;
  declare _elm: Loose;
  declare _view: Loose;
  declare _shadow: Loose;
  declare _bound: Loose;
  declare static __css__: Loose;
  declare static _shadow_: Loose;
  declare static __tpl__: Loose;
  declare _abortController: Loose;
  declare _config: Loose;
  declare _generation: Loose;
  declare _loadTimer: Loose;
  declare _state: Loose;
  declare df: Loose;
  constructor({parentNode}: Loose) {
    super({
      parentNode,
      name: 'UaaView',
      template: UaaView.__tpl__,
      shadow: UaaView._shadow_,
      css: UaaView.__css__
    });

    this._state = {
      isUpdating: false,
      isExist: false,
      isSpeaking: false
    };

    this._config = Config.namespace('uaa');
    this._generation = 0;
    this._loadTimer = null;
    this._abortController = null;

    this._bound.load = this.load.bind(this);
    this._bound.update = this.update.bind(this);
  }

  _initDom(...args: [Loose]) {
    super._initDom(...args);
    ZenzaWatch.debug.uaa = this;

    if (!this._shadow) {
      return;
    } // ShadowDOM使えなかったらバイバイ
    const shadow = this._shadow || this._view;
    this._elm.body = shadow.querySelector('.UaaDetailBody');
  }

  _cancelPending() {
    this._generation = (this._generation || 0) + 1;
    if (this._loadTimer) {
      window.clearTimeout(this._loadTimer);
      this._loadTimer = null;
    }
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  update(videoInfo?: Loose) {
    if (!this._shadow || !this._config.props.enable) {
      return;
    }
    if (!this._elm.body) {
      return;
    }

    if (this._state.isUpdating && this._props.videoId === videoInfo.videoId) {
      return;
    }
    this._cancelPending();
    this.setState({isUpdating: true});
    this._props.videoInfo = videoInfo;
    this._props.videoId = videoInfo.videoId;

    const generation = this._generation;
    const controller =
      typeof AbortController === 'undefined' ? null : new AbortController();
    this._abortController = controller;
    const signal = controller ? controller.signal : undefined;
    this._loadTimer = window.setTimeout(() => {
      this._loadTimer = null;
      if (generation !== this._generation || (signal && signal.aborted)) {
        return;
      }
      this.load(videoInfo, {generation, signal});
    }, 5000);
  }

  load(videoInfo?: Loose, {generation = this._generation, signal}: Loose = {}) {
    const videoId = videoInfo.videoId;

    return UaaLoader.load(videoId, {limit: 50, signal})
      .then((result?: Loose) => this._onLoad(videoId, result, generation, signal))
      .catch((e?: Loose) => this._onFail(videoId, e, generation, signal));
  }

  clear() {
    this._cancelPending();
    this.setState({isUpdating: false, isExist: false, isSpeaking: false});
    if (!this._elm.body) {
      return;
    }
    this._elm.body.textContent = '';
  }

  _onLoad(videoId?: Loose, result?: Loose, generation: Loose = this._generation, signal?: Loose) {
    if (this._props.videoId !== videoId || generation !== this._generation ||
        (signal && signal.aborted)) {
      return;
    }
    this.setState({isUpdating: false});
    const data = result ? result.data : null;
    if (!data || data.sponsors.length < 1) {
      return;
    }

    const df = this.df = this.df || document.createDocumentFragment();
    const div = document.createElement('div');
    div.className = 'screenshots';
    let idx = 0, screenshots = 0;
    data.sponsors.forEach((u?: Loose) => {
      if (!u.auxiliary.bgVideoPosition || idx >= 4) {
        return;
      }
      u.added = true;
      div.append(this._createItem(u, idx++, generation, signal));
      screenshots++;
    });
    div.setAttribute('data-screenshot-count', (screenshots as Loose));
    df.append(div);

    data.sponsors.forEach((u?: Loose) => {
      if (!u.auxiliary.bgVideoPosition || u.added) {
        return;
      }
      u.added = true;
      df.append(this._createItem(u, idx++, generation, signal));
    });
    data.sponsors.forEach((u?: Loose) => {
      if (u.added) {
        return;
      }
      u.added = true;
      df.append(this._createItem(u, idx++, generation, signal));
    });

    this._elm.body.innerHTML = '';
    this._elm.body.append(df);

    this.setState({isExist: true});
  }

  _createItem(data?: Loose, idx?: Loose, generation = this._generation,
      signal = this._abortController ? this._abortController.signal : undefined) {
    const df = document.createElement('div');
    const contact = document.createElement('span');
    contact.textContent = data.advertiserName;
    contact.className = 'contact';
    df.className = 'item';
    const aux = data.auxiliary;
    const bgkeyframe = aux.bgVideoPosition || 0;
    if (data.message) {
      data.title = data.message;
    }

    df.setAttribute('data-index', idx);
    if (bgkeyframe && idx < 4) {
      const sec = parseFloat(bgkeyframe);
      df.setAttribute('data-time', textUtil.secToTime(sec));
      df.classList.add('clickable', 'command', 'other');
      Object.assign(df.dataset, { command: 'seek', type: 'number', param: sec });
      contact.setAttribute('title', `${data.message}(${textUtil.secToTime(sec)})`);

      const isCurrent = () =>
        generation === this._generation && (!signal || !signal.aborted);
      this._props.videoInfo.getCurrentVideo()
        .then((url?: Loose) => {
          if (!isCurrent()) {
            return null;
          }
          return ZenzaWatch.util.VideoCaptureUtil.capture(url, sec, {signal});
        })
        .then((screenshot?: Loose) => {
          if (!screenshot || !isCurrent()) {
            return;
          }
          const cv = document.createElement('canvas');
          const ct = cv.getContext('2d')!;
          cv.width = screenshot.width;
          cv.height = screenshot.height;

          cv.className = 'screenshot command clickable';
          Object.assign(cv.dataset, { command: 'seek', type: 'number', param: sec });
          ct.fillStyle = 'rgb(32, 32, 32)';
          ct.fillRect(0, 0, cv.width, cv.height);
          ct.drawImage(screenshot, 0, 0);
          df.classList.add('has-screenshot');
          df.classList.remove('clickable', 'other');

          df.append(cv);
        }).catch(() => {});
    } else if (bgkeyframe) {
      const sec = parseFloat(bgkeyframe);
      df.classList.add('clickable', 'command', 'other');
      Object.assign(df.dataset, { command: 'seek', type: 'number', param: sec });
      contact.setAttribute('title', `${data.message}(${textUtil.secToTime(sec)})`);
    } else {
      df.classList.add('other');
    }
    df.append(contact);
    return df;
  }

  _onFail(videoId?: Loose, e?: Loose, generation: Loose = this._generation, signal?: Loose) {
    if (this._props.videoId !== videoId || generation !== this._generation ||
        (signal && signal.aborted)) {
      return;
    }
    this.setState({isUpdating: false});
  }

  _onCommand(command?: Loose, param?: Loose) {
    switch (command) {
      default:
        super._onCommand(command, param);
    }
  }

}

UaaView._shadow_ = (`
    <style>
      .UaaDetails,
      .UaaDetails * {
        box-sizing: border-box;
        user-select: none;
      }

      .UaaDetails .clickable {
        cursor: pointer;
      }

        .UaaDetails .clickable:active {
          transform: translate(0, 2px);
          box-shadow: none;
        }

      .UaaDetails {
        opacity: 0;
        pointer-events: none;
        max-height: 0;
        margin: 0 8px 0;
        color: var(--zt-text-1, #ccc);
        overflow: hidden;
        text-align: center;
        word-break: break-all;
      }
        .UaaDetails.is-Exist {
          display: block;
          pointer-events: auto;
          max-height: 800px;
          padding: 4px;
          opacity: 1;
          transition: opacity 0.4s linear 0.4s, max-height 1s ease-in, margin 0.4s ease-in;
        }
        .UaaDetails.is-Exist[open] {
          border: 1px solid var(--zt-border, #666);
          border-radius: 4px;
          overflow: auto;
        }

      .UaaDetails .uaaSummary {
        height: 38px;
        margin: 4px 4px 8px;
        color: inherit;
        outline: none;
        border: 1px solid var(--zt-border-light, #ccc);
        letter-spacing: 12px;
        line-height: 38px;
        font-size: 24px;
        text-align: center;
        cursor: pointer;
        border-radius: 8px;
      }

      .UaaDetails .uaaDetailBody {
        margin: auto;
      }

      .UaaDetails .item {
        display: inline;
        width: inherit;
        margin: 0 4px 0 0;
      }

        .UaaDetails .item.has-screenshot {
          position: relative;
          display:inline-block;
          margin: 4px;
        }
        .UaaDetails .item.has-screenshot::after {
          content: attr(data-time);
          position: absolute;
          right: 0;
          bottom: 0;
          padding: 2px 4px;
          background: var(--zt-surface-0, #000);
          color: var(--zt-text-1, #ccc);
          font-size: 12px;
          line-height: 14px;
        }
        .UaaDetails .item.has-screenshot:hover::after {
          opacity: 0;
        }

      .UaaDetails .contact {
        display: inline-block;
        color: var(--zt-text-0, #fff);
        font-weight: bold;
        font-size: 16px;
        text-align: center;
        user-select: none;
        word-break: break-all;
      }

        .UaaDetails .item.has-screenshot .contact {
          position: absolute;
          text-align: center;
          width: 100%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: var(--zt-text-0, #fff);
          text-shadow: 1px 1px 1px var(--zt-shadow, #000);
          -webkit-text-stroke: 1px #000;
          pointer-events: none;
          font-size: 16px;
        }
       .UaaDetails .item.has-screenshot:hover .contact {
          display: none;
        }

        .UaaDetails .item.other {
          display: inline-block;
          border: none;
          width: inherit;
          margin: 0;
          padding: 2px 4px;
          line-height: normal;
          min-height: inherit;
          text-align: left;
        }

          .UaaDetails .item.is-speaking {
            text-decoration: underline;
          }
          .UaaDetails .item.has-screenshot.is-speaking {
            outline: none;
            transition: transform 0.2s ease;
            transform: scale(1.2);
            z-index: 1000;
          }
          .UaaDetails .item .contact {
            display: inline;
            padding: 2px 4px;
            width: auto;
            font-size: 12px;
            color: inherit; /*#ccc;*/
            outline-offset: -2px;
          }

        .UaaDetails .item.other.clickable {
          display: inline-block;
          padding: 2px 4px;
          margin: 0 4px;
        }
        .UaaDetails .item.other.clickable .contact {
          display: inline-block;
          color: var(--zt-accent-soft, #ffc);
        }
        .UaaDetails .item.other.clickable .contact::after {
          content: attr(title);
          color: var(--zt-text-1, #ccc);
          font-weight: normal;
          margin: 0 4px;
        }


      .UaaDetails .screenshot {
        display: block;
        width: 128px;
        margin: 0;
        vertical-align: middle;
        cursor: pointer;
      }

      .screenshots[data-screenshot-count="1"] .screenshot {
        width: 192px;
      }

      .zenzaScreenMode_sideView .is-notFullscreen .UaaDetails {
        color: var(--zt-text-inverse, #000);
      }
      :host-context(.zenzaScreenMode_sideView .is-notFullscreen) .UaaDetails {
        color: var(--zt-text-inverse, #000);
      }

    </style>
    <details class="root UaaDetails">
      <summary class="uaaSummary clickable">提供</summary>
      <div class="UaaDetailBody"></div>
    </details>
  `).trim();

UaaView.__tpl__ = ('<div class="uaaView"></div>').trim();

UaaView.__css__ = (`
    uaaView {
      display: none;
    }
    uaaView.is-Exist {
     display: block;
    }
  `).trim();

export {
  UaaView
};
