import {ZenzaWatch, global} from './ZenzaWatchIndex';
import {CONSTANT} from './constant';
import {Config} from './Config';
import {UaaLoader} from '../packages/lib/src/nico/loader';
import {RelatedVideoList} from './VideoList';
import {TagListView} from './TagListView';
import {parseVideoSearchSortValue, NicoSearchApiV2Loader} from '../packages/lib/src/nico/VideoSearch';
import {TagSuggestLoader} from '../packages/lib/src/nico/TagSuggestLoader';
import {ThumbInfoLoader} from '../packages/lib/src/nico/ThumbInfoLoader';
import {BaseViewComponent} from '../packages/zenza/src/parts/BaseViewComponent';
import {Emitter} from '../packages/lib/src/Emitter';
import {sleep} from '../packages/lib/src/infra/sleep';
import {Fullscreen} from '../packages/lib/src/dom/Fullscreen';
import {textUtil} from '../packages/lib/src/text/textUtil';
import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';
import {css, cssUtil} from '../packages/lib/src/css/css';
import {uq} from '../packages/lib/src/uQuery';
import {domEvent} from '../packages/lib/src/dom/domEvent';
import {ClassList} from '../packages/lib/src/dom/ClassListWrapper';
import {MylistPocketDetector} from '../packages/zenza/src/init/MylistPocketDetector';
const VideoItemObserver = {
  observe: () => {}
};
//===BEGIN===

class VideoInfoPanel extends Emitter {
  constructor(params) {
    super();
    this._videoHeaderPanel = new VideoHeaderPanel(params);
    this._dialog = params.dialog;
    this._config = Config;

    this._dialog.on('canplay', this._onVideoCanPlay.bind(this));
    this._dialog.on('videoCount', this._onVideoCountUpdate.bind(this));
    // Task 074: いいね！のお礼メッセージ（URLが書かれていることがあるので、
    // 消えるポップアップだけでなくパネルにも残して選択・コピーできるようにする）
    this._dialog.on('likeThanksMessage', this._onLikeThanksMessage.bind(this));

    if (params.node) {
      this.appendTo(params.node);
    }
  }
  _initializeDom() {
    if (this._isInitialized) {
      return;
    }
    this._isInitialized = true;

    const $view = this._$view = uq.html(VideoInfoPanel.__tpl__);
    const view = this._view = $view[0];
    const classList = this.classList = ClassList(view);

    const $icon = this._$ownerIcon = $view.find('.ownerIcon');
    this._$ownerName = $view.find('.ownerName');
    this._$ownerPageLink = $view.find('.ownerPageLink');

    this._description = view.querySelector('.videoDescription');
    this._seriesList = view.querySelector('.seriesList');

    this._tagListView = new TagListView({
      parentNode: view.querySelector('.videoTagsContainer')
    });

    this._relatedInfoMenu = new RelatedInfoMenu({
      parentNode: view.querySelector('.relatedInfoMenuContainer')
    });

    this._videoMetaInfo = new VideoMetaInfo({
      parentNode: view.querySelector('.videoMetaInfoContainer')
    });

    this._likeMessageContainer = view.querySelector('.likeMessageContainer');
    this._uaaContainer = view.querySelector('.uaaContainer');
    this._uaaView = new UaaView(
      {parentNode: this._uaaContainer});

    view.addEventListener('mousemove', e => e.stopPropagation());
    view.addEventListener('command', this._onCommandEvent.bind(this));
    view.addEventListener('click', this._onClick.bind(this));
    view.addEventListener('wheel', e => e.stopPropagation(), {passive: true});
    $icon.on('load', () => $icon.raf.removeClass('is-loading'));

    classList.add(Fullscreen.now() ? 'is-fullscreen' : 'is-notFullscreen');
    global.emitter.on('fullscreenStatusChange', isFull => {
      classList.toggle('is-fullscreen', isFull);
      classList.toggle('is-notFullscreen', !isFull);
    });

    view.addEventListener('touchenter', () => classList.add('is-slideOpen'), {passive: true});
    global.emitter.on('hideHover', () => classList.remove('is-slideOpen'));
    cssUtil.registerProps(
      {name: '--base-description-color', syntax: '<color>', initialValue: '#888', inherits: true}
    );
    MylistPocketDetector.detect().then(pocket => {
      this._pocket = pocket;
      classList.add('is-pocketReady');
    });
    if (window.customElements) {
      VideoItemObserver.observe({container: this._description});
    }
  }
  update(videoInfo) {
    this._videoInfo = videoInfo;
    this._videoHeaderPanel.update(videoInfo);

    const owner = videoInfo.owner;
    this._$ownerIcon.attr('src', owner.icon);
    this._$ownerPageLink.attr('href', owner.url);
    this._$ownerName.text(owner.name);

    this._videoMetaInfo.update(videoInfo);
    this._tagListView.update({
      tagList: videoInfo.tagList,
      watchId: videoInfo.watchId,
      videoId: videoInfo.videoId,
      token: videoInfo.csrfToken,
      tagEdit: videoInfo.tagEdit,
    });

    this._seriesList.textContent = '';
    if (videoInfo.series) {
      const label = document.createElement('zenza-video-series-label');
      Object.assign(label.dataset, videoInfo.series);
      this._seriesList.append(label);
    }
    this._updateVideoDescription(videoInfo.description, videoInfo.series);

    const classList = this.classList;
    classList.remove('userVideo', 'channelVideo', 'initializing');
    classList.toggle('is-community', this._videoInfo.isCommunityVideo);
    classList.toggle('is-mymemory', this._videoInfo.isMymemory);
    classList.add(videoInfo.isChannel ? 'channelVideo' : 'userVideo');

    this._clearLikeThanksMessage();

    this._uaaView.clear();
    this._uaaView.update(videoInfo);

    this._relatedInfoMenu.update(videoInfo);

  }
  /**
   * 説明文中のurlの自動リンク等の処理
   */
  async _updateVideoDescription(html, series = null) {
    this._description.textContent = '';
    this._zenTubeUrl = null;
    if (series) {
      if (series.video.prev || series.video.next) {
        html += `<br><br>「${textUtil.escapeHtml(series.title)}」 シリーズ前後の動画`;
      }
      if (series.video.prev) {
        html += `<br>前の動画 <a class="watch" href="https://www.nicovideo.jp/watch/${series.video.prev.id}">${series.video.prev.id}</a>`;
      }
      if (series.video.next) {
        html += `<br>次の動画 <a class="watch" href="https://www.nicovideo.jp/watch/${series.video.next.id}">${series.video.next.id}</a>`;
      }
    }
    /*
     * Task 074: 以前はリンクの「文字」から動画IDを取っていたため、
     * 説明文に https://www.nicovideo.jp/watch/sm39257413 のようなフルURLが
     * 書かれている場合（本家がclass="watch"を付けないただのリンクにする）に
     * 動画情報のカードが出ず、クリックしてもZenzaで開けなかった。
     * リンク先(href)のホストとパスから動画IDを取るようにして、
     * フルURL・スマホ版URL・nico.ms・ショート動画(ss〜)にも対応する。
     */
    const watchIdFromLink = link => {
      const host = (link.hostname || '').replace(/^(www|sp|embed)\./, '');
      const path = link.pathname || '';
      if (host === 'nico.ms') {
        const m = /^\/((?:sm|nm|so|ss)[0-9]+)/.exec(path);
        return m ? m[1] : null;
      }
      if (host !== 'nicovideo.jp') {
        return null;
      }
      const m = /^\/(?:watch|shorts)\/((?:sm|nm|so|ss)[0-9]+)/.exec(path);
      return m ? m[1] : null;
    };
    const decorateWatchLink = watchLink => {
      const videoId = watchIdFromLink(watchLink);
      if (!videoId) {
        return;
      }
      watchLink.classList.add('noHoverMenu');
      Object.assign(watchLink.dataset, {command: 'open', param: videoId});

      if (!window.customElements) {
        const $watchLink = uq(watchLink);
        const thumbnail = nicoUtil.getThumbnailUrlByVideoId(videoId);
        if (thumbnail) {
          const $img = uq('<img class="videoThumbnail">').attr('src', thumbnail);
          $watchLink.append($img);
        }
        const buttons = uq(`<zenza-playlist-append
          class="playlistAppend clickable-item" title="プレイリストで開く"
          data-command="playlistAppend" data-param="${videoId}"
        >▶</zenza-playlist-append><div
          class="deflistAdd" title="とりあえずマイリスト"
          data-command="deflistAdd" data-param="${videoId}"
        >&#x271A;</div
        ><div class="pocket-info" title="動画情報"
          data-command="pocket-info" data-param="${videoId}"
        >？</div>`);
        $watchLink.append(buttons);
      } else {
        const vitem = document.createElement('zenza-video-item');
        vitem.dataset.videoId = videoId;
        watchLink.after(vitem);
        watchLink.classList.remove('watch');
      }
    };
    const seekTime = seek => {
      const [min, sec] = (seek.dataset.seektime || '0:0').split(':');
      Object.assign(seek.dataset, {command: 'seek', type: 'number', param: min * 60 + sec * 1});
    };
    const mylistLink = link => {
      link.classList.add('mylistLink');
      const mylistId = link.textContent.split('/')[1];
      const button = uq(`<zenza-mylist-link data-mylist-id="${mylistId}">
          ${link.outerHTML}
          <zenza-playlist-append
            class="playlistSetMylist clickable-item" title="プレイリストで開く"
            data-command="playlistSetMylist" data-param="${mylistId}"
          >▶</zenza-playlist-append>
        </zenza-mylist-link>`)[0];
      link.replaceWith(button);
    };
    const seriesLink = link => {
      link.classList.add('seriesLink');
      const seriesId = link.textContent.split('/')[1];
      const button = uq(`<zenza-series-link data-series-id="${seriesId}">
          ${link.outerHTML}
          <zenza-playlist-append
            class="playlistSetSeries clickable-item" title="プレイリストで開く"
            data-command="playlistSetSeries" data-param="${seriesId}"
          >▶</zenza-playlist-append>
        </zenza-series-link>`)[0];
      link.replaceWith(button);
    };
    const youtube = link => {
      const btn = uq(`<zentube-button
        class="zenzaTubeButton"
        title="ZenzaWatchで開く(実験中)"
        accesskey="z"
        data-command="setVideo;"
        >▷Zen<span>Tube</span></zentube-button>`)[0];
      Object.assign(btn.dataset, {
        command: 'setVideo',
        param: link.href
      });
      link.parentNode.insertBefore(btn, link);
    };

    await sleep.promise();

    const $description = uq(`<zenza-video-description>${html}</zenza-video-description>`);
    for (const a of $description.query('a')) {
      a.classList.add('noHoverMenu');
      const href = a.href;
      if (a.classList.contains('watch') || watchIdFromLink(a)) {
        decorateWatchLink(a);
      } else if (a.classList.contains('seekTime')) {
        seekTime(a);
      } else if (/^mylist\//.test(a.textContent)) {
        mylistLink(a);
      } else if (/^series\//.test(a.textContent)) {
        seriesLink(a);
      } else if (/^https?:\/\/((www\.|)youtube\.com\/watch|youtu\.be)/.test(href)) {
        youtube(a);
        this._zenTubeUrl = href;
      }
    }
    for (const e of
      $description.query('[style*="color: #000000;"],[style*="color: black;"]')
    ) {
      e.dataset.originalCss = e.cssText;
      e.style.color = '#FFF';
    }
    for (const e of $description.query('span')) {
      e.classList.add('videoDescription-font');
    }

    this._description.append($description[0]);

  }
  /*
   * Task 074: いいね！のお礼メッセージをパネルに残す。
   * 本文はテキストとして選択でき、中のURLは自動でリンクになる。
   * 「コピー」ボタンで本文全体をクリップボードへコピーできる。
   */
  _onLikeThanksMessage({message = '', videoId = ''} = {}) {
    const container = this._likeMessageContainer;
    if (!container) {
      return;
    }
    container.textContent = '';
    if (!message) {
      return;
    }
    const box = document.createElement('div');
    box.className = 'likeThanksMessage';
    const head = document.createElement('div');
    head.className = 'likeThanksMessage-head';
    const title = document.createElement('span');
    title.className = 'likeThanksMessage-title';
    title.textContent = `\u2665 いいね！のお礼メッセージ${videoId ? `（${videoId}）` : ''}`;
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'likeThanksMessage-copy';
    copy.textContent = 'コピー';
    const flash = text => {
      copy.textContent = text;
      window.setTimeout(() => { copy.textContent = 'コピー'; }, 2000);
    };
    copy.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(message)
          .then(() => flash('コピーしました'))
          .catch(() => flash('コピーできませんでした'));
      } else {
        flash('コピーできませんでした');
      }
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'likeThanksMessage-close';
    close.textContent = '\u2715';
    close.title = '閉じる';
    close.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      this._clearLikeThanksMessage();
    });
    head.append(title, copy, close);
    const body = document.createElement('div');
    body.className = 'likeThanksMessage-body';
    // URLだけリンクにする（他の部分はテキストのまま＝HTMLとして解釈しない）
    const reg = /(https?:\/\/[^\s<>"']+)/g;
    let last = 0;
    let m;
    while ((m = reg.exec(message)) !== null) {
      if (m.index > last) {
        body.append(document.createTextNode(message.slice(last, m.index)));
      }
      const a = document.createElement('a');
      a.href = m[1];
      a.textContent = m[1];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'noHoverMenu';
      body.append(a);
      last = m.index + m[1].length;
    }
    if (last < message.length) {
      body.append(document.createTextNode(message.slice(last)));
    }
    box.append(head, body);
    container.append(box);
  }
  _clearLikeThanksMessage() {
    if (this._likeMessageContainer) {
      this._likeMessageContainer.textContent = '';
    }
  }
  async _onVideoCanPlay(watchId, videoInfo, options) {
    // 動画の再生を優先するため、比較的どうでもいい要素はこのタイミングで初期化するのがよい
    if (!this._relatedVideoList) {
      this._relatedVideoList = new RelatedVideoList({
        container: this._$view.find('.relatedVideoContainer')[0],
        enableAdDecoration: this._config.props.enableAdDecoration,
        debugCheckAdDecoration: this._config.props.debugCheckAdDecoration
      });
      this._relatedVideoList.on('command', this._onCommand.bind(this));
    }

    if (this._config.props.autoZenTube && this._zenTubeUrl && !options.isAutoZenTubeDisabled) {
      sleep(100).then(() => {
        window.console.info('%cAuto ZenTube', this._zenTubeUrl);
        this.emit('command', 'setVideo', this._zenTubeUrl);
      });
    }
    await sleep.idle();
    this._relatedVideoList.fetchRecommend(videoInfo.videoId, watchId, videoInfo);
  }
  _onVideoCountUpdate(...args) {
    if (!this._videoHeaderPanel) {
      return;
    }
    this._videoMetaInfo.updateVideoCount(...args);
    this._videoHeaderPanel.updateVideoCount(...args);
  }
  _onClick(e) {
    e.stopPropagation();
    if (
      (e.button !== 0 || e.metaKey || e.shiftKey || e.altKey || e.ctrlKey)) {
      return true;
    }
    const target = e.target.closest('[data-command]');
    if (!target) {
      global.emitter.emitAsync('hideHover'); // 手抜き
      return;
    }
    let {command, param, type} = target.dataset;
    if (param && (type === 'bool' || type === 'json')) {
      param = JSON.parse(param);
    }
    e.preventDefault();

    domEvent.dispatchCommand(e.target, command, param);
  }
  _onCommand(command, param) {
    switch (command) {
      default:
        domEvent.dispatchCommand(this._view, command, param);
        break;
    }
  }
  _onCommandEvent(e) {
    const {command, param} = e.detail;
    switch (command) {
      case 'pocket-info':
        this._pocket.external.info(param);
        break;
      case 'ownerVideo':
        domEvent.dispatchCommand(this._view, 'playlistSetUploadedVideo', this._videoInfo.owner.id);
        break;
      default:
        return;
    }
    e.stopPropagation();
  }
  appendTo(node) {
    this._initializeDom();
    this._$view.appendTo(node);
    this._videoHeaderPanel.appendTo(node);
  }
  hide() {
    this._videoHeaderPanel.hide();
  }
  close() {
    this._videoHeaderPanel.close();
  }
  clear() {
    this._videoHeaderPanel.clear();
    this.classList.add('initializing');
    this._$ownerIcon.raf.addClass('is-loading');
    this._description.textContent = '';
  }
  selectTab(tabName) {
    const $view = this._$view;
    const $target = $view.find(`.tabs.${tabName}, .tabSelect.${tabName}`);
    this._activeTabName = tabName;
    $view.find('.activeTab').removeClass('activeTab');
    $target.addClass('activeTab');
  }
  blinkTab(tabName) {
    const $view = this._$view;
    const $target = $view.find(`.tabs.${tabName}, .tabSelect.${tabName}`);
    if (!$target.length) {
      return;
    }
    $target.addClass('blink');
    window.setTimeout(() => $target.removeClass('blink'), 50);
  }
  appendTab(tabName, title, content) {
    const $view = this._$view;
    const $select =
      uq('<div class="tabSelect"/>')
        .addClass(tabName)
        .attr('data-command', 'selectTab')
        .attr('data-param', tabName)
        .text(title);
    const $body = uq('<div class="tabs"/>').addClass(tabName);
    if (content) {
      $body.append(content);
    }

    $view.find('.tabSelectContainer').append($select);
    $view.append($body);

    if (this._activeTabName === tabName) {
      $select.addClass('activeTab');
      $body.addClass('activeTab');
    }
    return $body;
  }
}

css.addStyle(`
  .zenzaWatchVideoInfoPanel .tabs:not(.activeTab) {
    display: none;
    pointer-events: none;
    overflow: hidden;
  }

  .zenzaWatchVideoInfoPanel .tabs.activeTab {
    margin-top: 32px;
    box-sizing: border-box;
    position: relative;
    width: 100%;
    height: calc(100% - 32px);
    overflow-x: hidden;
    overflow-y: visible;
    overscroll-behavior: none;
    text-align: left;
  }
  .zenzaWatchVideoInfoPanel .tabs.relatedVideoTab.activeTab {
    overflow: hidden;
  }

  .zenzaWatchVideoInfoPanel .tabs:not(.activeTab) {
    display: none !important;
    pointer-events: none;
    opacity: 0;
  }

  .zenzaWatchVideoInfoPanel .tabSelectContainer {
    position: absolute;
    display: flex;
    height: 32px;
    z-index: 100;
    width: 100%;
    white-space: nowrap;
    user-select: none;
  }

  .zenzaWatchVideoInfoPanel .tabSelect {
    flex: 1;
    box-sizing: border-box;
    display: inline-block;
    height: 32px;
    font-size: 12px;
    letter-spacing: 0;
    line-height: 32px;
    color: #666;
    background: #222;
    cursor: pointer;
    text-align: center;
    transition: text-shadow 0.2s ease, color 0.2s ease;
  }
  .zenzaWatchVideoInfoPanel .tabSelect.activeTab {
    font-size: 14px;
    letter-spacing: 0.1em;
    color: #ccc;
    background: #333;
  }

  .zenzaWatchVideoInfoPanel .tabSelect.blink:not(.activeTab) {
    color: #fff;
    text-shadow: 0 0 4px #ff9;
    transition: none;
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel.is-notFullscreen .tabSelect.blink:not(.activeTab) {
    color: #fff;
    text-shadow: 0 0 4px #006;
    transition: none;
  }

  .zenzaWatchVideoInfoPanel .tabSelect:not(.activeTab):hover {
    background: #888;
  }

  .zenzaWatchVideoInfoPanel.initializing {
  }

  .zenzaWatchVideoInfoPanel>* {
    transition: opacity 0.4s ease;
    pointer-events: none;
  }

  .is-mouseMoving .zenzaWatchVideoInfoPanel>*,
                .zenzaWatchVideoInfoPanel:hover>* {
    pointer-events: auto;
  }


  .zenzaWatchVideoInfoPanel.initializing>* {
    opacity: 0;
    color: #333;
    transition: none;
  }

  .zenzaWatchVideoInfoPanel {
    position: absolute;
    top: 0;
    width: 320px;
    height: 100%;
    box-sizing: border-box;
    z-index: 25000;
    background: #333;
    color: #ccc;
    overflow-x: hidden;
    overflow-y: hidden;
    transition: opacity 0.4s ease;
  }

  .zenzaWatchVideoInfoPanel .ownerPageLink {
    display: block;
    margin: 0 auto 8px;
    width: 104px;
  }

  .zenzaWatchVideoInfoPanel .ownerIcon {
    width: 96px;
    height: 96px;
    border: none;
    border-radius: 4px;
    transition: opacity 1s ease;
    vertical-align: middle;
  }
  .zenzaWatchVideoInfoPanel .ownerIcon.is-loading {
    opacity: 0;
  }

  .zenzaWatchVideoInfoPanel .ownerName {
    font-size: 20px;
    word-break: break-all;
  }

  .zenzaWatchVideoInfoPanel .videoOwnerInfoContainer {
    padding: 16px;
    display: table;
    width: 100%;
  }

  .zenzaWatchVideoInfoPanel .videoOwnerInfoContainer>*{
    display: block;
    vertical-align: middle;
    text-align: center;
  }

  .zenzaWatchVideoInfoPanel .videoDescription {
    padding: 8px 8px 8px;
    margin: 4px 0px;
    word-break: break-all;
    line-height: 1.5;
  }

  .zenzaWatchVideoInfoPanel .videoDescription a {
    display: inline-block;
    font-weight: bold;
    text-decoration: none;
    color: #ff9;
    padding: 2px;
  }
  .zenzaWatchVideoInfoPanel .videoDescription a:visited {
    color: #ffd;
  }

  .zenzaWatchVideoInfoPanel .videoDescription .watch {
    display: block;
    position: relative;
    line-height: 60px;
    box-sizing: border-box;
    padding: 4px 16px;;
    min-height: 60px;
    width: 272px;
    margin: 8px 10px;
    background: #444;
    border-radius: 4px;
  }
  .zenzaWatchVideoInfoPanel .videoDescription .watch:hover {
    background: #446;
  }

  .videoDescription-font[style*="color"] {
    text-shadow:
      0 -1px 2px var(--base-description-color, #888),
      1px 0 2px var(--base-description-color, #888),
      0 1px 2px var(--base-description-color, #888),
      -1px 0 2px var(--base-description-color, #888);
  }

  .zenzaWatchVideoInfoPanel .videoDescription .mylistLink,
  .zenzaWatchVideoInfoPanel .videoDescription .seriesLink {
    white-space: nowrap;
    display: inline-block;
  }

  .zenzaWatchVideoInfoPanel:not(.is-pocketReady) .pocket-info {
    display: none !important;
  }
  .pocket-info {
    font-family: Menlo;
  }

  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistAppend,
  .zenzaWatchVideoInfoPanel .videoInfoTab .deflistAdd,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetMylist,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetSeries,
  .zenzaWatchVideoInfoPanel .videoInfoTab .pocket-info,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetUploadedVideo {
    display: inline-block;
    font-size: 16px;
    line-height: 20px;
    width: 24px;
    height: 24px;
    background: #666;
    color: #ccc !important;
    background: #666;
    text-decoration: none;
    border: 1px outset;
    cursor: pointer;
    text-align: center;
    user-select: none;
    margin-left: 8px;
  }
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistAppend,
  .zenzaWatchVideoInfoPanel .videoInfoTab .pocket-info,
  .zenzaWatchVideoInfoPanel .videoInfoTab .deflistAdd {
    display: none;
  }

  .zenzaWatchVideoInfoPanel .videoInfoTab .owner:hover .playlistAppend,
  .zenzaWatchVideoInfoPanel .videoInfoTab .watch:hover .playlistAppend,
  .zenzaWatchVideoInfoPanel .videoInfoTab .watch:hover .pocket-info,
  .zenzaWatchVideoInfoPanel .videoInfoTab .watch:hover .deflistAdd {
    display: inline-block;
  }

  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistAppend {
    position: absolute;
    bottom: 4px;
    left: 16px;
  }

  .zenzaWatchVideoInfoPanel .videoInfoTab .pocket-info {
    position: absolute;
    bottom: 4px;
    left: 48px;
  }

  .zenzaWatchVideoInfoPanel .videoInfoTab .deflistAdd {
    position: absolute;
    bottom: 4px;
    left: 80px;
  }

  .zenzaWatchVideoInfoPanel .videoInfoTab .pocket-info:hover,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistAppend:hover,
  .zenzaWatchVideoInfoPanel .videoInfoTab .deflistAdd:hover,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetMylist:hover,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetSeries:hover,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetUploadedVideo:hover {
    transform: scale(1.5);
  }
  .zenzaWatchVideoInfoPanel .videoInfoTab .pocket-info:active,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistAppend:active,
  .zenzaWatchVideoInfoPanel .videoInfoTab .deflistAdd:active,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetMylist:active,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetSeries:active,
  .zenzaWatchVideoInfoPanel .videoInfoTab .playlistSetUploadedVideo:active {
    transform: scale(1.2);
    border: 1px inset;
  }


  .zenzaWatchVideoInfoPanel .videoDescription .watch .videoThumbnail {
    position: absolute;
    right: 16px;
    height: 60px;
    pointer-events: none;
  }
  .zenzaWatchVideoInfoPanel .videoDescription:hover .watch .videoThumbnail {
    filter: none;
  }



  .zenzaWatchVideoInfoPanel .publicStatus,
  .zenzaWatchVideoInfoPanel .videoTagsContainer {
    display: none;
  }

  .zenzaWatchVideoInfoPanel .publicStatus {
    display: none;
    position: relative;
    margin: 8px 0;
    padding: 8px;
    line-height: 150%;
    text-align; center;
    color: #333;
  }

  .zenzaWatchVideoInfoPanel .videoMetaInfoContainer {
    display: inline-block;
    padding: 0 8px;
  }

  .zenzaScreenMode_normal .is-backComment .zenzaWatchVideoInfoPanel,
  .zenzaScreenMode_big    .is-backComment .zenzaWatchVideoInfoPanel {
    opacity: 0.7;
  }


  .zenzaWatchVideoInfoPanel .relatedVideoTab .relatedVideoContainer {
    box-sizing: border-box;
    position: relative;
    width: 100%;
    height: 100%;
    margin: 0;
    user-select: none;
  }

  .zenzaWatchVideoInfoPanel .videoListFrame,
  .zenzaWatchVideoInfoPanel .commentListFrame {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border: 0;
    background: #333;
  }

  .zenzaWatchVideoInfoPanel .nowLoading {
    display: none;
    opacity: 0;
    pointer-events: none;
  }
  .zenzaWatchVideoInfoPanel.initializing .nowLoading {
    display: block !important;
    opacity: 1 !important;
    color: #888;
  }
  .zenzaWatchVideoInfoPanel .nowLoading {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
  }
  .zenzaWatchVideoInfoPanel .kurukuru {
    position: absolute;
    display: inline-block;
    font-size: 96px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }

  @keyframes loadingRolling {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(1800deg); }
  }
  .zenzaWatchVideoInfoPanel.initializing .kurukuruInner {
    display: inline-block;
    pointer-events: none;
    text-align: center;
    text-shadow: 0 0 4px #888;
    animation-name: loadingRolling;
    animation-iteration-count: infinite;
    animation-duration: 4s;
  }
  .zenzaWatchVideoInfoPanel .nowLoading .loadingMessage {
    position: absolute;
    display: inline-block;
    font-family: Impact;
    font-size: 32px;
    text-align: center;
    top: calc(50% + 48px);
    left: 0;
    width: 100%;
  }

  ${CONSTANT.SCROLLBAR_CSS}

  .zenzaWatchVideoInfoPanel .zenzaWatchVideoInfoPanelInner {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
    .zenzaWatchVideoInfoPanelContent {
      flex: 1;
    }

  .zenzaTubeButton {
    display: inline-block;
    padding: 4px 8px;
    cursor: pointer;
    background: #666;
    color: #ccc;
    border-radius: 4px;
    border: 1px outset;
    margin: 0 8px;
  }
  .zenzaTubeButton:hover {
    box-shadow: 0 0 8px #fff, 0 0 4px #ccc;
  }
    .zenzaTubeButton span {
      pointer-events: none;
      display: inline-block;
      background: #ccc;
      color: #333;
      border-radius: 4px;
    }
    .zenzaTubeButton:hover span {
      background: #f33;
      color: #ccc;
    }
  .zenzaTubeButton:active {
    box-shadow:  0 0 2px #ccc, 0 0 4px #000 inset;
    border: 1px inset;
  }

  .zenzaWatchVideoInfoPanel .relatedInfoMenuContainer {
    text-align: left;
  }

  .zenzaWatchVideoInfoPanel .seriesList {
    padding: 0 8px;
  }

  /* Task 074: いいね！のお礼メッセージ */
  .zenzaWatchVideoInfoPanel .likeThanksMessage {
    margin: 8px;
    padding: 8px 10px;
    border: 1px solid #a66;
    border-radius: 8px;
    background: rgba(60, 30, 40, 0.6);
    color: #eee;
    font-size: 13px;
    user-select: text;
    -webkit-user-select: text;
  }
  .zenzaWatchVideoInfoPanel .likeThanksMessage-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .zenzaWatchVideoInfoPanel .likeThanksMessage-title {
    flex: 1 1 auto;
    color: #f9a;
    font-weight: bold;
    font-size: 12px;
  }
  .zenzaWatchVideoInfoPanel .likeThanksMessage-copy,
  .zenzaWatchVideoInfoPanel .likeThanksMessage-close {
    flex: 0 0 auto;
    padding: 2px 8px;
    border: 1px solid #888;
    border-radius: 6px;
    background: #333;
    color: #ddd;
    font-size: 12px;
    cursor: pointer;
  }
  .zenzaWatchVideoInfoPanel .likeThanksMessage-copy:hover,
  .zenzaWatchVideoInfoPanel .likeThanksMessage-close:hover {
    background: #555;
  }
  .zenzaWatchVideoInfoPanel .likeThanksMessage-body {
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.6;
  }
  .zenzaWatchVideoInfoPanel .likeThanksMessage-body a {
    color: #9cf;
  }

  zenza-video-item,
  zenza-video-series-label,
  zenza-vieo-description,
  .UaaView {
    content-visibility: auto;
  }

  `, {className: 'videoInfoPanel'});

css.addStyle(`
  .is-open .zenzaWatchVideoInfoPanel>* {
    display: none;
    pointer-events: none;
  }
  .zenzaWatchVideoInfoPanel:hover>* {
    display: inherit;
    pointer-events: auto;
  }
  .zenzaWatchVideoInfoPanel:hover .tabSelectContainer {
    display: flex;
  }

  .zenzaWatchVideoInfoPanel {
    top: 20%;
    right: calc(32px - 320px);
    left: auto;
    width: 320px;
    height: 60%;
    border: 1px solid transparent;
    background: none;
    opacity: 0;
    box-shadow: none;
    transition: opacity 0.4s ease, transform 0.4s ease 1s;
    will-change: opacity, transform;
  }

  .is-mouseMoving  .zenzaWatchVideoInfoPanel {
    border: 1px solid #888;
    opacity: 0.5;
  }

  .zenzaWatchVideoInfoPanel.is-slideOpen,
  .zenzaWatchVideoInfoPanel:hover {
    background: #333;
    box-shadow: 4px 4px 4px #000;
    border: none;
    opacity: 0.9;
    transform: translate3d(-288px, 0, 0);
    transition: opacity 0.4s ease, transform 0.4s ease 1s;
  }

`, {className: 'screenMode for-full videoInfoPanel'});

css.addStyle(`
  .zenzaScreenMode_small .zenzaWatchVideoInfoPanel {
    display: none;
  }

  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .tabSelectContainer {
    width: calc(100% - 16px);
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .tabSelect {
    background: #ccc;
    color: #888;
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .tabSelect.activeTab {
    background: #ddd;
    color: black;
    border: none;
  }

  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel {
    top: 230px;
    left: 0;
    width: ${CONSTANT.SIDE_PLAYER_WIDTH}px;
    height: calc(100vh - 296px);
    bottom: 48px;
    padding: 8px;
    box-shadow: none;
    background: #f0f0f0;
    color: #000;
    border: 1px solid #333;
    margin: 4px 2px;
  }

  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .publicStatus {
    display: block;
    text-align: center;
  }

  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .videoDescription a {
    color: #006699;
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .videoDescription a:visited {
    color: #666666;
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .videoTagsContainer {
    display: block;
    bottom: 48px;
    width: 364px;
    margin: 0 auto;
    padding: 8px;
    background: #ccc;
  }

  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .videoDescription .watch {
    background: #ddd;
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .videoDescription .watch:hover {
    background: #ddf;
  }

  .zenzaScreenMode_sideView .videoInfoTab::-webkit-scrollbar {
    background: #f0f0f0;
  }

  .zenzaScreenMode_sideView .videoInfoTab::-webkit-scrollbar-thumb {
    border-radius: 0;
    background: #ccc;
  }
`, {className: 'screenMode for-popup videoInfoPanel'});

uq.ready().then(() => {
  if (document.body.classList.contains('MatrixRanking-body')) {
    css.addStyle(`
      body.zenzaScreenMode_sideView.MatrixRanking-body .RankingRowRank {
        line-height: 48px;
        height: 48px;
        pointer-events: none;
        user-select: none;
      }
      body.zenzaScreenMode_sideView.MatrixRanking-body .RankingRowRank {
        position: sticky;
        left: calc(var(--sideView-left-margin) - 8px);
        z-index: 100;
        transform: none;
        padding-right: 16px;
        width: 64px;
        overflow: visible;
        text-align: right;
        mix-blend-mode: difference;
        text-shadow:
          1px  1px 0 #fff,
          1px -1px 0 #fff,
          -1px  1px 0 #fff,
          -1px -1px 0 #fff;
      }
      body.zenzaScreenMode_sideView.MatrixRanking-body .BaseLayout-block {
        width: ${1024 + 64 * 2}px;
      }
      .RankingMainContainer-decorateChunk+.RankingMainContainer-decorateChunk,
      .RankingMainContainer-decorateChunk>*+* {
        margin-top: 0;
      }
      body.zenzaScreenMode_sideView .RankingMainContainer {
        width: ${1024}px;
      }
      body.zenzaScreenMode_sideView.MatrixRanking-body .RankingMatrixVideosRow {
        width: ${1024 + 64}px;
        margin-left: ${-64}px;
      }
        .RankingGenreListContainer-categoryHelp {
          position: static;
        }
        .RankingMatrixNicoadsRow>*+*,
        .RankingMatrixVideosRow>:nth-child(n+3) {
          margin-left: 13px;
        }
        .RankingBaseItem {
          width: 160px;
          height: 196px;
        }
          body.zenzaScreenMode_sideView .RankingBaseItem .Card-link {
            grid-template-rows: 90px auto;
          }
          .VideoItem.RankingBaseItem .VideoThumbnail {
            border-radius: 3px 3px 0 0;
          }

          [data-nicoad-grade] .Thumbnail.VideoThumbnail .Thumbnail-image {
            margin: 3px;
            background-size: calc(100% + 6px);
          }
          [data-nicoad-grade] .Thumbnail.VideoThumbnail:after {
            width: 40px;
            height: 40px;
            background-size: 80px 80px;
          }
          .Thumbnail.VideoThumbnail .VideoLength {
            bottom: 3px;
            right: 3px;
          }
          .VideoThumbnailComment {
            transform: scale(0.8333);
          }
          .RankingBaseItem-meta {
            position: static;
            padding: 0 4px 8px;
          }
          .VideoItem.RankingBaseItem .VideoItem-metaCount>.VideoMetaCount {
            white-space: nowrap;
          }
      .RankingMainContainer .ToTopButton {
        transform: translateX(calc(100vw / 2 - 100% - 36px));
        user-select: none;
      }
    `, {className: 'screenMode for-sideView MatrixRanking', disabled: true});
    }
});

css.addStyle(`
  .is-open .zenzaWatchVideoInfoPanel {
    display: none;
    left: calc(100%);
    top: 0;
  }

  @media screen {
    @media (min-width: 992px) {
      .zenzaScreenMode_normal .zenzaWatchVideoInfoPanel {
        display: inherit;
      }
    }

    @media (min-width: 1216px) {
      .zenzaScreenMode_big .zenzaWatchVideoInfoPanel {
        display: inherit;
      }
    }

    /* 縦長モニター */
    @media
      (max-width: 991px) and (min-height: 700px)
    {
      .zenzaScreenMode_normal .zenzaWatchVideoInfoPanel {
        display: inherit;
        top: 100%;
        left: 0;
        width: 100%;
        height: ${CONSTANT.BOTTOM_PANEL_HEIGHT}px;
        z-index: 20000;
      }

      .zenzaScreenMode_normal .zenzaWatchVideoInfoPanelFoot .infoPanelFootSpacer {
        height: 96px;
      }

      .zenzaScreenMode_normal .zenzaWatchVideoInfoPanel .videoOwnerInfoContainer {
        display: table;
      }
      .zenzaScreenMode_normal .zenzaWatchVideoInfoPanel .videoOwnerInfoContainer>* {
        display: table-cell;
        text-align: left;
      }
      .zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel {
        width: 100% !important;
      }
    }

    @media
      (max-width: 1215px) and (min-height: 700px) {
      .zenzaScreenMode_big .zenzaWatchVideoInfoPanel {
        display: inherit;
        top: 100%;
        left: 0;
        width: 100%;
        height: ${CONSTANT.BOTTOM_PANEL_HEIGHT}px;
        z-index: 20000;
      }

      .zenzaScreenMode_big .zenzaWatchVideoInfoPanelFoot .infoPanelFootSpacer {
        height: 96px;
      }

      .zenzaScreenMode_big .zenzaWatchVideoInfoPanel .videoOwnerInfoContainer {
        display: table;
      }
      .zenzaScreenMode_big .zenzaWatchVideoInfoPanel .videoOwnerInfoContainer>* {
        display: table-cell;
        text-align: left;
      }

      .zenzaScreenMode_big .zenzaWatchVideoHeaderPanel {
        width: 100% !important;
      }
    }
  }

`, {className: 'screenMode for-dialog videoInfoPanel'});

css.addStyle(`
  .zenzaWatchVideoInfoPanel .comment {
    padding-left: 0;
  }
`, {className: 'domain slack-com', disabled: true});

VideoInfoPanel.__tpl__ = (`
    <div class="zenzaWatchVideoInfoPanel show initializing">
      <div class="nowLoading">
        <div class="kurukuru"><span class="kurukuruInner">&#x262F;</span></div>
        <div class="loadingMessage">Loading...</div>
      </div>

      <div class="tabSelectContainer"><div class="tabSelect videoInfoTab activeTab" data-command="selectTab" data-param="videoInfoTab">動画情報</div><div class="tabSelect relatedVideoTab" data-command="selectTab" data-param="relatedVideoTab">関連動画</div></div>

      <div class="tabs videoInfoTab activeTab">
        <div class="zenzaWatchVideoInfoPanelInner">
          <div class="zenzaWatchVideoInfoPanelContent">
            <div class="videoOwnerInfoContainer">
              <a class="ownerPageLink" rel="noopener" target="_blank">
                <img class="ownerIcon loading"/>
              </a>
              <span class="owner">
                <span class="ownerName"></span>
                <zenza-playlist-append class="playlistSetUploadedVideo userVideo"
                  data-command="ownerVideo"
                  title="投稿動画一覧をプレイリストで開く">▶</zenza-playlist-append>
              </span>
            </div>
            <div class="publicStatus">
              <div class="videoMetaInfoContainer"></div>
              <div class="relatedInfoMenuContainer"></div>
            </div>
            <div class="seriesList"></div>
            <div class="videoDescription"></div>
          </div>
          <div class="zenzaWatchVideoInfoPanelFoot">
            <div class="uaaContainer"></div>

            <div class="likeMessageContainer"></div>

            <div class="infoPanelFootSpacer"></div>

            <div class="videoTagsContainer sideTab"></div>
          </div>
        </div>
      </div>

      <div class="tabs relatedVideoTab">
        <div class="relatedVideoContainer"></div>
      </div>

    </div>
  `).trim();


class VideoHeaderPanel extends Emitter {
  constructor(params) {
    super();
  }
  _initializeDom() {
    if (this._isInitialized) {
      return;
    }
    this._isInitialized = true;
    cssUtil.addStyle(VideoHeaderPanel.__css__);
    const $view = this._$view = uq.html(VideoHeaderPanel.__tpl__);
    const view = $view[0];
    const classList = this.classList = ClassList(view);

    this._videoTitle = $view.find('.videoTitle')[0];
    this._searchForm = new VideoSearchForm({
      parentNode: view
    });

    $view.on('wheel', e => e.stopPropagation(), {passive: true});
    this._seriesCover = view.querySelector('.series-thumbnail');

    this._tagListView = new TagListView({
      parentNode: view.querySelector('.videoTagsContainer')
    });

    this._relatedInfoMenu = new RelatedInfoMenu({
      parentNode: view.querySelector('.relatedInfoMenuContainer'),
      isHeader: true
    });
    this._relatedInfoMenu.on('open', () => {
      classList.add('is-relatedMenuOpen');
      this._updateHold();
    });
    this._relatedInfoMenu.on('close', () => {
      classList.remove('is-relatedMenuOpen');
      this._updateHold();
    });
    this._initHold(view);

    this._videoMetaInfo = new VideoMetaInfo({
      parentNode: view.querySelector('.videoMetaInfoContainer'),
    });

    classList.add(Fullscreen.now() ? 'is-fullscreen' : 'is-notFullscreen');
    global.emitter.on('fullScreenStatusChange', isFull => {
      classList.toggle('is-fullscreen', isFull);
      classList.toggle('is-notFullscreen', !isFull);
      // Task 076: 全画面に入った/出た時は、外に出すための調整をすぐ戻す／やり直す
      this._onResize();
      window.setTimeout(() => this._onResize(), 600);
    });

    new MutationObserver((mutationList) => {
      for (const mutation of mutationList) {
        if (mutation.type !== 'attributes') return;
        if (mutation.attributeName !== 'data-screen-mode') return;

        this._resetHeight();
        window.setTimeout(() => this._onResize(), 1000);
        break;
      }
    }).observe(window.document.body, {attributes: true});
    window.addEventListener('resize', _.debounce(this._onResize.bind(this), 500));
    // Task 072: 表示位置の設定を変えたらすぐ反映する
    Config.onkey('videoHeader.position', () => {
      this._resetHeight();
      this._onResize();
      window.setTimeout(() => this._onResize(), 300);
    });
  }
  update(videoInfo) {
    this._videoInfo = videoInfo;

    this._videoTitle.title =  this._videoTitle.textContent = videoInfo.title;

    const watchId = videoInfo.watchId;
    this._videoMetaInfo.update(videoInfo);

    this._tagListView.update({
      tagList: videoInfo.tagList,
      watchId,
      videoId: videoInfo.videoId,
      token: videoInfo.csrfToken,
      tagEdit: videoInfo.tagEdit,
      genre: videoInfo.genre, // Task 074: タグ欄の先頭にジャンルを表示する
    });

    this._relatedInfoMenu.update(videoInfo);

    const classList = this.classList;
    classList.remove('userVideo', 'channelVideo', 'initializing');
    classList.toggle('is-community', this._videoInfo.isCommunityVideo);
    classList.toggle('is-mymemory', this._videoInfo.isMymemory);
    classList.toggle('has-Parent', this._videoInfo.hasParentVideo);
    classList.add(videoInfo.isChannel ? 'channelVideo' : 'userVideo');
    this._$view.raf.css('display', '');

    if (videoInfo.series && videoInfo.series.thumbnailUrl) {
      this._seriesCover.style.backgroundImage = `url("${videoInfo.series.thumbnailUrl}")`;
    } else {
      this._seriesCover.removeAttribute('style');
    }

    this._resetHeight();
    window.setTimeout(() => this._onResize(), 1000);
  }
  updateVideoCount(...args) {
    this._videoMetaInfo.updateVideoCount(...args);
  }
  _resetHeight() {
    this._height = undefined;
  }
  /*
   * Task 076 (D-18): 入力中・メニュー表示中にヘッダーが透明になって消えないようにする。
   * 原因: ヘッダーは :hover か is-mouseMoving の時だけ表示されるため、検索欄に入力中（マウス静止）や、
   *       関連メニュー・タグの「？」メニューからマウスが外れた瞬間に透明になり、タグ欄も消えていた。
   * 対応（2026-09-17の提案 2-A＋2-B）:
   *  2-A 操作中は固定表示: ヘッダーの中にフォーカスがある間（検索欄・「？」メニュー・関連メニュー）と、
   *      関連メニューを開いている間は is-hold を付けて表示し続ける
   *  2-B 消えるまでの猶予: マウスがヘッダーから出ても HOLD_LINGER_MS の間は表示したままにする
   */
  _initHold(view) {
    const update = () => this._updateHold();
    // シャドウDOMの中のフォーカスも focusin/focusout は外側まで届く
    view.addEventListener('focusin', update);
    view.addEventListener('focusout', () => window.setTimeout(update, 0));
    view.addEventListener('mouseenter', () => {
      window.clearTimeout(this._lingerTimer);
      this._lingering = false;
      update();
    });
    view.addEventListener('mouseleave', () => {
      window.clearTimeout(this._lingerTimer);
      this._lingering = true;
      update();
      this._lingerTimer = window.setTimeout(() => {
        this._lingering = false;
        update();
      }, VideoHeaderPanel.HOLD_LINGER_MS);
    });
  }
  _updateHold() {
    const view = this._$view && this._$view[0];
    if (!view) {
      return;
    }
    let focused = false;
    try {
      focused = view.matches(':focus-within');
    } catch (e) {
      focused = view.contains(document.activeElement);
    }
    const hold = focused || this._lingering || view.classList.contains('is-relatedMenuOpen');
    view.classList.toggle('is-hold', !!hold);
    view.classList.toggle('is-holdFocus', !!focused);
  }
  /*
   * Task 072: 動画ヘッダーの表示位置を設定（videoHeader.position）で選べるようにした。
   * 従来（auto）は「動画の上に置いた時に画面上端から20px以上はみ出すか」で、
   * 動画の外に置く／動画に重ねて自動で隠す（is-onscreen）を切り替えていた。
   * そのため同じ画面モードでも、タグの行数（ヘッダーの高さ）やウィンドウの大きさ次第で表示が変わっていた。
   *
   * Task 076: 「常に動画の外」の収め方を作り直した（Task 074の「動画だけ下げる」方式は、
   * ヘッダーが動画ではなく .zenzaPlayerContainer の上端基準で置かれているため効いていなかった）。
   * 実際に測りながら layoutOutsideHeader() で収める（詳細はその関数のコメント参照）。
   */
  _onResize() {
    const view = this._$view && this._$view[0];
    if (!view) {
      return;
    }
    const configMode = Config.props['videoHeader.position'] || 'auto';
    const classList = this.classList;
    // Task 076: 設定が効くのは通常・大モード（全画面を除く）だけ。
    // それ以外（小・サイドビュー・ワイド・3D・全画面）は従来通り(auto)の判定にする。
    // 以前は画面モードに関係なく is-onscreen を付けていたため、サイドビューで「常に重ねる」にすると
    // .is-onscreen { width: 100% !important } がサイドビュー用の幅を上書きしてしまっていた。
    const target = VideoHeaderPanel.isOutsideLayoutTarget(view);
    const mode = target ? configMode : 'auto';
    const layoutActive = mode === 'outside';
    if (!layoutActive) {
      // 自分が加えたズレ・縮みを戻してから判定する
      VideoHeaderPanel.resetOutsideLayout(view);
    }
    const rect = view.getBoundingClientRect();
    const isOnscreen = classList.contains('is-onscreen');
    const height = this._height ?? (rect.bottom - rect.top);
    if (!this._height && !isOnscreen) {
      this._height = height;
    }
    const top = isOnscreen ? (rect.top - height) : rect.top;
    let onscreen;
    switch (mode) {
      case 'outside':
        onscreen = false;
        break;
      case 'overlay':
      case 'overlay-visible':
        onscreen = true;
        break;
      default:
        onscreen = top < -20;
    }
    classList.toggle('is-onscreen', onscreen);
    classList.toggle('is-overlayVisible', mode === 'overlay-visible');
    classList.toggle('is-outsideFixed', mode === 'outside');

    if (layoutActive) {
      const result = VideoHeaderPanel.layoutOutsideHeader(view);
      this._lastOutsideLayout = result;
      if (result && result.changed) {
        window.console.log('%c[Task076] ヘッダー配置', 'color: #0a0', result);
      }
    }
  }
  /* 「常に動画の外」の配置を行う画面モードか（通常・大、かつ全画面でない） */
  static isOutsideLayoutTarget(view) {
    const body = document.body;
    if (!body.classList.contains('zenzaScreenMode_normal') &&
        !body.classList.contains('zenzaScreenMode_big')) {
      return false;
    }
    if (view && view.classList.contains('is-fullscreen')) {
      return false;
    }
    return !(Fullscreen && typeof Fullscreen.now === 'function' && Fullscreen.now());
  }
  // @@TASK076_LAYOUT_BEGIN
  /*
   * Task 076: 自分が加えたズレ・縮みを全部戻す
   */
  static resetOutsideLayout(view) {
    const body = document.body;
    body.classList.remove('zenzaHeaderOutsideActive');
    body.style.removeProperty('--zenza-dialog-shift-y');
    if (view) {
      view.classList.remove('is-compact', 'is-tagsClamped');
      view.style.removeProperty('--zenza-header-outside-shift');
      view.style.removeProperty('--zenza-header-tags-max');
    }
  }
  /*
   * Task 076: 「常に動画の外」のヘッダーを画面内に収める。推測せず、1段ずつ実際に測りながら進める。
   *
   * 前提（実測で確認済み）
   *  - ヘッダーは .zenzaPlayerContainer の上端を基準に置かれている（bottom: calc(100% + 8px)）。
   *    動画(.videoPlayer)だけ動かしてもヘッダーは動かない。
   *  - .zenzaVideoPlayerDialogInner（プレイヤー＋情報パネルの箱）はダイアログの中央に置かれている
   *    （display:flex; align-items:center）。箱を下げればプレイヤーもヘッダーも一緒に下がる。
   *  - 再生バーは position: fixed で画面の一番下にある。動画の下端はバーの上端より上に保つ。
   *  - 画面の幅が狭い時は、情報パネル（プレイリスト等）がプレイヤーの「下」に来る（padding-bottom: 240px）。
   *
   * 順番
   *  0. 自分が加えたズレ・縮みを全部戻して素の位置を測る
   *  1. 箱ごと下げる（margin-top。transformやpositionは中のfixed/absoluteの基準を変えるので使わない）。
   *     下げてよい量 = 箱の下の空き。情報パネルが下にある時は、パネルが最低 MIN_INFO_VISIBLE(120)px 見える所まで。
   *     ただし動画の下端が再生バーに潜らない範囲
   *  2. コンパクト表示（is-compact: タイトル・メタ情報の文字と余白を詰める）
   *  3. タグ欄に高さの上限（is-tagsClamped: あふれた分はタグ欄の中でスクロール。最低1行は見せる）
   *  4. 残りだけヘッダー自体を下げる（動画の上端に重なる。動画の高さの1/4まで）
   * どの段階でも、最終的なヘッダーの上端が SAFE_TOP px 以上になれば終了する。
   */
  static layoutOutsideHeader(view) {
    const SAFE_TOP = 4;
    const MIN_INFO_VISIBLE = 120;
    const body = document.body;
    const container = view.closest('.zenzaPlayerContainer') ||
      document.querySelector('.zenzaPlayerContainer');
    const inner = view.closest('.zenzaVideoPlayerDialogInner') ||
      document.querySelector('.zenzaVideoPlayerDialogInner');
    const prev = {
      dialogShift: parseFloat(body.style.getPropertyValue('--zenza-dialog-shift-y')) || 0,
      compact: view.classList.contains('is-compact'),
      clamped: view.classList.contains('is-tagsClamped'),
      headerShift: parseFloat(view.style.getPropertyValue('--zenza-header-outside-shift')) || 0
    };
    // 0. 全部戻して素の位置を測る
    VideoHeaderPanel.resetOutsideLayout(view);
    const result = {
      dialogShift: 0, compact: false, tagsMax: null, headerShift: 0,
      headerTop: null, changed: false
    };
    const finish = () => {
      result.headerTop = Math.round(view.getBoundingClientRect().top);
      result.changed = prev.dialogShift !== result.dialogShift ||
        prev.compact !== result.compact ||
        prev.clamped !== (result.tagsMax !== null) ||
        prev.headerShift !== result.headerShift;
      return result;
    };
    if (!container || !inner) {
      return finish();
    }
    let hRect = view.getBoundingClientRect();
    if (hRect.height <= 0) {
      return finish();
    }
    const over = () => SAFE_TOP - view.getBoundingClientRect().top;
    if (over() <= 0) {
      return finish();
    }
    body.classList.add('zenzaHeaderOutsideActive');

    // 1. 箱ごと下げる
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const cRect = container.getBoundingClientRect();
    const iRect = inner.getBoundingClientRect();
    const bar = container.querySelector('.videoControlBar');
    let floor = viewportH; // 動画の下端がこれより下に行かないようにする
    if (bar) {
      const bRect = bar.getBoundingClientRect();
      const barFixed = window.getComputedStyle(bar).position === 'fixed';
      if (barFixed && bRect.height > 0 && bRect.top > cRect.top) {
        floor = Math.min(floor, bRect.top);
      }
    }
    const containerRoom = Math.max(0, Math.floor(floor - cRect.bottom));
    let boxRoom = Math.max(0, Math.floor(viewportH - iRect.bottom));
    const info = inner.querySelector('.zenzaWatchVideoInfoPanel');
    if (info) {
      const infoRect = info.getBoundingClientRect();
      const infoBelow = infoRect.height > 0 && infoRect.top >= cRect.bottom - 2;
      if (infoBelow) {
        const visible = Math.min(viewportH, floor) - infoRect.top;
        boxRoom = Math.max(boxRoom, Math.floor(visible - MIN_INFO_VISIBLE));
      }
    }
    const dialogShift = Math.max(0, Math.min(Math.ceil(over()), containerRoom, boxRoom));
    if (dialogShift > 0) {
      body.style.setProperty('--zenza-dialog-shift-y', `${dialogShift}px`);
      result.dialogShift = dialogShift;
    }
    if (over() <= 0) {
      return finish();
    }

    // 2. コンパクト表示
    view.classList.add('is-compact');
    result.compact = true;
    if (over() <= 0) {
      // 小さくして余った分だけ、箱を下げる量を戻す（情報パネルをなるべく多く見せる）
      const spare = Math.floor(-over());
      if (spare > 0 && result.dialogShift > 0) {
        result.dialogShift = Math.max(0, result.dialogShift - spare);
        body.style.setProperty('--zenza-dialog-shift-y', `${result.dialogShift}px`);
      }
      return finish();
    }

    // 3. タグ欄に高さの上限（最低1行）
    const tags = view.querySelector('.videoTagsContainer');
    if (tags) {
      const tRect = tags.getBoundingClientRect();
      // タグの一覧はシャドウDOMの中にあることがあるので、両方探す
      const host = tags.firstElementChild;
      const firstItem = tags.querySelector('li') ||
        (host && host.shadowRoot && host.shadowRoot.querySelector('li'));
      const rowH = firstItem ? Math.ceil(firstItem.getBoundingClientRect().height + 4) : 28;
      const minH = Math.max(28, rowH);
      if (tRect.height > minH) {
        const max = Math.max(minH, Math.floor(tRect.height - Math.ceil(over())));
        view.style.setProperty('--zenza-header-tags-max', `${max}px`);
        view.classList.add('is-tagsClamped');
        result.tagsMax = max;
      }
    }
    if (over() <= 0) {
      return finish();
    }

    // 4. 残りだけヘッダー自体を下げる（動画の上端に重なる。動画の高さの1/4まで）
    const limit = Math.floor(container.getBoundingClientRect().height / 4);
    const headerShift = Math.max(0, Math.min(Math.ceil(over()), limit));
    if (headerShift > 0) {
      view.style.setProperty('--zenza-header-outside-shift', `${headerShift}px`);
      result.headerShift = headerShift;
    }
    return finish();
  }
  // @@TASK076_LAYOUT_END
  appendTo(node) {
    this._initializeDom();
    this._$view.appendTo(node);
  }
  hide() {
    if (!this._$view) {
      return;
    }
    this.classList.remove('show');
  }
  close() {
  }
  clear() {
    if (!this._$view) {
      return;
    }
    this.classList.add('initializing');

    this._videoTitle.textContent = '';
  }
  getPublicStatusDom() {
    return this._$view.find('.publicStatus').html();
  }
}

css.addStyle(`
  .zenzaScreenMode_small .zenzaWatchVideoHeaderPanel {
    display: none;
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoHeaderPanel {
    top: 0;
    left: 400px;
    width: calc(100vw - 400px);
    bottom: auto;
    background: #272727;
    opacity: 0.9;
    height: 40px;
  }
  /* ヘッダ追従 */
  body.zenzaScreenMode_sideView:not(.nofix)  .zenzaWatchVideoHeaderPanel {
    top: 0;
  }
  /* ヘッダ固定 */
  .zenzaScreenMode_sideView .zenzaWatchVideoHeaderPanel .videoTitleContainer {
    margin: 0;
  }
  .zenzaScreenMode_sideView .zenzaWatchVideoHeaderPanel .publicStatus,
  .zenzaScreenMode_sideView .zenzaWatchVideoHeaderPanel .videoTagsContainer {
    display: none;
  }

  @media screen and (min-width: 1432px)
  {
    .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .tabSelectContainer {
      width: calc(100% - 16px);
    }
    .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel {
      top: calc((100vw - 1024px) * 9 / 16 + 4px);
      width: calc(100vw - 1024px);
      height: calc(100vh - (100vw - 1024px) * 9 / 16 - 70px);
    }

    .zenzaScreenMode_sideView .zenzaWatchVideoInfoPanel .videoTagsContainer {
      width: calc(100vw - 1024px - 26px);
    }

    .zenzaScreenMode_sideView .zenzaWatchVideoHeaderPanel {
      width: calc(100vw - (100vw - 1024px));
      left:  calc(100vw - 1024px);
    }
  }

`, {className: 'screenMode for-popup videoHeaderPanel', disabled: true});

css.addStyle(`
  body .is-open .zenzaWatchVideoHeaderPanel {
    width: calc(100% + ${CONSTANT.RIGHT_PANEL_WIDTH}px);
  }
    .zenzaWatchVideoHeaderPanel.is-onscreen {
      top: 0px;
      bottom: auto;
      background: rgba(0, 0, 0, 0.5);
      opacity: 0;
      box-shadow: none;
    }

    .is-loading .zenzaWatchVideoHeaderPanel.is-onscreen {
      opacity: 0.6;
      transition: 0.4s opacity;
    }

    .zenzaWatchVideoHeaderPanel.is-onscreen:hover {
      opacity: 1;
      transition: 0.5s opacity;
    }

    .zenzaWatchVideoHeaderPanel.is-onscreen:not(:hover) .videoTagsContainer {
      display: none;
    }
    .zenzaWatchVideoHeaderPanel.is-onscreen .videoTitleContainer {
      width: calc(100% - 220px);
    }

    .zenzaWatchVideoInfoPanelFoot {
      background: #222;
    }

`, {className: 'screenMode for-dialog videoHeaderPanel', disabled: true});

css.addStyle(`
  .is-open .zenzaWatchVideoHeaderPanel {
    position: absolute; /* fixedだとFirefoxのバグでおかしくなる */
    top: 0px;
    bottom: auto;
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    box-shadow: none;
  }

  .is-loading .zenzaWatchVideoHeaderPanel,
  .is-mouseMoving .zenzaWatchVideoHeaderPanel {
    opacity: 0.6;
    transition: 0.4s opacity;
  }

  .is-open .showVideoHeaderPanel .zenzaWatchVideoHeaderPanel,
  .is-open .zenzaWatchVideoHeaderPanel:hover {
    opacity: 1;
    transition: 0.5s opacity;
  }

  .is-open .zenzaWatchVideoHeaderPanel:not(:hover) .videoTagsContainer {
    display: none;
  }

  .is-open .zenzaWatchVideoHeaderPanel .videoTitleContainer {
    width: calc(100% - 220px);
  }

`, {className: 'screenMode for-full videoHeaderPanel', disabled: true});

VideoHeaderPanel.__css__ = (`
    .zenzaWatchVideoHeaderPanel {
      position: absolute;
      width: calc(100%);
      z-index: 30000;
      box-sizing: border-box;
      padding: 8px 8px 0;
      bottom: calc(100% + 8px);
      left: 0;
      background: #333;
      color: #ccc;
      text-align: left;
      box-shadow: 4px 4px 4px #000;
      transition: opacity 0.4s ease;
      will-change: transform;
    }
    .zenzaWatchVideoHeaderPanel.is-onscreen {
      width: 100% !important;
    }

    /* Task 076: 「常に動画の外」でヘッダーが収まらない時の収め方（layoutOutsideHeader）。
       JSが実測して zenzaHeaderOutsideActive / is-compact / is-tagsClamped を付ける。
       画面モードが変わった瞬間に効かなくなるよう、通常・大モードの時だけ有効にしている。 */
    /* 1. プレイヤーの箱ごと下げる。箱は flex の align-items:center で中央にあるため、
          margin-top を「下げたい量×2」にすると箱がちょうど「下げたい量」だけ下がる。
          transform や position:relative は中の fixed/absolute の基準を変えるので使わない */
    body.zenzaScreenMode_normal.zenzaHeaderOutsideActive .zenzaVideoPlayerDialogInner,
    body.zenzaScreenMode_big.zenzaHeaderOutsideActive    .zenzaVideoPlayerDialogInner {
      margin-top: calc(var(--zenza-dialog-shift-y, 0px) * 2);
    }
    /* 2. コンパクト表示（文字と余白を小さくする） */
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen),
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen) {
      padding-top: 4px;
    }
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen) .videoTitle,
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen) .videoTitle {
      font-size: 18px;
      padding: 0;
    }
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen) .videoTitleContainer,
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen) .videoTitleContainer {
      margin: 2px 8px;
    }
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen) .videoTagsContainer,
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-compact:not(.is-fullscreen) .videoTagsContainer {
      font-size: 12px;
    }
    /* 3. タグ欄に高さの上限。あふれた分はタグ欄の中でスクロール */
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-tagsClamped:not(.is-fullscreen) .videoTagsContainer,
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-tagsClamped:not(.is-fullscreen) .videoTagsContainer {
      max-height: var(--zenza-header-tags-max, none);
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }
    /* 4. 残りだけヘッダー自体を下げる（Task 072 から） */
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-outsideFixed:not(.is-onscreen):not(.is-fullscreen),
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-outsideFixed:not(.is-onscreen):not(.is-fullscreen) {
      transform: translateY(var(--zenza-header-outside-shift, 0px));
    }

    /* Task 076 (D-18): 入力中・メニュー表示中・マウスが出てから1.5秒は、隠れる設定でも表示し続ける */
    .zenzaWatchVideoHeaderPanel.is-hold {
      opacity: 1 !important;
      pointer-events: auto !important;
      transition: opacity 0.2s ease;
    }
    body:not(.zenzaScreenMode_sideView):not(.zenzaScreenMode_small) .zenzaWatchVideoHeaderPanel.is-hold .videoTagsContainer {
      display: block !important;
    }

    /* Task 072: 表示位置「常に動画に重ねる（隠さない）」 */
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-onscreen.is-overlayVisible,
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-onscreen.is-overlayVisible {
      opacity: 1 !important;
      pointer-events: auto;
    }
    body.zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-onscreen.is-overlayVisible .videoTagsContainer,
    body.zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-onscreen.is-overlayVisible .videoTagsContainer {
      display: block !important;
    }
    .zenzaScreenMode_sideView .zenzaWatchVideoHeaderPanel,
    .zenzaWatchVideoHeaderPanel.is-fullscreen {
      z-index: 20000;
    }

    .zenzaWatchVideoHeaderPanel {
      pointer-events: none;
    }

    .is-mouseMoving .zenzaWatchVideoHeaderPanel,
                    .zenzaWatchVideoHeaderPanel:hover {
      pointer-events: auto;
    }

    .zenzaWatchVideoHeaderPanel.initializing {
      display: none;
    }
    .zenzaWatchVideoHeaderPanel.initializing>*{
      opacity: 0;
    }

    .zenzaWatchVideoHeaderPanel .videoTitleContainer {
      margin: 8px;
    }
    .zenzaWatchVideoHeaderPanel .publicStatus {
      position: relative;
      color: #ccc;
    }

    .zenzaWatchVideoHeaderPanel .videoTitle {
      font-size: 24px;
      color: #fff;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
      display: block;
      padding: 2px 0;
    }

    .zenzaWatchVideoHeaderPanel .videoTitle::before {
      display: none;
      position: absolute;
      font-size: 12px;
      top: 0;
      left: 0;
      background: #333;
      border: 1px solid #888;
      padding: 2px 4px;
      pointer-events: none;
    }
    .zenzaWatchVideoHeaderPanel.is-mymemory:not(:hover) .videoTitle::before {
      content: 'マイメモリー';
      display: inline-block;
    }
    .zenzaWatchVideoHeaderPanel.is-community:not(:hover) .videoTitle::before {
      content: 'コミュニティ動画';
      display: inline-block;
    }

    .videoMetaInfoContainer {
      display: inline-block;
    }

    .zenzaScreenMode_normal .is-backComment .zenzaWatchVideoHeaderPanel,
    .zenzaScreenMode_big    .is-backComment .zenzaWatchVideoHeaderPanel {
      opacity: 0.7;
    }

    .zenzaWatchVideoHeaderPanel .relatedInfoMenuContainer {
      display: inline-block;
      position: absolute;
      top: 0;
      margin: 0 16px;
      z-index: 1000;
    }

    .zenzaWatchVideoHeaderPanel:focus-within,
    .zenzaWatchVideoHeaderPanel.is-relatedMenuOpen {
      z-index: 50000;
    }

    .zenzaWatchVideoHeaderPanel .series-thumbnail-cover {
      position: absolute;
      top: 0px;
      right: 0px;
      width: 50%;
      height: 100%;
      display: inline-block;
      overflow: hidden;
      contain: strict;
      pointer-events: none;
      user-select: none;
    }
    .zenzaWatchVideoHeaderPanel .series-thumbnail[style] {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      /*filter: sepia(50%) blur(4px);*/
      background-size: cover;
      background-position: center center;
      background-repeat: no-repeat;
      will-change: transform;
      -webkit-mask-image:
        linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 100%);
      mask-image:
        linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 100%);
    }
  `);

// Task 076 (D-18): マウスがヘッダーから出てから消えるまでの猶予
VideoHeaderPanel.HOLD_LINGER_MS = 1500;

VideoHeaderPanel.__tpl__ = (`
    <div class="zenzaWatchVideoHeaderPanel show initializing" style="display: none;">
      <h2 class="videoTitleContainer">
        <span class="videoTitle"></span>
      </h2>
      <p class="publicStatus">
        <span class="videoMetaInfoContainer"></span>
        <span class="relatedInfoMenuContainer"></span>
      </p>
      <div class="videoTagsContainer videoHeader">
      </div>
      <div class="series-thumbnail-cover"><div class="series-thumbnail"></div></div>
    </div>
  `).trim();


class VideoSearchForm extends Emitter {
  constructor(...args) {
    super();
    this._config = Config.namespace('videoSearch');
    this._initDom(...args);
  }

  _initDom({parentNode}) {
    let tpl = document.getElementById('zenzaVideoSearchPanelTemplate');
    if (!tpl) {
      cssUtil.addStyle(VideoSearchForm.__css__);
      tpl = document.createElement('template');
      tpl.innerHTML = VideoSearchForm.__tpl__;
      tpl.id = 'zenzaVideoSearchPanelTemplate';
    }
    const view = document.importNode(tpl.content, true);

    this._view = view.querySelector('*');
    this._form = view.querySelector('form');
    this._word = view.querySelector('.searchWordInput');
    this._videoIdBox = view.querySelector('.searchVideoIdResult');
    this._videoIdList = view.querySelector('.searchVideoIdResult-list');
    // Task 068: 並び順は「キー」と「昇順/降順」の2つのselectに分けた（本家と同じ9種類）。
    // 保存形式は従来通り videoSearch.sort に "キー" または "キー,a|d"（"playlist"は自動）。
    this._sortKey = view.querySelector('.searchSortKeySelect');
    this._sortOrder = view.querySelector('.searchOrderSelect');
    this._mode = view.querySelector('.searchMode') || 'tag';

    this._form.addEventListener('submit', this._onSubmit.bind(this));

    const config = this._config;
    const form = this._form;

    // Task 073: 「再生中の動画の投稿者の動画のみ」。以前はdisabledのまま（取り消し線付きで
    // チェックできない状態）だった。誤って絞り込んだまま検索し続けないよう、開くたびにOFFへ戻す。
    // 将来この項目をテンプレートから削除しても動くよう、要素が無い場合は何もしない。
    config.props.ownerOnly = false;
    const ownerOnlyInput = this._ownerOnlyInput;
    if (ownerOnlyInput) {
      ownerOnlyInput.checked = false;
    }
    const confMode = config.props.mode;
    if (typeof confMode === 'string' && ['tag', 'keyword'].includes(confMode)) {
      form['mode'].value = confMode;
    } else if (typeof confMode === 'boolean') {
      form['mode'].value = confMode ? 'tag' : 'keyword';
    } else {
      form['mode'].value = 'tag';
    }
    form['word'].value = config.props.word;
    this._applySortValue(config.props.sort);
    form['f_range'].value = `${config.props.f_range || 0}`;
    form['l_range'].value = `${config.props.l_range || 0}`;
    form['genre'].value = config.props.genre || 'all';
    if (!form['genre'].value) { form['genre'].value = 'all'; }

    // Task 073: 以前の「入力欄の下に出る小さなタグ候補リスト」(_initSuggest)は廃止し、
    // 普通の単語でも動画ID入力時と同じ「検索（件数）＋タグ予測」の枠で表示する。
    this._initVideoIdPreview();
    this._view.addEventListener('click', this._onClick.bind(this));
    // Task 071: 以前は DocumentFragment（view）に付けていたため一度も発火せず、
    // 検索欄への貼り付けがプレイヤー全体の貼り付け処理（動画IDならすぐ開く）へ伝わっていた。
    // 検索欄の中の貼り付けは、ここで止めて検索欄の下に動画を表示する。
    this._view.addEventListener('paste', e => e.stopPropagation());
    const submit = _.debounce(this.submit.bind(this), 500);
    Array.from(view.querySelectorAll('input, select')).forEach(item => {
      if (item.type === 'checkbox') {
        item.addEventListener('change', () => {
          this._word.focus();
          config.props[item.name] = item.checked;
          submit();
        });
      } else if (item.type === 'radio') {
        item.addEventListener('change', () => {
          this._word.focus();
          config.props[item.name] = this._form[item.name].value;
          submit();
        });
      } else if (item.name === 'sortKey' || item.name === 'sortOrder') {
        item.addEventListener('change', () => {
          config.props.sort = this._composeSortValue();
          this._updateOrderState();
          submit();
        });
      } else {
        item.addEventListener('change', () => {
          config.props[item.name] = item.value;
          if (item.tagName === 'SELECT') {
            submit();
          }
        });
      }
    });

    // Task 074: ヘッダーのジャンルバッジから、検索欄のジャンル絞り込みを設定する
    global.emitter.on('setSearchGenre', key => {
      const genreSelect = this._form.elements.namedItem('genre');
      if (!genreSelect) { return; }
      const value = key && Array.from(genreSelect.options).some(o => o.value === key) ? key : 'all';
      genreSelect.value = value;
      config.props.genre = value;
      const label = genreSelect.options[genreSelect.selectedIndex];
      domEvent.dispatchCommand(this._view, 'notify',
        value === 'all' ?
          'ジャンルの絞り込みを解除しました' :
          `検索のジャンルを「${label ? label.textContent : value}」に設定しました`);
      this._word.focus();
      this._updateVideoIdSearchRow(true);
    });

    global.emitter.on('searchVideo', ({word}) => {
      form['word'].value = word;
      // Task 073: 検索が実行された語は、次に入力を変えるまで予測枠を出さない
      // （タグのクリック等で検索した時に、裏で予測や件数の問い合わせが走らないように）
      this._videoIdDismissedKey = this._videoIdKeyOf(word);
      this._updateVideoIdPreview();
    });

    if (parentNode) {
      parentNode.appendChild(view);
    }

    global.debug.searchForm = this;
  }

  /*
   * Task 071: 検索欄に動画ID（sm/nm/so + 数字、視聴URL、nico.ms 短縮URL）を入力・貼り付けすると、
   * すぐに開くのではなく、検索欄の下にその動画のカードをアニメーション付きで表示する。
   * - 手入力でも貼り付けでも動く（input イベントで判定）
   * - 空白・読点・改行区切りで最大5件まで同時に表示（全部が動画IDの時だけ。1つでも普通の語があれば通常の検索扱い）
   * - カードのクリック/▶再生/Enter で開く。次に再生・末尾に追加・とりあえずマイリストも可能
   * - ↑↓でカードを選択、Esc で閉じる（入力を変えると再表示）
   */
  static parseVideoIds(text) {
    return VideoSearchForm.parseVideoIdInput(text).ids;
  }

  /*
   * Task 071 追加: sm114514 のように「動画IDでありながらタグ（検索語）としても使われる単語」がある。
   * そのため、URLを含まない素の動画IDだけの入力（bare）は、動画カードを出しつつ検索語としても扱う
   * （Enter/▶ は通常の検索、カードのクリックや ↓ で選んで Enter / Shift+Enter で再生）。
   * 視聴URL・nico.ms など検索語になり得ない形が含まれる時だけ、Enter で動画を開く。
   */
  static parseVideoIdInput(text) {
    const src = String(text || '').trim();
    const empty = {ids: [], bare: false};
    if (!src) {
      return empty;
    }
    const tokens = src.split(/[\s,、，　]+/).filter(Boolean);
    const ids = [];
    let bare = true;
    for (const token of tokens) {
      const m = VideoSearchForm.VIDEO_ID_REG.exec(token);
      if (!m) {
        return empty;
      }
      if (token.length !== m[1].length) {
        bare = false;
      }
      const id = m[1].toLowerCase();
      ids.includes(id) || ids.push(id);
    }
    return {ids: ids.slice(0, VideoSearchForm.MAX_VIDEO_ID_CARDS), bare};
  }

  _initVideoIdPreview() {
    this._videoIdKey = '';
    this._videoIdDismissedKey = '';
    this._videoIdCards = new Map();
    this._videoIdBare = false;
    this._videoIdNavKey = '';
    this._videoIdTagWord = '';
    this._videoIdTagSeq = 0;
    this._videoIdTagsElm = this._videoIdBox ? this._videoIdBox.querySelector('.searchVideoIdResult-tags') : null;
    this._wordCountCache = new Map();
    this._wordCountSeq = 0;
    const input = this._word, box = this._videoIdBox;
    if (!input || !box) {
      return;
    }
    const update = _.debounce(() => this._updateVideoIdPreview(), 120);
    input.addEventListener('input', () => update());
    input.addEventListener('compositionend', () => update());
    input.addEventListener('paste', () => window.setTimeout(() => this._updateVideoIdPreview(), 0));
    input.addEventListener('keydown', e => this._onVideoIdKeyDown(e), true);
    /*
     * Task 074: 「入力欄を触っているのに予測が出ない」ことがある件の対処。
     * 検索を実行した語・Escで閉じた語は、入力を変えるまで再表示しない作りにしていた
     * （裏で予測や件数を何度も取りに行かないようにするため）。そのため
     * 「検索した後にもう一度入力欄をクリックした」「起動直後で前回の語が入っている」
     * 場合に何も出ず、分かりづらかった。
     * 入力欄にフォーカスし直した時と、↓キーを押した時は、もう一度出すようにする。
     */
    input.addEventListener('focus', () => {
      if (this._videoIdDismissedKey && this.word) {
        this._videoIdDismissedKey = '';
        this._videoIdKey = '';
        this._updateVideoIdPreview();
      }
    });
    // ボタンを押しても入力欄からフォーカスが外れない（外れるとパネルごと閉じる）ようにする
    box.addEventListener('mousedown', e => {
      if (e.button === 0) {
        e.preventDefault();
      }
    });
    // Task 073: マウスを乗せたタグ候補も「選択中」にする（件数もその候補について数える）
    box.addEventListener('mouseover', e => {
      const tag = e.target.closest && e.target.closest('.searchVideoIdResult-tag:not(.is-leaving)');
      if (!tag) { return; }
      const key = `tag:${tag.dataset.word}`;
      if (key !== this._videoIdNavKey) {
        this._videoIdNavKey = key;
        this._updateVideoIdSelection();
      }
    });
    box.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (e.target.closest('.searchVideoIdResult-search')) {
        this._submitVideoIdAsWord();
        return;
      }
      const tag = e.target.closest('.searchVideoIdResult-tag');
      if (tag) {
        this._selectVideoIdTag(tag.dataset.word);
        return;
      }
      const card = e.target.closest('.searchVideoCard');
      if (!card) {
        return;
      }
      const button = e.target.closest('[data-action]');
      const action = button ? button.dataset.action : 'open';
      this._execVideoIdAction(action, card.dataset.watchId, button || card);
    });
    Array.from(this._form.querySelectorAll('.searchMode')).forEach(radio =>
      radio.addEventListener('change', () => this._updateVideoIdSearchRow(true)));
    // Task 073: 件数は期間・長さ・ジャンルの絞り込みも反映するので、変えたら数え直す
    ['f_range', 'l_range', 'genre', 'ownerOnly'].forEach(name => {
      const elm = this._form.elements.namedItem(name);
      elm && elm.addEventListener && elm.addEventListener('change', () => {
        this._updateVideoIdSearchRow(true);
        this._updateVideoIdSelection();
      });
    });
    // 起動直後（前回の検索語が入った状態）は、入力を変えるまで予測枠を出さない
    this._videoIdDismissedKey = this._videoIdKeyOf(input.value);
    // Task 072: タグ予測の表示方式（A/B/C）
    this._applyVideoIdSuggestMode();
    this._config.onkey('videoIdSuggestMode', () => {
      this._applyVideoIdSuggestMode();
      this._videoIdKey = '';
      this._updateVideoIdPreview();
    });
    this._updateVideoIdPreview();
  }

  get videoIdSuggestMode() {
    const mode = this._config.props.videoIdSuggestMode;
    return VideoSearchForm.VIDEO_ID_SUGGEST_MODES.includes(mode) ? mode : 'merged';
  }

  _applyVideoIdSuggestMode() {
    const box = this._videoIdBox;
    if (!box) { return; }
    const mode = this.videoIdSuggestMode;
    VideoSearchForm.VIDEO_ID_SUGGEST_MODES.forEach(m => box.classList.toggle(`is-mode-${m}`, m === mode));
  }

  _videoIdKeyOf(text) {
    const {ids, bare} = VideoSearchForm.parseVideoIdInput(text);
    if (!ids.length) {
      // Task 073: 普通の単語（語ごとに別のキー。空なら空）
      const word = String(text || '').trim();
      return word ? `k:${word}` : '';
    }
    return `${bare ? 'w' : 'u'}:${ids.join(',')}`;
  }

  _updateVideoIdPreview() {
    const {ids, bare: idBare} = VideoSearchForm.parseVideoIdInput(this._word.value);
    // Task 073: 動画IDではない普通の単語でも、同じ枠で「検索（件数）＋タグ予測」を出す
    const wordOnly = !ids.length && !!this.word;
    const bare = idBare || wordOnly;
    const key = this._videoIdKeyOf(this._word.value);
    if (key !== this._videoIdDismissedKey) {
      this._videoIdDismissedKey = '';
    }
    const visible = (ids.length > 0 || wordOnly) && !this._videoIdDismissedKey;
    if (key === this._videoIdKey && visible === this._videoIdBox.classList.contains('is-open')) {
      return;
    }
    const keyChanged = this._videoIdKey !== key;
    this._videoIdKey = key;
    this._videoIdBare = bare;
    this._view.classList.toggle('is-videoIdMode', ids.length > 0);
    window.clearTimeout(this._videoIdCleanupTimer);
    if (!visible) {
      this._videoIdBox.classList.remove('is-open');
      this._videoIdNavKey = '';
      window.clearTimeout(this._videoIdWaitTimer);
      this._videoIdTagSeq++;
      // 閉じるアニメーションの後にカードを片付ける（次に表示した時も登場アニメーションから始まるように）
      this._videoIdCleanupTimer = window.setTimeout(() => {
        if (this._videoIdBox.classList.contains('is-open')) { return; }
        this._videoIdCards.clear();
        this._videoIdList.textContent = '';
        this._videoIdTagsElm && (this._videoIdTagsElm.textContent = '');
        this._videoIdTagWord = '';
        this._videoIdKey = '';
      }, 400);
      return;
    }
    const list = this._videoIdList;
    const cards = this._videoIdCards;
    for (const [id, card] of cards) {
      if (!ids.includes(id)) {
        cards.delete(id);
        this._removeVideoCard(card);
      }
    }
    let delay = 0;
    ids.forEach((id, i) => {
      let card = cards.get(id);
      if (!card) {
        card = this._createVideoCard(id);
        card.style.setProperty('--card-delay', `${delay++ * 70}ms`);
        cards.set(id, card);
      }
      // 並び順を入力順に合わせる（退場中のカードより前に置く）
      const current = list.querySelectorAll('.searchVideoCard:not(.is-leaving)')[i];
      if (current !== card) {
        list.insertBefore(card, current || null);
      }
    });
    const box = this._videoIdBox;
    // Task 072: C（delayed）は入力が止まってから動画カードを出す。カードの情報取得は先に始めておく
    if (this.videoIdSuggestMode === 'delayed' && !wordOnly) {
      if (keyChanged) {
        box.classList.add('is-cardsWaiting');
        window.clearTimeout(this._videoIdWaitTimer);
        this._videoIdWaitTimer = window.setTimeout(() => {
          box.classList.remove('is-cardsWaiting');
          this._updateVideoIdSelection();
        }, VideoSearchForm.VIDEO_ID_CARD_DELAY_MS);
      }
    } else {
      window.clearTimeout(this._videoIdWaitTimer);
      box.classList.remove('is-cardsWaiting');
    }
    // Task 072: 素の動画ID（検索語にもなる入力）の時は、本家と同じタグ予測も出す
    if (bare) {
      this._requestVideoIdTags(this.word);
    } else {
      this._videoIdTagSeq++;
      this._renderVideoIdTags([], '');
    }
    // 検索語としても使える入力（bare）は、最初は「検索」行を選ぶ（Enterは通常の検索）。URLは先頭の動画
    if (keyChanged || !this._findVideoIdNavItem(this._videoIdNavKey)) {
      this._videoIdNavKey = this._defaultVideoIdNavKey();
    }
    this._updateVideoIdSelection();
    box.classList.toggle('is-multi', ids.length > 1);
    box.classList.toggle('is-bare', bare);
    box.classList.toggle('is-word', wordOnly);
    box.querySelector('.searchVideoIdResult-label').textContent =
      wordOnly ? '検索予測' : (ids.length > 1 ? `動画ID ${ids.length}件` : '動画ID');
    const hint = box.querySelector('.searchVideoIdResult-hint');
    if (wordOnly) {
      hint.textContent = 'Enter 検索・↑↓ 選択・Esc 閉じる';
      hint.title = 'Enter: 選んでいる行を実行（検索／タグで検索）　↑↓: 選択　Esc: 閉じる';
    } else if (bare) {
      hint.textContent = 'Enter 検索・↑↓ 選択・Shift+Enter 再生';
      hint.title = 'Enter: 選んでいる行を実行（検索／タグで検索／動画を再生）　↑↓: 選択　Shift+Enter: 動画を再生　Esc: 閉じる';
    } else {
      hint.textContent = ids.length > 1 ? '↑↓ 選択・Enter 再生・Esc 閉じる' : 'Enter 再生・Esc 閉じる';
      hint.title = 'クリック/Enter: 再生　Shift+Enter: 次に再生　↑↓: 選択(複数の時)　Esc: 閉じる';
    }
    this._updateVideoIdSearchRow();
    this._videoIdBox.classList.add('is-open');
  }

  _removeVideoCard(card) {
    card.classList.add('is-leaving');
    const remove = () => card.remove();
    card.addEventListener('animationend', e => e.target === card && remove());
    window.setTimeout(remove, 400);
  }

  _createVideoCard(watchId) {
    const card = document.createElement('div');
    card.className = 'searchVideoCard is-loading';
    card.dataset.watchId = watchId;
    card.setAttribute('role', 'button');
    card.title = `${watchId} を再生`;
    card.innerHTML = `
      <div class="searchVideoCard-main">
        <div class="searchVideoCard-thumb">
          <img class="searchVideoCard-image" alt="" decoding="async">
          <span class="searchVideoCard-duration"></span>
          <span class="searchVideoCard-play">&#x25B6;</span>
        </div>
        <div class="searchVideoCard-body">
          <div class="searchVideoCard-id"></div>
          <div class="searchVideoCard-title"><span class="skeleton"></span><span class="skeleton short"></span></div>
          <div class="searchVideoCard-meta"><span class="skeleton tiny"></span></div>
        </div>
      </div>
      <div class="searchVideoCard-actions">
        <button type="button" class="searchVideoCard-button is-primary" data-action="open" title="今すぐ再生">&#x25B6; 再生</button>
        <button type="button" class="searchVideoCard-button" data-action="playlistInsert" title="プレイリストの次に入れる">次に再生</button>
        <button type="button" class="searchVideoCard-button" data-action="playlistAdd" title="プレイリストの最後に追加">末尾に追加</button>
        <button type="button" class="searchVideoCard-button" data-action="deflistAdd" title="とりあえずマイリストに登録">とりマイ</button>
      </div>
    `.trim();
    card.querySelector('.searchVideoCard-id').textContent = watchId;
    const image = card.querySelector('.searchVideoCard-image');
    image.addEventListener('load', () => card.classList.add('is-imageLoaded'), {once: true});
    image.addEventListener('error', () => card.classList.add('is-imageError'), {once: true});

    ThumbInfoLoader.load(watchId)
      .then(info => this._fillVideoCard(card, watchId, info))
      .catch(err => this._failVideoCard(card, watchId, err));
    return card;
  }

  _fillVideoCard(card, watchId, info) {
    if (!info || info.status === 'fail') {
      return this._failVideoCard(card, watchId, info);
    }
    const title = info.title || watchId;
    card.title = `${title}\n(${watchId})`;
    const image = card.querySelector('.searchVideoCard-image');
    const thumbnail = String(info.thumbnail_url || info.thumbnail || '').replace(/^http:/, 'https:');
    if (thumbnail) {
      image.src = thumbnail;
    } else {
      card.classList.add('is-imageError');
    }
    const duration = info.duration * 1;
    card.querySelector('.searchVideoCard-duration').textContent =
      isNaN(duration) ? '' : textUtil.secToTime(duration);
    const titleElm = card.querySelector('.searchVideoCard-title');
    titleElm.textContent = title;
    const meta = card.querySelector('.searchVideoCard-meta');
    meta.textContent = '';
    const addComma = n => (typeof n === 'number' && n.toLocaleString) ? n.toLocaleString() : (n || 0);
    const posted = info.postedAt ? new Date(info.postedAt) : null;
    const pad = n => `${n}`.padStart(2, '0');
    const items = [
      posted && !isNaN(posted.getTime()) ?
        `${posted.getFullYear()}/${pad(posted.getMonth() + 1)}/${pad(posted.getDate())} ${pad(posted.getHours())}:${pad(posted.getMinutes())}` : '',
      `再生 ${addComma(info.viewCount * 1)}`,
      `コメ ${addComma(info.commentCount * 1)}`,
      `マイ ${addComma(info.mylistCount * 1)}`
    ].filter(Boolean);
    items.forEach(text => {
      const span = document.createElement('span');
      span.textContent = text;
      meta.append(span);
    });
    const ownerName = info.owner && info.owner.name;
    if (ownerName) {
      const owner = document.createElement('span');
      owner.className = 'searchVideoCard-owner';
      owner.textContent = info.isChannel || (info.owner.type === 'channel') ? `ch: ${ownerName}` : ownerName;
      meta.append(owner);
    }
    card.classList.remove('is-loading');
    card.classList.add('is-loaded');
  }

  _failVideoCard(card, watchId, err) {
    const code = err && err.code;
    const message =
      code === 'DELETED' ? '削除された動画です' :
      code === 'NOT_FOUND' ? '動画が見つかりません' :
      code === 'COMMUNITY' ? 'コミュニティ限定などで情報を取得できません' :
      '動画情報を取得できませんでした';
    card.querySelector('.searchVideoCard-title').textContent = message;
    const meta = card.querySelector('.searchVideoCard-meta');
    meta.textContent = code === 'DELETED' || code === 'NOT_FOUND' ? '' : '再生は試せます';
    card.classList.remove('is-loading');
    card.classList.add('is-failed', 'is-imageError');
    if (code === 'DELETED' || code === 'NOT_FOUND') {
      card.classList.add('is-unavailable');
    }
  }

  // Task 072: ↑↓で移動する対象を「検索行 → タグ予測 → 動画カード」の1列にまとめて扱う（A/B/C共通）
  _videoIdNavItems() {
    const box = this._videoIdBox;
    const items = [];
    if (!box) { return items; }
    if (this._videoIdBare) {
      items.push({key: 'search', type: 'search', el: box.querySelector('.searchVideoIdResult-search')});
      Array.from(box.querySelectorAll('.searchVideoIdResult-tag:not(.is-leaving)')).forEach(el =>
        items.push({key: `tag:${el.dataset.word}`, type: 'tag', el, word: el.dataset.word}));
    }
    if (!box.classList.contains('is-cardsWaiting')) {
      Array.from(this._videoIdList.querySelectorAll('.searchVideoCard:not(.is-leaving)')).forEach(el =>
        items.push({key: `card:${el.dataset.watchId}`, type: 'card', el, watchId: el.dataset.watchId}));
    }
    return items;
  }

  _findVideoIdNavItem(key) {
    return key ? this._videoIdNavItems().find(item => item.key === key) : null;
  }

  _defaultVideoIdNavKey() {
    if (this._videoIdBare) {
      return 'search';
    }
    const first = VideoSearchForm.parseVideoIds(this._word.value)[0];
    return first ? `card:${first}` : '';
  }

  _updateVideoIdSelection() {
    const items = this._videoIdNavItems();
    if (!this._findVideoIdNavItem(this._videoIdNavKey)) {
      this._videoIdNavKey = this._defaultVideoIdNavKey();
    }
    const highlight = this._videoIdBare || items.length > 1;
    const box = this._videoIdBox;
    box && Array.from(box.querySelectorAll('.is-selected')).forEach(el => el.classList.remove('is-selected'));
    const selected = items.find(item => item.key === this._videoIdNavKey);
    if (!selected || !highlight || !selected.el) {
      return;
    }
    selected.el.classList.add('is-selected');
    if (selected.type !== 'search' && selected.el.scrollIntoView) {
      selected.el.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    }
    if (selected.type === 'tag') {
      this._requestTagCount(selected.el, selected.word);
    }
  }

  // Task 073: ↑↓やマウスで選んでいるタグ候補の件数（入力語と同じく、絞り込み条件を反映）
  _requestTagCount(li, word) {
    window.clearTimeout(this._tagCountTimer);
    // 問い合わせ前に別の候補へ移った場合、前の候補の「数えています」表示を消す
    const pending = this._tagCountPendingElm;
    if (pending && pending.classList.contains('is-counting')) {
      pending.classList.remove('is-counting');
    }
    this._tagCountPendingElm = null;
    const countElm = li && li.querySelector('.searchVideoIdResult-tagCount');
    if (!countElm || !word) {
      return;
    }
    const mode = this.searchType === 'tag' ? 'tag' : 'keyword';
    const cacheKey = this._wordCountCacheKey(word, mode);
    const render = count => {
      countElm.classList.remove('is-counting');
      countElm.textContent = typeof count === 'number' ? `${count.toLocaleString()}件` : '';
      countElm.classList.toggle('is-empty', count === 0);
    };
    if (!cacheKey) {
      render(null);
      return;
    }
    if (this._wordCountCache.has(cacheKey)) {
      render(this._wordCountCache.get(cacheKey));
      return;
    }
    countElm.textContent = '';
    countElm.classList.add('is-counting');
    this._tagCountPendingElm = countElm;
    // 候補を↑↓で素早く移動している間は問い合わせない（止まった候補だけ数える）
    this._tagCountTimer = window.setTimeout(() => {
      this._tagCountPendingElm = null;
      VideoSearchForm.fetchWordCount(word, mode, this.filterOptions)
        .then(count => {
          this._setWordCountCache(cacheKey, count);
          render(count);
        })
        .catch(() => render(null));
    }, VideoSearchForm.WORD_COUNT_DELAY_MS);
  }

  // 件数キャッシュのキー。「投稿者の動画のみ」は本家の検索APIで数えられないので件数を出さない(null)
  _wordCountCacheKey(word, mode) {
    if (this.isOwnerOnly) {
      return null;
    }
    return `${mode}:${JSON.stringify(this.filterOptions)}:${word}`;
  }

  _setWordCountCache(key, count) {
    const cache = this._wordCountCache;
    cache.set(key, count);
    // 長時間使っても増え続けないよう、古いものから捨てる
    while (cache.size > VideoSearchForm.WORD_COUNT_CACHE_SIZE) {
      cache.delete(cache.keys().next().value);
    }
  }

  _onVideoIdKeyDown(e) {
    if (e.isComposing || e.keyCode === 229) {
      return;
    }
    if (!this._videoIdBox.classList.contains('is-open')) {
      // Task 074: 閉じている時に↓キーを押したら、もう一度予測を出す
      if (e.key === 'ArrowDown' && this.word) {
        e.preventDefault();
        e.stopPropagation();
        this._videoIdDismissedKey = '';
        this._videoIdKey = '';
        this._updateVideoIdPreview();
      }
      return;
    }
    const {ids, bare: idBare} = VideoSearchForm.parseVideoIdInput(this._word.value);
    const wordOnly = !ids.length && !!this.word;
    if (!ids.length && !wordOnly) {
      return;
    }
    const bare = idBare || wordOnly;
    const items = this._videoIdNavItems();
    const current = items.find(item => item.key === this._videoIdNavKey);
    const selectedCardId = current && current.type === 'card' ? current.watchId : ids[0];
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey && selectedCardId) {
          this._execVideoIdAction(idBare ? 'open' : 'playlistInsert', selectedCardId);
          break;
        }
        if (!current || current.type === 'search') {
          bare ? this._submitVideoIdAsWord() : this._execVideoIdAction('open', ids[0]);
        } else if (current.type === 'tag') {
          this._selectVideoIdTag(current.word);
        } else {
          this._execVideoIdAction('open', current.watchId);
        }
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        if (items.length < 2) { return; }
        e.preventDefault();
        e.stopPropagation();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const index = Math.max(0, items.indexOf(current));
        this._videoIdNavKey = items[(index + delta + items.length) % items.length].key;
        this._updateVideoIdSelection();
        break;
      }
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this._videoIdDismissedKey = this._videoIdKey;
        this._updateVideoIdPreview();
        break;
    }
  }

  // Task 072: 本家と同じタグ予測（sug.search）を、動画IDの入力でも取得する
  async _requestVideoIdTags(word) {
    if (word === this._videoIdTagWord) {
      return;
    }
    this._videoIdTagWord = word;
    const seq = ++this._videoIdTagSeq;
    let items = [];
    try {
      items = await TagSuggestLoader.load(word);
    } catch (err) {
      window.console.warn('タグ予測の取得に失敗', word, err);
    }
    if (seq !== this._videoIdTagSeq || this.word !== word) {
      return;
    }
    this._renderVideoIdTags(items || [], word);
  }

  _renderVideoIdTags(items, word) {
    const ul = this._videoIdTagsElm;
    if (!ul) { return; }
    const lower = String(word || '').toLowerCase();
    // 入力と同じ語は「検索」行と重複するので出さない
    const words = items.filter(w => String(w).toLowerCase() !== lower).slice(0, VideoSearchForm.MAX_VIDEO_ID_TAGS);
    const current = new Map(Array.from(ul.querySelectorAll('.searchVideoIdResult-tag:not(.is-leaving)'))
      .map(li => [li.dataset.word, li]));
    current.forEach((li, w) => {
      if (!words.includes(w)) {
        li.classList.add('is-leaving');
        window.setTimeout(() => li.remove(), 200);
      }
    });
    let delay = 0;
    words.forEach((w, i) => {
      let li = current.get(w);
      if (!li) {
        li = document.createElement('li');
        li.className = 'searchVideoIdResult-tag';
        li.setAttribute('role', 'option');
        li.dataset.word = w;
        li.title = `「${w}」で検索`;
        const icon = document.createElement('span');
        icon.className = 'searchVideoIdResult-tagIcon';
        icon.textContent = '#';
        const text = document.createElement('span');
        text.className = 'searchVideoIdResult-tagText';
        text.textContent = w;
        // Task 073: 選択中の候補だけ件数を問い合わせて表示する（取得済みの件数はそのまま残す）
        const count = document.createElement('span');
        count.className = 'searchVideoIdResult-tagCount';
        li.append(icon, text, count);
        li.style.setProperty('--tag-delay', `${delay++ * 35}ms`);
      }
      const at = ul.querySelectorAll('.searchVideoIdResult-tag:not(.is-leaving)')[i];
      if (at !== li) {
        ul.insertBefore(li, at || null);
      }
    });
    this._videoIdBox.classList.toggle('has-tags', words.length > 0);
    this._updateVideoIdSelection();
  }

  _selectVideoIdTag(word) {
    if (!word) {
      return;
    }
    this._word.value = word;
    this._config.props.word = word;
    // 選んだタグ自体が動画IDの形（例: sm9708985）でも、カードを出し直さずにそのまま検索する
    this._videoIdDismissedKey = this._videoIdKeyOf(word);
    this._updateVideoIdPreview();
    this.submit();
  }

  // 素の動画IDを検索語として検索する行（タグ/キーワードのヒット件数も表示）
  _updateVideoIdSearchRow(force = false) {
    const row = this._videoIdBox.querySelector('.searchVideoIdResult-search');
    if (!row) {
      return;
    }
    const word = this.word;
    // Task 073: 普通の単語（動画IDではない入力）でも表示する
    if (!word || !this._videoIdBare) {
      return;
    }
    const mode = this.searchType === 'tag' ? 'tag' : 'keyword';
    const label = mode === 'tag' ? `タグ「${word}」で検索` : `キーワード「${word}」で検索`;
    const labelElm = row.querySelector('.searchVideoIdResult-searchLabel');
    const countElm = row.querySelector('.searchVideoIdResult-searchCount');
    if (!force && labelElm.textContent === label) {
      return;
    }
    labelElm.textContent = label;
    const cacheKey = this._wordCountCacheKey(word, mode);
    row.title = cacheKey ? label : `${label}（「投稿者の動画のみ」の時は件数を表示しません）`;
    const seq = ++this._wordCountSeq;
    window.clearTimeout(this._wordCountTimer);
    const render = count => {
      if (seq !== this._wordCountSeq) { return; }
      row.classList.remove('is-counting');
      row.classList.toggle('is-empty', count === 0);
      countElm.textContent = typeof count === 'number' ? `${count.toLocaleString()}件` : '';
      if (typeof count === 'number') {
        countElm.classList.remove('is-pop');
        void countElm.offsetWidth;
        countElm.classList.add('is-pop');
      }
    };
    if (!cacheKey) {
      render(null);
      return;
    }
    if (this._wordCountCache.has(cacheKey)) {
      render(this._wordCountCache.get(cacheKey));
      return;
    }
    row.classList.add('is-counting');
    row.classList.remove('is-empty');
    countElm.textContent = '';
    // Task 073: 普通の単語は1文字ごとに語が変わるので、入力が少し止まってから問い合わせる
    const filters = this.filterOptions;
    this._wordCountTimer = window.setTimeout(() => {
      if (seq !== this._wordCountSeq) { return; }
      VideoSearchForm.fetchWordCount(word, mode, filters)
        .then(count => {
          this._setWordCountCache(cacheKey, count);
          render(count);
        })
        .catch(() => render(null));
    }, VideoSearchForm.WORD_COUNT_DELAY_MS);
  }

  // nvapi /v2/search/video で件数だけ取る（本家の検索と同じ条件: 人気順・sensitiveContents=mask）
  // Task 073: 期間・長さ・ジャンルの絞り込み(filters)も、実際の検索と同じ組み立て方(buildQuery)で反映する
  static async fetchWordCount(word, mode, filters = {}) {
    const nvapi = NicoSearchApiV2Loader && NicoSearchApiV2Loader.nvapi;
    const params = Object.assign({}, filters, {searchType: mode === 'tag' ? 'tag' : 'keyword'});
    const base = nvapi ? nvapi.buildQuery(word, params) : {
      [mode === 'tag' ? 'tag' : 'keyword']: word,
      sortKey: 'hot', sortOrder: 'none', sensitiveContents: 'mask'
    };
    const q = new URLSearchParams(Object.assign(base, {pageSize: 1, page: 1}));
    const res = await fetch(`https://nvapi.nicovideo.jp/v2/search/video?${q}`, {
      credentials: 'include',
      headers: {'X-Frontend-Id': '6', 'X-Frontend-Version': '0'}
    });
    const json = await res.json();
    if (!json || !json.meta || json.meta.status !== 200 || !json.data) {
      throw new Error('count failed');
    }
    return json.data.totalCount * 1 || 0;
  }

  _submitVideoIdAsWord() {
    this._videoIdDismissedKey = this._videoIdKey;
    this._updateVideoIdPreview();
    this.submit();
  }

  _execVideoIdAction(action, watchId, feedbackTarget) {
    if (!watchId) {
      return;
    }
    const card = this._videoIdCards.get(watchId);
    switch (action) {
      case 'open':
        card && card.classList.add('is-opening');
        domEvent.dispatchCommand(this._view, 'open', watchId);
        // 開いたらカードは閉じる（入力はそのまま。入力を変えるとまた出る）
        window.setTimeout(() => {
          this._videoIdDismissedKey = this._videoIdKey;
          this._updateVideoIdPreview();
          card && card.classList.remove('is-opening');
        }, 260);
        break;
      case 'playlistInsert':
      case 'playlistAdd':
      case 'deflistAdd': {
        domEvent.dispatchCommand(this._view, action, watchId);
        const target = feedbackTarget && feedbackTarget.classList.contains('searchVideoCard-button') ?
          feedbackTarget : (card && card.querySelector(`[data-action="${action}"]`));
        if (target) {
          target.classList.remove('is-done');
          void target.offsetWidth;
          target.classList.add('is-done');
          window.setTimeout(() => target.classList.remove('is-done'), 900);
        }
        break;
      }
    }
  }

  _onClick(e) {
    e.stopPropagation();
    const tagName = (e.target.tagName || '').toLowerCase();
    const target = e.target.closest('.command');

    if (!['input', 'select'].includes(tagName)) {
      this._word.focus();
    }

    if (!target) {
      return;
    }

    const command = target.dataset.command;
    if (!command) {
      return;
    }
    e.preventDefault();
    const type = target.getAttribute('data-type') || 'string';
    let param = target.getAttribute('data-param');
    if (type !== 'string') { param = JSON.parse(param); }

    switch (command) {
      case 'clear':
        this._word.value = '';
        break;
      default:
        domEvent.dispatchCommand(e.target, command, param);
    }
  }

  _onSubmit(e) {
    e.stopPropagation();
    // Task 071: 動画IDが入っている時の▶/Enterは、検索ではなくその動画を再生する
    // 検索語になり得ないURL形式の時だけ動画を開く（sm114514 のような素のIDは検索語として検索）
    const {ids, bare} = VideoSearchForm.parseVideoIdInput(this.word);
    if (ids.length && !bare) {
      const current = this._findVideoIdNavItem(this._videoIdNavKey);
      this._execVideoIdAction('open', current && current.type === 'card' ? current.watchId : ids[0]);
      return;
    }
    // Task 073: ▶ボタンで検索した時も予測枠を閉じる（入力を変えるとまた出る）
    if (this._videoIdBox && this._videoIdBox.classList.contains('is-open')) {
      this._videoIdDismissedKey = this._videoIdKey;
      this._updateVideoIdPreview();
    }
    this.submit();
  }

  submit() {
    const word = this.word;
    if (!word) {
      return;
    }
    // Task 071: URL形式の動画IDは検索しない（並び順などを変えた時の自動検索も含む）。
    // sm114514 のような素のIDはタグ・キーワードとしても存在し得るので通常通り検索する
    const parsed = VideoSearchForm.parseVideoIdInput(word);
    if (parsed.ids.length && !parsed.bare) {
      return;
    }

    domEvent.dispatchCommand(this._view, 'playlistSetSearchVideo', {
      word,
      option: Object.assign({
        searchType: this.searchType,
        sort: this.sort,
        order: this.order,
        owner: this.isOwnerOnly,
        playlistSort: this.isPlaylistSort
      }, this.filterOptions)
    });
  }

  _hasFocus() {
    return !!document.activeElement.closest('#zenzaVideoSearchPanel');
  }

  _updateFocus() {
  }

  get word() {
    return (this._word.value || '').trim();
  }

  get searchType() {
    return this._form.mode.value;
  }

  // Task0xx: 解釈ロジックをVideoSearch.jsのparseVideoSearchSortValue()へ集約。
  // タグ検索(TagListView)側もこれと全く同じ関数でvideoSearch.sortを解釈する。
  get sort() {
    return parseVideoSearchSortValue(this._composeSortValue()).sort;
  }

  get order() {
    return parseVideoSearchSortValue(this._composeSortValue()).order;
  }

  get isPlaylistSort() {
    return parseVideoSearchSortValue(this._composeSortValue()).playlistSort;
  }

  // Task 068: 並び順キーと昇降順のselectから、保存用の値("playlist" / "f" / "l,a" 等)を作る
  _composeSortValue() {
    const key = this._sortKey.value || 'playlist';
    if (key === 'playlist') {
      return 'playlist';
    }
    if (VideoSearchForm.UNORDERABLE.includes(key)) {
      return key;
    }
    return `${key},${this._sortOrder.value === 'a' ? 'a' : 'd'}`;
  }

  _applySortValue(raw) {
    const value = raw || 'playlist';
    const [key, order] = value.split(',');
    this._sortKey.value = key;
    if (this._sortKey.value !== key) {
      this._sortKey.value = 'playlist'; // 知らない値(古い設定等)は自動に戻す
    }
    this._sortOrder.value = order === 'a' ? 'a' : 'd';
    this._updateOrderState();
  }

  _updateOrderState() {
    const key = this._sortKey.value;
    this._sortOrder.disabled = key === 'playlist' || VideoSearchForm.UNORDERABLE.includes(key);
  }

  get filterOptions() {
    const form = this._form;
    const result = {};
    const fRange = form['f_range'].value * 1;
    const lRange = form['l_range'].value * 1;
    const genre = form['genre'].value;
    if (fRange) { result.f_range = fRange; }
    if (lRange) { result.l_range = lRange; }
    if (genre && genre !== 'all') { result.genre = genre; }
    return result;
  }

  // Task 073: 項目を削除しても例外にならないよう、要素が無ければ常にfalse
  get _ownerOnlyInput() {
    const form = this._form;
    const input = form && form.elements && form.elements.namedItem('ownerOnly');
    return (input && input.type === 'checkbox') ? input : null;
  }

  get isOwnerOnly() {
    const input = this._ownerOnlyInput;
    return !!(input && input.checked && !input.disabled);
  }
}

// 本家で昇順/降順を選べない並び順（ニコニコで人気・あなたへのおすすめ）
VideoSearchForm.UNORDERABLE = ['h', 'p'];

css.addStyle(`
  .is-open .zenzaWatchVideoHeaderPanel .zenzaVideoSearchPanel {
    top: 120px;
    right: 32px;
  }
`, {className: 'screenMode for-popup videoSearchPanel', disabled: true});

// Task 074: ショート動画(ss〜)と /shorts/ 形式のURLにも対応
VideoSearchForm.VIDEO_ID_REG =
  /^(?:https?:\/\/)?(?:(?:www\.|sp\.|embed\.)?nicovideo\.jp\/(?:watch|shorts)\/|nico\.ms\/)?((?:sm|nm|so|ss)\d+)(?:[\/?#&].*)?$/i;
VideoSearchForm.MAX_VIDEO_ID_CARDS = 5;
// Task 072
VideoSearchForm.VIDEO_ID_SUGGEST_MODES = ['merged', 'side', 'delayed'];
VideoSearchForm.MAX_VIDEO_ID_TAGS = 10;
VideoSearchForm.VIDEO_ID_CARD_DELAY_MS = 500;
// Task 073: 件数の問い合わせは、入力・選択が止まってからこの時間後に行う
VideoSearchForm.WORD_COUNT_DELAY_MS = 300;
VideoSearchForm.WORD_COUNT_CACHE_SIZE = 200;

VideoSearchForm.__css__ = (`
    .zenzaVideoSearchPanel {
      pointer-events: auto;
      position: absolute;
      top: 32px;
      right: 8px;
      padding: 0 8px
      width: 248px;
      z-index: 1000;
    }

    .zenzaScreenMode_normal .zenzaWatchVideoHeaderPanel.is-onscreen .zenzaVideoSearchPanel {
      top: 36px;
      right: -24px;
    }
    .zenzaScreenMode_big    .zenzaWatchVideoHeaderPanel.is-onscreen .zenzaVideoSearchPanel,
    .zenzaScreenMode_3D    .zenzaVideoSearchPanel,
    .zenzaScreenMode_wide  .zenzaVideoSearchPanel,
    .zenzaWatchVideoHeaderPanel.is-fullscreen .zenzaVideoSearchPanel {
      top: 64px;
    }

    .zenzaVideoSearchPanel:focus-within {
      background: rgba(50, 50, 50, 0.8);
    }

    .zenzaVideoSearchPanel:not(:focus-within) .focusOnly {
      opacity: 0;
    }

    .zenzaVideoSearchPanel .searchInputHead {
      position: absolute;
      opacity: 0;
      pointer-events: none;
      padding: 4px;
      transition: transform 0.2s ease, opacity 0.2s ease;
    }
    .zenzaVideoSearchPanel .searchInputHead:hover,
    .zenzaVideoSearchPanel:focus-within .searchInputHead {
      background: rgba(50, 50, 50, 0.8);
    }

    .zenzaVideoSearchPanel           .searchInputHead:hover,
    .zenzaVideoSearchPanel:focus-within .searchInputHead {
      pointer-events: auto;
      opacity: 1;
      transform: translate3d(0, -100%, 0);
    }
      .zenzaVideoSearchPanel .searchMode {
        position: absolute;
        opacity: 0;
      }

      .zenzaVideoSearchPanel .searchModeLabel {
        cursor: pointer;
      }

     .zenzaVideoSearchPanel .searchModeLabel span {
        display: inline-block;
        padding: 4px 8px;
        line-height: 1;
        color: #666;
        cursor: pointer;
        border-radius: 8px;
        border-color: transparent;
        border-style: solid;
        border-width: 1px;
        pointer-events: none;
      }
      .zenzaVideoSearchPanel .searchModeLabel:hover span {
        background: #888;
      }
      .zenzaVideoSearchPanel .searchModeLabel input:checked + span {
        color: #ccc;
        border-color: currentColor;
        cursor: default;
      }

    .zenzaVideoSearchPanel .searchWord {
      white-space: nowrap;
      padding: 0 4px;
      position: relative;
    }

      /* Task 071: 動画IDを入力した時に検索欄の下に出す動画カード */
      .zenzaVideoSearchPanel .searchVideoIdResult {
        display: grid;
        grid-template-rows: 0fr;
        opacity: 0;
        transform: translateY(-6px);
        margin: 0 4px;
        transition:
          grid-template-rows 0.32s cubic-bezier(0.2, 0.8, 0.2, 1),
          opacity 0.22s ease,
          transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1),
          margin 0.32s ease;
        pointer-events: none;
        width: 280px;
        max-width: calc(100vw - 48px);
        box-sizing: border-box;
      }
      .zenzaVideoSearchPanel:focus-within .searchVideoIdResult.is-open {
        grid-template-rows: 1fr;
        opacity: 1;
        transform: none;
        margin: 6px 4px 4px;
        pointer-events: auto;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-inner {
        overflow: hidden;
        min-height: 0;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        padding: 0 2px 4px;
        font-size: 11px;
        color: #999;
        white-space: nowrap;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-label {
        color: #ffb74d;
        font-weight: bold;
        letter-spacing: 0.05em;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-hint {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult:not(.is-multi) .multiOnly {
        display: none;
      }
      /* Task 072: タグ予測の表示方式 A(merged) / B(side) / C(delayed) */
      .zenzaVideoSearchPanel .searchVideoIdResult-body {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-wordCol,
      .zenzaVideoSearchPanel .searchVideoIdResult-cardCol {
        min-width: 0;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tags {
        display: none;
        list-style: none;
        margin: 0 0 6px;
        padding: 3px 0;
        border-radius: 8px;
        background: rgba(30, 30, 30, 0.95);
        border: 1px solid #555;
        max-height: 34vh;
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-bare.has-tags .searchVideoIdResult-tags {
        display: block;
        animation: zenzaVideoCardIn 0.3s cubic-bezier(0.2, 0.9, 0.25, 1.15) both;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tag {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        color: #ccc;
        font-size: 13px;
        line-height: 1.4;
        cursor: pointer;
        white-space: nowrap;
        animation: zenzaVideoTagIn 0.25s ease both;
        animation-delay: var(--tag-delay, 0ms);
        transition: background 0.12s ease, color 0.12s ease, padding-left 0.15s ease;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tag.is-leaving {
        animation: zenzaVideoTagOut 0.18s ease both;
        pointer-events: none;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tag:hover,
      .zenzaVideoSearchPanel .searchVideoIdResult-tag.is-selected {
        background: #555;
        color: #fff;
        padding-left: 14px;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tagIcon {
        color: #4fc3f7;
        font-weight: bold;
        flex: 0 0 auto;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tagText {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      /* B: 左右に並べる */
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side {
        width: 560px;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare .searchVideoIdResult-body {
        flex-direction: row;
        align-items: flex-start;
        gap: 8px;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare .searchVideoIdResult-wordCol {
        flex: 0 0 250px;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare .searchVideoIdResult-cardCol {
        flex: 1 1 auto;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare .searchVideoIdResult-tags {
        max-height: 60vh;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side:not(.is-bare) {
        width: 280px;
      }
      /* Task 073: 普通の単語（動画IDではない入力）の検索予測。動画カードの列は使わない */
      .zenzaVideoSearchPanel .searchVideoIdResult.is-word .searchVideoIdResult-cardCol {
        display: none;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare.is-word {
        width: 280px;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare.is-word .searchVideoIdResult-body {
        flex-direction: column;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare.is-word .searchVideoIdResult-wordCol {
        flex: 1 1 auto;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-mode-side.is-bare.is-word .searchVideoIdResult-tags {
        max-height: 34vh;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tag .searchVideoIdResult-tagText {
        min-width: 0;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tagCount {
        flex: 0 0 auto;
        margin-left: auto;
        padding: 0 6px;
        border-radius: 8px;
        background: rgba(79, 195, 247, 0.85);
        color: #111;
        font-size: 10px;
        font-weight: bold;
        line-height: 15px;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tagCount:empty {
        display: none;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tagCount.is-counting {
        display: inline-block;
        width: 28px;
        height: 15px;
        background: linear-gradient(90deg, #444 0%, #666 50%, #444 100%);
        background-size: 200% 100%;
        animation: zenzaVideoCardShimmer 1.2s linear infinite;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-tagCount.is-empty {
        background: #555;
        color: #bbb;
      }

      /* C: 入力が止まるまで動画カードを待つ */
      .zenzaVideoSearchPanel .searchVideoIdResult-waiting {
        display: none;
        justify-content: center;
        gap: 5px;
        padding: 6px 0 8px;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-waiting span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ffb74d;
        animation: zenzaVideoWaitDot 0.9s ease-in-out infinite;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-waiting span:nth-child(2) { animation-delay: 0.15s; }
      .zenzaVideoSearchPanel .searchVideoIdResult-waiting span:nth-child(3) { animation-delay: 0.3s; }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-cardsWaiting .searchVideoIdResult-waiting {
        display: flex;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-cardsWaiting .searchVideoIdResult-list {
        display: none;
      }
      @keyframes zenzaVideoTagIn {
        0%   { opacity: 0; transform: translateX(-6px); }
        100% { opacity: 1; transform: none; }
      }
      @keyframes zenzaVideoTagOut {
        0%   { opacity: 1; }
        100% { opacity: 0; transform: translateX(6px); }
      }
      @keyframes zenzaVideoWaitDot {
        0%, 100% { opacity: 0.25; transform: translateY(0); }
        50%      { opacity: 1; transform: translateY(-3px); }
      }

      .zenzaVideoSearchPanel .searchVideoIdResult-search {
        display: none;
        width: 100%;
        box-sizing: border-box;
        align-items: center;
        gap: 6px;
        margin: 0 0 6px;
        padding: 5px 8px;
        border: 1px solid #555;
        border-radius: 8px;
        background: rgba(50, 50, 50, 0.96);
        color: #ddd;
        font-size: 12px;
        text-align: left;
        cursor: pointer;
        animation: zenzaVideoCardIn 0.36s cubic-bezier(0.2, 0.9, 0.25, 1.15) both;
        transition: border-color 0.2s ease, background 0.2s ease;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult.is-bare .searchVideoIdResult-search {
        display: flex;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-search:hover,
      .zenzaVideoSearchPanel .searchVideoIdResult-search.is-selected {
        border-color: #4fc3f7;
        background: rgba(40, 70, 90, 0.96);
        box-shadow: 0 0 0 1px rgba(79, 195, 247, 0.35);
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-searchLabel {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-searchCount {
        flex: 0 0 auto;
        min-width: 32px;
        padding: 0 6px;
        border-radius: 8px;
        background: #4fc3f7;
        color: #111;
        font-size: 11px;
        font-weight: bold;
        line-height: 16px;
        text-align: center;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-searchCount:empty {
        display: none;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-search.is-counting .searchVideoIdResult-searchCount {
        display: inline-block;
        width: 32px;
        height: 16px;
        background: linear-gradient(90deg, #444 0%, #666 50%, #444 100%);
        background-size: 200% 100%;
        animation: zenzaVideoCardShimmer 1.2s linear infinite;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-search.is-empty .searchVideoIdResult-searchCount {
        background: #555;
        color: #bbb;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-searchCount.is-pop {
        animation: zenzaVideoCardDone 0.4s ease;
      }
      .zenzaVideoSearchPanel .searchVideoIdResult-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 60vh;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding-bottom: 2px;
      }

      .zenzaVideoSearchPanel .searchVideoCard {
        position: relative;
        box-sizing: border-box;
        padding: 6px;
        border-radius: 8px;
        background: linear-gradient(180deg, rgba(64, 64, 64, 0.96), rgba(40, 40, 40, 0.96));
        border: 1px solid #555;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
        cursor: pointer;
        color: #ddd;
        white-space: normal;
        transform-origin: 50% 0;
        animation: zenzaVideoCardIn 0.42s cubic-bezier(0.2, 0.9, 0.25, 1.15) both;
        animation-delay: var(--card-delay, 0ms);
        transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
      }
      .zenzaVideoSearchPanel .searchVideoCard:hover,
      .zenzaVideoSearchPanel .searchVideoCard.is-selected {
        border-color: #ffb74d;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 183, 77, 0.35);
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-leaving {
        animation: zenzaVideoCardOut 0.24s ease both;
        pointer-events: none;
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-opening {
        animation: zenzaVideoCardOpen 0.28s ease both;
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-failed {
        animation: zenzaVideoCardIn 0.42s cubic-bezier(0.2, 0.9, 0.25, 1.15) both, zenzaVideoCardShake 0.4s ease 0.42s;
      }
      .zenzaVideoSearchPanel .searchVideoCard-main {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .zenzaVideoSearchPanel .searchVideoCard-thumb {
        position: relative;
        flex: 0 0 104px;
        width: 104px;
        height: 58px;
        border-radius: 4px;
        overflow: hidden;
        background: linear-gradient(90deg, #3a3a3a 0%, #555 50%, #3a3a3a 100%);
        background-size: 200% 100%;
        animation: zenzaVideoCardShimmer 1.2s linear infinite;
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-imageLoaded .searchVideoCard-thumb,
      .zenzaVideoSearchPanel .searchVideoCard.is-imageError .searchVideoCard-thumb {
        animation: none;
        background: #222;
      }
      .zenzaVideoSearchPanel .searchVideoCard-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        opacity: 0;
        transform: scale(1.08);
        transition: opacity 0.35s ease, transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-imageLoaded .searchVideoCard-image {
        opacity: 1;
        transform: none;
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-imageError .searchVideoCard-image {
        display: none;
      }
      .zenzaVideoSearchPanel .searchVideoCard-duration {
        position: absolute;
        right: 2px;
        bottom: 2px;
        padding: 0 3px;
        border-radius: 2px;
        background: rgba(0, 0, 0, 0.75);
        color: #fff;
        font-size: 10px;
        line-height: 14px;
      }
      .zenzaVideoSearchPanel .searchVideoCard-duration:empty {
        display: none;
      }
      .zenzaVideoSearchPanel .searchVideoCard-play {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: #fff;
        text-shadow: 0 0 6px rgba(0, 0, 0, 0.8);
        background: rgba(0, 0, 0, 0.35);
        opacity: 0;
        transform: scale(0.7);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      .zenzaVideoSearchPanel .searchVideoCard:hover .searchVideoCard-play,
      .zenzaVideoSearchPanel .searchVideoCard.is-selected .searchVideoCard-play {
        opacity: 1;
        transform: none;
      }
      .zenzaVideoSearchPanel .searchVideoCard-body {
        flex: 1 1 auto;
        min-width: 0;
      }
      .zenzaVideoSearchPanel .searchVideoCard-id {
        font-size: 10px;
        line-height: 1.2;
        color: #ffb74d;
        font-family: monospace;
      }
      .zenzaVideoSearchPanel .searchVideoCard-title {
        margin: 1px 0 2px;
        font-size: 12px;
        line-height: 1.35;
        font-weight: bold;
        color: #fff;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        word-break: break-all;
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-failed .searchVideoCard-title {
        color: #ff8a80;
        font-weight: normal;
      }
      .zenzaVideoSearchPanel .searchVideoCard-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0 6px;
        font-size: 10px;
        line-height: 1.4;
        color: #aaa;
      }
      .zenzaVideoSearchPanel .searchVideoCard-owner {
        flex-basis: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #bbb;
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-loaded .searchVideoCard-title,
      .zenzaVideoSearchPanel .searchVideoCard.is-loaded .searchVideoCard-meta {
        animation: zenzaVideoCardFade 0.3s ease both;
      }
      .zenzaVideoSearchPanel .searchVideoCard .skeleton {
        display: block;
        height: 10px;
        margin: 3px 0;
        border-radius: 3px;
        background: linear-gradient(90deg, #444 0%, #666 50%, #444 100%);
        background-size: 200% 100%;
        animation: zenzaVideoCardShimmer 1.2s linear infinite;
      }
      .zenzaVideoSearchPanel .searchVideoCard .skeleton.short { width: 60%; }
      .zenzaVideoSearchPanel .searchVideoCard .skeleton.tiny { width: 40%; height: 8px; }

      .zenzaVideoSearchPanel .searchVideoCard-actions {
        display: flex;
        gap: 4px;
        margin-top: 6px;
      }
      .zenzaVideoSearchPanel .searchVideoCard-button {
        position: relative;
        flex: 1 1 auto;
        min-width: 0;
        margin: 0;
        padding: 3px 4px;
        border: 1px solid #666;
        border-radius: 4px;
        background: #333;
        color: #ccc;
        font-size: 11px;
        line-height: 1.2;
        white-space: nowrap;
        cursor: pointer;
        overflow: hidden;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
      }
      .zenzaVideoSearchPanel .searchVideoCard-button:hover {
        background: #555;
        color: #fff;
      }
      .zenzaVideoSearchPanel .searchVideoCard-button:active {
        transform: scale(0.95);
      }
      .zenzaVideoSearchPanel .searchVideoCard-button.is-primary {
        background: #ff9800;
        border-color: #ffb74d;
        color: #111;
        font-weight: bold;
      }
      .zenzaVideoSearchPanel .searchVideoCard-button.is-primary:hover {
        background: #ffb74d;
      }
      .zenzaVideoSearchPanel .searchVideoCard-button.is-done {
        animation: zenzaVideoCardDone 0.9s ease;
      }
      .zenzaVideoSearchPanel .searchVideoCard-button.is-done::after {
        content: '✓';
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #43a047;
        color: #fff;
        font-weight: bold;
        animation: zenzaVideoCardDoneMark 0.9s ease both;
      }
      .zenzaVideoSearchPanel .searchVideoCard.is-unavailable .searchVideoCard-button:not(.is-primary) {
        opacity: 0.4;
        pointer-events: none;
      }

      @keyframes zenzaVideoCardIn {
        0%   { opacity: 0; transform: translateY(-10px) scale(0.96); }
        100% { opacity: 1; transform: none; }
      }
      @keyframes zenzaVideoCardOut {
        0%   { opacity: 1; transform: none; }
        100% { opacity: 0; transform: translateX(16px) scale(0.96); }
      }
      @keyframes zenzaVideoCardOpen {
        0%   { transform: none; }
        40%  { transform: scale(0.97); box-shadow: 0 0 0 3px rgba(255, 152, 0, 0.8); }
        100% { transform: scale(1.02); opacity: 0.6; }
      }
      @keyframes zenzaVideoCardShake {
        0%, 100% { transform: none; }
        20% { transform: translateX(-5px); }
        40% { transform: translateX(5px); }
        60% { transform: translateX(-3px); }
        80% { transform: translateX(3px); }
      }
      @keyframes zenzaVideoCardShimmer {
        0%   { background-position: 100% 0; }
        100% { background-position: -100% 0; }
      }
      @keyframes zenzaVideoCardFade {
        0%   { opacity: 0; transform: translateY(3px); }
        100% { opacity: 1; transform: none; }
      }
      @keyframes zenzaVideoCardDone {
        0%   { transform: scale(1); }
        30%  { transform: scale(1.08); }
        100% { transform: scale(1); }
      }
      @keyframes zenzaVideoCardDoneMark {
        0%   { opacity: 0; }
        15%  { opacity: 1; }
        75%  { opacity: 1; }
        100% { opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .zenzaVideoSearchPanel .searchVideoIdResult,
        .zenzaVideoSearchPanel .searchVideoIdResult *,
        .zenzaVideoSearchPanel .searchVideoCard,
        .zenzaVideoSearchPanel .searchVideoCard * {
          animation-duration: 1ms !important;
          animation-delay: 0ms !important;
          transition-duration: 1ms !important;
        }
      }

      .zenzaVideoSearchPanel .searchWordInput {
        width: 200px;
        margin: 0;
        height: 24px;
        line-height: 24px;
        background: transparent;
        font-size: 16px;
        padding: 0 4px;
        color: #ccc;
        border: 1px solid #ccc;
        opacity: 0;
        transition: opacity 0.2s ease;
        will-change: opacity;
      }

      .zenzaVideoSearchPanel .searchWordInput:-webkit-autofill {
        background: transparent;
      }

      .is-mouseMoving .searchWordInput {
        opacity: 0.5;
      }

      .is-mouseMoving .searchWordInput:hover {
        opacity: 0.8;
      }

      .zenzaVideoSearchPanel:focus-within .searchWordInput {
        opacity: 1 !important;
      }

      .zenzaVideoSearchPanel .searchSubmit {
        width: 34px;
        margin: 0;
        padding: 0;
        font-size: 14px;
        line-height: 24px;
        height: 24px;
        border: solid 1px #ccc;
        cursor: pointer;
        background: #888;
        pointer-events: none;
        opacity: 0;
        transform: translate3d(-100%, 0, 0);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }

      .zenzaVideoSearchPanel:focus-within .searchSubmit {
        pointer-events: auto;
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }

      .zenzaVideoSearchPanel:focus-within .searchSubmit:hover {
        transform: scale(1.5);
      }

      .zenzaVideoSearchPanel:focus-within .searchSubmit:active {
        transform: scale(1.2);
        border-style: inset;
      }

      .zenzaVideoSearchPanel .searchClear {
        display: inline-block;
        width: 28px;
        margin: 0;
        padding: 0;
        font-size: 16px;
        line-height: 24px;
        height: 24px;
        border: none;
        cursor: pointer;
        color: #ccc;
        background: transparent;
        pointer-events: none;
        opacity: 0;
        transform: translate3d(100%, 0, 0);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }

      .zenzaVideoSearchPanel:focus-within .searchClear {
        pointer-events: auto;
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }

      .zenzaVideoSearchPanel:focus-within .searchClear:hover {
        transform: scale(1.5);
      }

      .zenzaVideoSearchPanel:focus-within .searchClear:active {
        transform: scale(1.2);
      }


    .zenzaVideoSearchPanel .searchInputFoot {
      white-space: nowrap;
      position: absolute;
      opacity: 0;
      padding: 4px;
      pointer-events: none;
      transition: transform 0.2s ease, opacity 0.2s ease;
      transform: translate3d(0, -100%, 0);
    }

    .zenzaVideoSearchPanel .searchInputFoot:hover,
    .zenzaVideoSearchPanel:focus-within .searchInputFoot {
      pointer-events: auto;
      opacity: 1;
      background: rgba(50, 50, 50, 0.8);
      transform: translate3d(0, 0, 0);
    }

      .zenzaVideoSearchPanel .searchSortSelect,
      .zenzaVideoSearchPanel .searchSortSelect option{
        background: #333;
        color: #ccc;
      }

      .zenzaVideoSearchPanel .ownerOnlyLabel {
        cursor: pointer;
      }

      .zenzaVideoSearchPanel .searchOptionRow {
        display: flex;
        gap: 4px;
        margin-bottom: 4px;
      }
      .zenzaVideoSearchPanel .searchOptionRow select {
        max-width: 140px;
      }
      .zenzaVideoSearchPanel .searchOrderSelect[disabled] {
        opacity: 0.4;
      }

      .zenzaVideoSearchPanel .ownerOnlyLabel input + span {
        display: inline-block;
        pointer-events: none;
      }
      .zenzaVideoSearchPanel .ownerOnlyLabel input[disabled] + span {
        filter: brightness(80%);
        text-decoration: line-through;
      }

  `).trim();

VideoSearchForm.__tpl__ = (`
    <div class="zenzaVideoSearchPanel" id="zenzaVideoSearchPanel">
      <form action="javascript: void(0);">

        <div class="searchInputHead">
          <label class="searchModeLabel">
            <input type="radio" name="mode" class="searchMode" value="keyword">
            <span>キーワード</span>
          </label>

          <label class="searchModeLabel">
            <input type="radio" name="mode" class="searchMode" value="tag"
              id="zenzaVideoSearch-tag" checked="checked">
              <span>タグ</span>
          </label>
        </div>

        <div class="searchWord">
          <button class="searchClear command"
            type="button"
            data-command="clear"
            title="クリア">&#x2716;</button>
          <input
            type="text"
            value=""
            autocomplete="off"
            spellcheck="false"
            name="word"
            accesskey="e"
            placeholder="簡易検索(テスト中)"
            class="searchWordInput"
            maxlength="75"
            >
          <input
            type="submit"
            value="▶"
            name="post"
            class="searchSubmit"
            >
        </div>

        <div class="searchVideoIdResult" aria-live="polite">
          <div class="searchVideoIdResult-inner">
            <div class="searchVideoIdResult-head">
              <span class="searchVideoIdResult-label">動画ID</span>
              <span class="searchVideoIdResult-hint"></span>
            </div>
            <div class="searchVideoIdResult-body">
              <div class="searchVideoIdResult-wordCol">
                <button type="button" class="searchVideoIdResult-search" data-action="search">
                  <span class="searchVideoIdResult-searchIcon">&#x1F50D;</span>
                  <span class="searchVideoIdResult-searchLabel"></span>
                  <span class="searchVideoIdResult-searchCount"></span>
                </button>
                <ul class="searchVideoIdResult-tags" role="listbox"></ul>
              </div>
              <div class="searchVideoIdResult-cardCol">
                <div class="searchVideoIdResult-waiting"><span></span><span></span><span></span></div>
                <div class="searchVideoIdResult-list"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="searchInputFoot focusOnly">
          <div class="searchOptionRow">
            <select name="sortKey" class="searchSortSelect searchSortKeySelect" title="並び順">
              <option value="playlist">自動(連続再生用・古い順)</option>
              <option value="h">ニコニコで人気</option>
              <option value="p">あなたへのおすすめ</option>
              <option value="f">投稿日時</option>
              <option value="v">再生数</option>
              <option value="n">コメント日時</option>
              <option value="likeCount">いいね！数</option>
              <option value="r">コメント数</option>
              <option value="m">マイリスト登録数</option>
              <option value="l">再生時間</option>
            </select>
            <select name="sortOrder" class="searchSortSelect searchOrderSelect" title="昇順/降順">
              <option value="d">降順</option>
              <option value="a">昇順</option>
            </select>
          </div>
          <div class="searchOptionRow">
            <select name="f_range" class="searchSortSelect" title="投稿日時">
              <option value="0">期間:指定なし</option>
              <option value="4">1時間以内</option>
              <option value="1">24時間以内</option>
              <option value="2">1週間以内</option>
              <option value="3">1ヶ月以内</option>
              <option value="5">1年以内</option>
            </select>
            <select name="l_range" class="searchSortSelect" title="再生時間">
              <option value="0">長さ:指定なし</option>
              <option value="1">5分以内</option>
              <option value="2">20分以上</option>
            </select>
            <select name="genre" class="searchSortSelect" title="ジャンル">
              <option value="all">ジャンル:指定なし</option>
              <option value="entertainment">エンターテイメント</option>
              <option value="radio">ラジオ</option>
              <option value="music_sound">音楽・サウンド</option>
              <option value="dance">ダンス</option>
              <option value="animal">動物</option>
              <option value="nature">自然</option>
              <option value="cooking">料理</option>
              <option value="traveling_outdoor">旅行・アウトドア</option>
              <option value="vehicle">乗り物</option>
              <option value="sports">スポーツ</option>
              <option value="society_politics_news">社会・政治・時事</option>
              <option value="technology_craft">技術・工作</option>
              <option value="commentary_lecture">解説・講座</option>
              <option value="anime">アニメ</option>
              <option value="game">ゲーム</option>
              <option value="other">その他</option>
              <option value="r18">例のソレ</option>
            </select>
          </div>
          <label class="ownerOnlyLabel" title="いま再生中の動画を投稿したユーザー（またはチャンネル）の動画だけに絞り込みます">
            <input type="checkbox" name="ownerOnly">
            <span>再生中の動画の投稿者の動画のみ</span>
          </label>
        </div>

      </form>
    </div>
  `).toString();


// typoじゃなくてブロック回避のため名前を変えてる
class UaaView extends BaseViewComponent {
  constructor({parentNode}) {
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

    this._bound.load = this.load.bind(this);
    this._bound.update = this.update.bind(this);
  }

  _initDom(...args) {
    super._initDom(...args);
    ZenzaWatch.debug.uaa = this;

    if (!this._shadow) {
      return;
    } // ShadowDOM使えなかったらバイバイ
    const shadow = this._shadow || this._view;
    this._elm.body = shadow.querySelector('.UaaDetailBody');
  }

  update(videoInfo) {
    if (!this._shadow || !this._config.props.enable) {
      return;
    }
    if (!this._elm.body) {
      return;
    }

    if (this._state.isUpdating) {
      return;
    }
    this.setState({isUpdating: true});
    this._props.videoInfo = videoInfo;
    this._props.videoId = videoInfo.videoId;

    window.setTimeout(() => {
      this.load(videoInfo);
    }, 5000);
  }

  load(videoInfo) {
    const videoId = videoInfo.videoId;

    return UaaLoader.load(videoId, {limit: 50})
      .then(this._onLoad.bind(this, videoId))
      .catch(this._onFail.bind(this, videoId));
  }

  clear() {
    this.setState({isUpdating: false, isExist: false, isSpeaking: false});
    if (!this._elm.body) {
      return;
    }
    this._elm.body.textContent = '';
  }

  _onLoad(videoId, result) {
    if (this._props.videoId !== videoId) {
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
    data.sponsors.forEach(u => {
      if (!u.auxiliary.bgVideoPosition || idx >= 4) {
        return;
      }
      u.added = true;
      div.append(this._createItem(u, idx++));
      screenshots++;
    });
    div.setAttribute('data-screenshot-count', screenshots);
    df.append(div);

    data.sponsors.forEach(u => {
      if (!u.auxiliary.bgVideoPosition || u.added) {
        return;
      }
      u.added = true;
      df.append(this._createItem(u, idx++));
    });
    data.sponsors.forEach(u => {
      if (u.added) {
        return;
      }
      u.added = true;
      df.append(this._createItem(u, idx++));
    });

    this._elm.body.innerHTML = '';
    this._elm.body.append(df);

    this.setState({isExist: true});
  }

  _createItem(data, idx) {
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

      this._props.videoInfo.getCurrentVideo()
        .then(url => ZenzaWatch.util.VideoCaptureUtil.capture(url, sec))
        .then(screenshot => {
        const cv = document.createElement('canvas');
        const ct = cv.getContext('2d');
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

  _onFail(videoId) {
    if (this._props.videoId !== videoId) {
      return;
    }
    this.setState({isUpdating: false});
  }

  _onCommand(command, param) {
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
        color: #ccc;
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
          border: 1px solid #666;
          border-radius: 4px;
          overflow: auto;
        }

      .UaaDetails .uaaSummary {
        height: 38px;
        margin: 4px 4px 8px;
        color: inherit;
        outline: none;
        border: 1px solid #ccc;
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
          background: #000;
          color: #ccc;
          font-size: 12px;
          line-height: 14px;
        }
        .UaaDetails .item.has-screenshot:hover::after {
          opacity: 0;
        }

      .UaaDetails .contact {
        display: inline-block;
        color: #fff;
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
          color: #fff;
          text-shadow: 1px 1px 1px #000;
          text-stroke: 1px #000;
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
            text-stroke: 0;
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
          color: #ffc;
        }
        .UaaDetails .item.other.clickable .contact::after {
          content: attr(title);
          color: #ccc;
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
        color: #000;
      }
      :host-context(.zenzaScreenMode_sideView .is-notFullscreen) .UaaDetails {
        color: #000;
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


class RelatedInfoMenu extends BaseViewComponent {
  constructor({parentNode, isHeader}) {
    super({
      parentNode,
      name: 'RelatedInfoMenu',
      template: '<div class="RelatedInfoMenu" tabindex="-1"></div>',
      shadow: RelatedInfoMenu._shadow_,
      css: RelatedInfoMenu.__css__
    });

    this._state = {};

    this._bound.update = this.update.bind(this);
    this._bound._onBodyClick = _.debounce(this._onBodyClick.bind(this), 0);
    this.setState({isHeader});

  }

  _initDom(...args) {
    super._initDom(...args);

    ClassList(this._view).toggle('is-Edge', /edge/i.test(navigator.userAgent));
    const shadow = this._shadow || this._view;
    this._elm.body = shadow.querySelector('.RelatedInfoMenuBody');
    this._elm.summary = shadow.querySelector('summary');
    shadow.addEventListener('click', e => {
      e.stopPropagation();
    });
    this._elm.summary.addEventListener('click', _.debounce(() => {
      if (shadow.open) {
        document.body.addEventListener('mouseup', this._bound._onBodyClick, {once: true});
        this.emit('open');
      }
    }, 100));

    this._ginzaLink = shadow.querySelector('.ginzaLink');
    this._originalLink = shadow.querySelector('.originalLink');
    this._twitterLink = shadow.querySelector('.twitterHashLink');
    this._parentVideoLink = shadow.querySelector('.parentVideoLink');
  }

  _onBodyClick() {
    const shadow = this._shadow || this._view;
    shadow.open = false;
    document.body.removeEventListener('mouseup', this._bound._onBodyClick);
    this.emit('close');
  }

  update(videoInfo) {
    const shadow = this._shadow || this._view;
    shadow.open = false;

    this._currentWatchId = videoInfo.watchId;
    this._currentVideoId = videoInfo.videoId;
    this.setState({
      isParentVideoExist: videoInfo.hasParentVideo,
      isCommunity: videoInfo.isCommunityVideo,
      isMymemory: videoInfo.isMymemory
    });

    const vid = this._currentVideoId;
    const wid = this._currentWatchId;
    this._ginzaLink.setAttribute('href', `//www.nicovideo.jp/watch/${wid}`);
    this._originalLink.setAttribute('href', `//www.nicovideo.jp/watch/${vid}`);
    this._twitterLink.setAttribute('href', `https://twitter.com/hashtag/${vid}`);
    // Task 043: commons.nicovideo.jp/tree/{id} は廃止された。
    // 現在の親作品・子作品の表示先は /works/{id} 。クエリはニコニコ動画の
    // 視聴ページからコンテンツツリーを開いた時と同じもの（流入元の記録用）。
    this._parentVideoLink.setAttribute('href',
      `//commons.nicovideo.jp/works/${vid}?transit_from=pcvideo_watch_contentstree&rf=nvpc&rp=watch&ra=content_tree`);
    this.emit('close');
  }

  _onCommand(command, param) {
    let url;
    const shadow = this._shadow || this._view;
    shadow.open = false;

    switch (command) {
      case 'watch-ginza':
        window.open(this._ginzaLink.href, 'watchGinza');
        super._onCommand('pause');
        break;
      case 'open-uad':
        url = `//nicoad.nicovideo.jp/video/publish/${this._currentWatchId}?frontend_id=6&frontend_version=0&zenza_watch`;
        window.open(url, '', 'width=428, height=600, toolbar=no, scrollbars=1');
        break;
      case 'open-twitter-hash':
        window.open(this._twitterLink.href);
        break;
      case 'open-parent-video':
        window.open(this._parentVideoLink.href);
        break;
      case 'copy-video-watch-url':
        super._onCommand(command, param);
        super._onCommand('notify', 'コピーしました');
        break;
      case 'open-original-video':
        super._onCommand('openNow', this._currentVideoId);
        break;
      default:
        super._onCommand(command, param);
    }
    this.emit('close');
  }


}

RelatedInfoMenu._css_ = ('').trim();

RelatedInfoMenu._shadow_ = (`
    <style>
      .RelatedInfoMenu,
      .RelatedInfoMenu * {
        box-sizing: border-box;
        user-select: none;
      }

      .RelatedInfoMenu {
        display: inline-block;
        padding: 8px;
        font-size: 16px;
        cursor: pointer;
      }

      .RelatedInfoMenu summary {
        display: inline-block;
        background: transparent;
        color: #333;
        padding: 4px 8px;
        border-radius: 4px;
        outline: none;
        border: 1px solid #ccc;
      }

      .RelatedInfoMenu ul {
        list-style-type: none;
        padding-left: 32px;
      }

      .RelatedInfoMenu li {
        padding: 4px;
      }

      .RelatedInfoMenu li > .command {
        display: inline-block;
        text-decoration: none;
        color: #ccc;
      }

      .RelatedInfoMenu li > .command:hover {
        text-decoration: underline;
      }

      .RelatedInfoMenu li > .command:hover::before {
        content: '▷';
        position: absolute;
        transform: translate(-100%, 0);
      }


        .RelatedInfoMenu .originalLinkMenu,
        .RelatedInfoMenu .parentVideoMenu {
          display: none;
        }

        .RelatedInfoMenu.is-Community        .originalLinkMenu,
        .RelatedInfoMenu.is-Mymemory         .originalLinkMenu,
        .RelatedInfoMenu.is-ParentVideoExist .parentVideoMenu {
          display: block;
        }


      .zenzaScreenMode_sideView .is-fullscreen .RelatedInfoMenu summary{
        background: #888;
      }

      :host-context(.zenzaScreenMode_sideView .is-fullscreen) .RelatedInfoMenu summary {
        background: #888;
      }

      /* :host-contextで分けたいけどFirefox対応のため */
      .RelatedInfoMenu.is-Header {
        font-size: 13px;
        padding: 0 8px;
      }
      .RelatedInfoMenu.is-Header summary {
        background: #666;
        color: #ccc;
        padding: 0 8px;
        border: none;
      }
      .RelatedInfoMenu.is-Header[open] {
        background: rgba(80, 80, 80, 0.9);
      }
      .RelatedInfoMenu.is-Header ul {
        font-size: 16px;
        line-height: 20px;
      }

      :host-context(.zenzaWatchVideoInfoPanel) .RelatedInfoMenu li > .command {
        color: #222;
      }

      .zenzaWatchVideoInfoPanel .RelatedInfoMenu li > .command {
        color: #222;
      }

        /* for Edge */
        .is-Edge .RelatedInfoMenuBody {
          display: none;
          color: #ccc;
          background: rgba(80, 80, 80, 0.9);
        }
        .RelatedInfoMenu[open] .RelatedInfoMenuBody,
        .RelatedInfoMenu:focus .RelatedInfoMenuBody,
        .RelatedInfoMenuBody:hover {
          display: block;
        }
    </style>
    <details class="root RelatedInfoMenu">
      <summary class="RelatedInfoMenuSummary clickable">関連メニュー</summary>
      <div class="RelatedInfoMenuBody">
        <ul>
          <li class="ginzaMenu">
            <a class="ginzaLink command"
              rel="noopener" data-command="watch-ginza">公式プレイヤーで開く</a>
          </li>
          <li class="uadMenu">
            <span class="uadLink command"
              rel="noopener" data-command="open-uad">ニコニ広告で宣伝</span>
          </li>
          <li class="twitterHashMenu">
            <a class="twitterHashLink command"
              rel="noopener" data-command="open-twitter-hash">twitterの反応を見る</a>
          </li>
          <li class="originalLinkMenu">
            <a class="originalLink command"
              rel="noopener" data-command="open-original-video">元動画を開く</a>
          </li>
          <li class="parentVideoMenu">
            <a class="parentVideoLink command"
              rel="noopener" data-command="open-parent-video">親作品・コンテンツツリー</a>
          </li>
          <li class="parentVideoMenu">
            <span class="command"
              data-command="playlistSetCommonsTree">親作品・子作品をプレイリストに追加</span>
          </li>
          <li class="copyVideoWatchUrlMenu">
            <span class="copyVideoWatchUrlLink command"
              rel="noopener" data-command="copy-video-watch-url">動画URLをコピー</span>
          </li>
        </ul>
      </div>
    </details>
  `).trim();

class VideoMetaInfo extends BaseViewComponent {
  constructor({parentNode}) {
    super({
      parentNode,
      name: 'VideoMetaInfo',
      template: '<div class="VideoMetaInfo"></div>',
      shadow: VideoMetaInfo._shadow_,
      css: VideoMetaInfo.__css__
    });

    this._state = {};

    this._bound.update = this.update.bind(this);
  }

  _initDom(...args) {
    super._initDom(...args);

    const shadow = this._shadow || this._view;
    this._elm = Object.assign({}, this._elm, {
      postedAt: shadow.querySelector('.postedAt'),
      body: shadow.querySelector('.videoMetaInfo'),
      viewCount: shadow.querySelector('.viewCount'),
      commentCount: shadow.querySelector('.commentCount'),
      mylistCount: shadow.querySelector('.mylistCount')
    });
  }

  update(videoInfo) {
    this._elm.postedAt.textContent = new Date(videoInfo.postedAt).toLocaleString();
    const count = videoInfo.count;
    this.updateVideoCount(count);
  }

  updateVideoCount({comment, view, mylist}) {
    const addComma = m => m.toLocaleString ? m.toLocaleString() : m;
    if (typeof comment === 'number') {
      this._elm.commentCount.textContent = addComma(comment);
    }
    if (typeof view === 'number') {
      this._elm.viewCount.textContent = addComma(view);
    }
    if (typeof mylist === 'number') {
      this._elm.mylistCount.textContent = addComma(mylist);
    }
  }
}

VideoMetaInfo._css_ = ('').trim();

VideoMetaInfo._shadow_ = (`
    <style>
      .VideoMetaInfo .postedAtOuter {
        display: inline-block;
        margin-right: 24px;
      }
      .VideoMetaInfo .postedAt {
        font-weight: bold
      }

      .VideoMetaInfo .countOuter {
        white-space: nowrap;
      }

      .VideoMetaInfo .countOuter .column {
        display: inline-block;
        white-space: nowrap;
      }

      .VideoMetaInfo .count {
        font-weight: bolder;
      }

      .userVideo .channelVideo,
      .channelVideo .userVideo
      {
        display: none !important;
      }

      :host-context(.userVideo) .channelVideo,
      :host-context(.channelVideo) .userVideo
      {
        display: none !important;
      }

    </style>
    <div class="VideoMetaInfo root">
      <span class="postedAtOuter">
        <span class="userVideo">投稿日:</span>
        <span class="channelVideo">配信日:</span>
        <span class="postedAt"></span>
      </span>

      <span class="countOuter">
        <span class="column">再生:       <span class="count viewCount"></span></span>
        <span class="column">コメント:   <span class="count commentCount"></span></span>
        <span class="column">マイリスト: <span class="count mylistCount"></span></span>
      </span>
    </div>
  `);

//===END===

export {
  VideoInfoPanel,
  VideoHeaderPanel,
  VideoSearchForm,
  UaaView,
  RelatedInfoMenu,
  VideoMetaInfo
};
