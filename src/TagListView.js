import {ZenzaWatch} from './ZenzaWatchIndex';
import {NicodicArticleLoader} from '../packages/lib/src/nico/loader';
import {BaseViewComponent} from '../packages/zenza/src/parts/BaseViewComponent';
import {TagEditApi} from '../packages/lib/src/nico/TagEditApi';
import {parseVideoSearchSortValue} from '../packages/lib/src/nico/VideoSearch';
import {Config} from './Config';
import {textUtil} from '../packages/lib/src/text/textUtil';
import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';

//===BEGIN===

class TagListView extends BaseViewComponent {
  constructor({parentNode}) {
    super({
      parentNode,
      name: 'TagListView',
      template: '<div class="TagListView"></div>',
      shadow: TagListView.__shadow__,
      css: TagListView.__css__
    });

    this._state = {
      isInputing: false,
      isUpdating: false,
      isEditing: false
    };

    this._tagEditApi = new TagEditApi();
  }

  _initDom(...args) {
    super._initDom(...args);

    const v = this._shadow || this._view;
    Object.assign(this._elm, {
      videoTags: v.querySelector('.videoTags'),
      videoTagsInner: v.querySelector('.videoTagsInner'),
      tagInput: v.querySelector('.tagInputText'),
      form: v.querySelector('form')
    });

    this._elm.tagInput.addEventListener('keydown', this._onTagInputKeyDown.bind(this));
    this._elm.form.addEventListener('submit', this._onTagInputSubmit.bind(this));
    v.addEventListener('keydown', e => {
      if (this._state.isInputing) {
        e.stopPropagation();
      }
    });
    v.addEventListener('click', e => e.stopPropagation());

    ZenzaWatch.emitter.on('hideHover', () => {
      if (this._state.isEditing) {
        this._endEdit();
      }
    });
  }

  _onCommand(command, param) {
    switch (command) {

      case 'refresh':
        this._refreshTag();
        break;
      case 'toggleEdit':
        if (this._state.isEditing) {
          this._endEdit();
        } else {
          this._beginEdit();
        }
        break;
      case 'toggleInput':
        if (this._state.isInputing) {
          this._endInput();
        } else {
          this._beginInput();
        }
        break;
      case 'beginInput':
        this._beginInput();
        break;
      case 'endInput':
        this._endInput();
        break;
      case 'addTag':
        this._addTag(param);
        break;
      case 'removeTag': {
        let elm = this._elm.videoTags.querySelector(`.tagItem[data-tag-id="${param}"]`);
        if (!elm) {
          return;
        }
        elm.classList.add('is-Removing');
        let data = JSON.parse(elm.getAttribute('data-tag'));
        this._removeTag(param, data.name);
        break;
      }
      case 'tag-search':
        this._onTagSearch(param);
        break;
      // Task 074: ジャンルのバッジ
      case 'set-search-genre':
        ZenzaWatch.emitter.emit('setSearchGenre', param);
        break;
      case 'none':
        break;
      default:
        super._onCommand(command, param);
        break;
    }
  }

  /**
   * タグの▶ボタンから検索する（Task0xx: タグ検索の不具合修正）。
   *
   * 以前は2つの不具合があった。
   * (1) searchTypeに検索パネルの共有設定videoSearch.modeをそのまま使っていた
   *     ため、直前に検索パネルで「キーワード」モードにしていると、タグを
   *     クリックしてもタグ完全一致(tagsExact)ではなくタイトル・説明文まで
   *     含めた曖昧検索になってしまっていた。タグをクリックした時点で検索語は
   *     常に「そのタグそのもの」なので、searchTypeは常に'tag'に固定する。
   * (2) 並び順の解釈が検索パネル側(VideoInfoPanel.jsのVideoSearchForm)と
   *     食い違っており(videoSearch.sortの値が検索パネル変更後の物だと
   *     照合に失敗してlastCommentTimeへフォールバックし、videoSearch.orderは
   *     どこからも更新されない上に'desc'/'asc'という単語自体がクエリ側の
   *     期待する'd'/'a'と一致せず常に昇順になっていた)ため、検索パネルと
   *     同じparseVideoSearchSortValue()を使うよう統一した。
   */
  _onTagSearch(word) {
    const config = Config.namespace('videoSearch');
    const {sort, order, playlistSort} =
      parseVideoSearchSortValue(config.getValue('sort') || 'playlist');

    let option = {
      searchType: 'tag',
      order,
      sort,
      playlistSort
      // Task 073: 以前は検索欄の「投稿者の動画のみ」の設定値も引き継いでいたが、
      // タグをクリックした時は常にタグ全体から検索する（検索欄の項目を将来削除しても影響しないよう切り離した）。
    };

    super._onCommand('playlistSetSearchVideo', {word, option});
  }

  update({tagList = [], watchId = null, videoId = null, token = null, tagEdit = null, genre = undefined}) {
    // Task 074: 再生中の動画のジャンル（タグ欄の先頭にバッジで出す）
    if (genre !== undefined) {
      this._genre = genre;
    }
    if (watchId) {
      this._watchId = watchId;
    }
    if (videoId) {
      this._videoId = videoId;
    }
    if (token) {
      this._token = token;
    }
    if (tagEdit) {
      this._tagEdit = tagEdit;
    }

    this.setState({
      isInputing: false,
      isUpdating: false,
      isEditing: false,
      isEmpty: false
    });
    this._update(tagList);

    this._boundOnBodyClick = this._onBodyClick.bind(this);
  }

  _onClick(e) {
    if (this._state.isInputing || this._state.isEditing) {
      e.stopPropagation();
    }
    super._onClick(e);
  }

  _update(tagList = []) {
    let tags = [];
    const genre = this._genre;
    if (genre && genre.label) {
      // Task 074: クリックすると検索欄のジャンル絞り込みをこのジャンルに合わせる
      tags.push(`<li class="genreItem" title="ジャンル: ${textUtil.escapeHtml(genre.label)}（クリックで検索欄のジャンル絞り込みに設定）"
        ><span class="genreBadge command" data-command="set-search-genre" data-param="${textUtil.escapeHtml(genre.key)}"
        >${textUtil.escapeHtml(genre.label)}</span></li>`);
    }
    tagList.forEach(tag => {
      tags.push(this._createTag(tag));
    });
    if (nicoUtil.isLogin()) {
      tags.push(this._createToggleInput());
    } else {
      tags.push(`<span class="text">ログインしていません</span>`);
    }
    this.setState({isEmpty: tagList.length < 1});
    this._elm.videoTagsInner.innerHTML = tags.join('');
    this._updateNicodicIcons(tagList);
  }

  /**
   * 大百科の記事があるタグのアイコンを、取得できしだい差し替える（Task 044）。
   *
   * 以前は視聴ページAPIのタグ情報にあるisNicodicArticleExistsを見ていたが、
   * ニコニコ側がこの値を返さなくなり（2026-09時点で、明らかに記事がある
   * タグまで含めて常にfalse）、アイコンが一切出なくなっていた。
   * 代わりに大百科の記事ページのHTTPステータス（あれば200・無ければ404）で
   * 判定する。詳しくはNicodicArticleLoaderのコメントを参照。
   *
   * 判定には通信が要るため、まず今まで通りの見た目で描画しておき、
   * 結果が返ったものから順にアイコンと状態を書き換える
   * （結果が返らなくても、記事なしの見た目のまま実害は無い）。
   */
  _updateNicodicIcons(tagList = []) {
    const container = this._elm.videoTagsInner;
    if (!container || !tagList.length) { return; }
    // 描画し直された後に古い結果が書き込まれないよう、世代で見分ける
    const generation = (this._nicodicGeneration = (this._nicodicGeneration || 0) + 1);
    const names = tagList.map(tag => tag.name).filter(name => name);

    NicodicArticleLoader.checkAll(names, (name, hasDic, article) => {
      if (generation !== this._nicodicGeneration || !hasDic) { return; }
      const li = container.querySelector(`li[data-tag-id="${window.CSS && CSS.escape ? CSS.escape(name) : name}"]`);
      if (!li) { return; }
      const menu = li.querySelector('.tagItemMenu');
      if (menu) {
        // この要素はシャドウDOMを持つカスタム要素。属性を書き換えると
        // attributeChangedCallbackが拾って見た目に反映される（Task 047）
        menu.dataset.hasNicodic = '1';
        if (article && article.summary) {
          menu.dataset.nicodicSummary =
            article.summary.replace(/\s+/g, ' ').slice(0, 200);
        }
      }
      // 以下はカスタム要素が使えない環境での予備表示（通常は描画されない）
      const img = li.querySelector('img.dicIcon');
      if (img) { img.src = TagListView.DIC_ICON_EXISTS; }
    });
  }

  _createToggleInput() {
    return (`
        <div
          class="button command toggleInput"
          data-command="toggleInput"
          data-tooltip="タグ追加">
          <span class="icon">&#8853;</span>
        </div>`).trim();
  }

  _onApiResult(watchId, result) {
    if (watchId !== this._watchId) {
      return; // 通信してる間に動画変わったぽい
    }
    const err = result.error_msg;
    if (err) {
      this.emit('command', 'alert', err);
    }

    this.update(result.tags);
  }

  // Task 066: タグ編集キーが期限切れで取り直された場合、以後の操作でも
  // 新しいキーを使うよう手元の tagEdit を更新する。
  _onEditKeyUpdate(watchId, newKey) {
    if (watchId !== this._watchId || !newKey) {
      return;
    }
    this._tagEdit = Object.assign({}, this._tagEdit || {}, {editKey: newKey});
  }

  // Task 066: 以前は失敗時にresultがundefinedになり、result.tags等の参照で
  // 例外になって「更新中」のまま固まっていた。失敗時は状態を戻して通知する。
  _onTagEditError(watchId, err, label) {
    window.console.warn(`[TagListView] ${label}`, err);
    if (watchId !== this._watchId) {
      return;
    }
    this.setState({isUpdating: false});
    this.emit('command', 'alert', (err && err.message) || `${label}に失敗しました`);
  }

  _addTag(tag) {
    this.setState({isUpdating: true});

    const wait3s = this._makeWait(3000);
    const watchId = this._watchId;
    const videoId = this._videoId;
    const csrfToken = this._token;
    const editKey = this._tagEdit?.editKey;
    const addTag = () => {
      return this._tagEditApi.add({
        videoId,
        tag,
        csrfToken,
        editKey,
        onEditKeyUpdate: key => this._onEditKeyUpdate(watchId, key)
      });
    };

    return Promise.all([addTag(), wait3s]).then(results => {
      let result = results[0] || {};
      if (watchId !== this._watchId) {
        return;
      } // 待ってる間に動画が変わったぽい
      if (result.tags) {
        this._update(result.tags);
      }
      this.setState({isInputing: false, isUpdating: false, isEditing: false});

      if (result.error_msg) {
        this.emit('command', 'alert', result.error_msg);
      }
    }).catch(err => this._onTagEditError(watchId, err, 'タグの追加'));
  }

  _removeTag(tagId, tag = '') {
    this.setState({isUpdating: true});

    const wait3s = this._makeWait(3000);
    const watchId = this._watchId;
    const videoId = this._videoId;
    const csrfToken = this._token;
    const editKey = this._tagEdit?.editKey;
    const removeTag = () => {
      return this._tagEditApi.remove({
        videoId,
        tag,
        id: tagId,
        csrfToken,
        editKey,
        onEditKeyUpdate: key => this._onEditKeyUpdate(watchId, key)
      });
    };

    return Promise.all([removeTag(), wait3s]).then((results) => {
      let result = results[0] || {};
      if (watchId !== this._watchId) {
        return;
      } // 待ってる間に動画が変わったぽい
      if (result.tags) {
        this._update(result.tags);
      }
      this.setState({isUpdating: false});

      if (result.error_msg) {
        this.emit('command', 'alert', result.error_msg);
      }
    }).catch(err => this._onTagEditError(watchId, err, 'タグの削除'));
  }

  _refreshTag() {
    this.setState({isUpdating: true});
    const watchId = this._watchId;
    const wait1s = this._makeWait(1000);
    const load = () => {
      return this._tagEditApi.load(this._videoId, this._tagEdit?.editKey, {
        onEditKeyUpdate: key => this._onEditKeyUpdate(watchId, key)
      });
    };

    return Promise.all([load(), wait1s]).then((results) => {
      let result = results[0] || {};
      if (watchId !== this._watchId) {
        return;
      } // 待ってる間に動画が変わったぽい
      this._update(result.tags || []);
      this.setState({isUpdating: false, isInputing: false, isEditing: false});
    }).catch(err => this._onTagEditError(watchId, err, 'タグ一覧の取得'));
  }

  _makeWait(ms) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(ms);
      }, ms);
    });
  }

  _createDicIcon(text, hasDic) {
    let href = `https://dic.nicovideo.jp/a/${encodeURIComponent(text)}`;
    // TODO: 本家がHTML5に完全移行したらこのアイコンも消えるかもしれないので代替を探す
    let src = hasDic ?
      TagListView.DIC_ICON_EXISTS : TagListView.DIC_ICON_NONE;
    let icon = `<img class="dicIcon" src="${src}">`;
    
    let hasNicodic = hasDic ? 1 : 0;
    return (
      `<zenza-tag-item-menu
        class="tagItemMenu"
        data-text="${encodeURIComponent(text)}"
        data-has-nicodic="${hasNicodic}"
      ><a target="_blank" class="nicodic" href="${href}">${icon}</a></zenza-tag-item-menu>`
    );
  }

  _createDeleteButton(id) {
  
    let deletTag = '';
    if(nicoUtil.isLogin()){
      deletTag = `<span target="_blank" class="deleteButton command" title="削除" data-command="removeTag" data-param="${id}">－</span>`;
    }else{
      deletTag = `<span target="_blank" class="deleteButton command" title="ログインしてください" data-command="none" data-param="${id}">×</span>`;
    }
    return deletTag;
  }

  _createLink(text) {
    let href = `//www.nicovideo.jp/tag/${encodeURIComponent(text)}`;
    // タグはエスケープされた物が来るのでそのままでつっこんでいいはずだが、
    // 古いのはけっこういい加減なデータもあったりして信頼できない        
    text = textUtil.escapeToZenkaku(textUtil.unescapeHtml(text));
    return `<a class="tagLink" href="${href}">${text}</a>`;
  }

  _createSearch(text) {
    let title = 'プレイリストに追加';
    let command = 'tag-search';
    let param = textUtil.escapeHtml(text);
    return (`<zenza-playlist-append class="playlistAppend" title="${title}" data-command="${command}" data-param="${param}">▶</zenza-playlist-append>`);
  }

  _createTag(tag) {
    let tagName = tag.name;
    let dic = this._createDicIcon(tagName, !!tag.isNicodicArticleExists);
    let del = this._createDeleteButton(tagName);
    let link = this._createLink(tagName);
    let search = this._createSearch(tagName);
    let data = textUtil.escapeHtml(JSON.stringify(tag));
    let className = tag.isLocked ? 'tagItem is-Locked' : 'tagItem';
    
    return `<li class="${className}" data-tag="${data}" data-tag-id="${tagName}">${dic}${del}${link}${search}</li>`;
  }

  _onTagInputKeyDown(e) {
    if (this._state.isUpdating) {
      e.preventDefault();
      e.stopPropagation();
    }
    switch (e.keyCode) {
      case 27: // ESC
        e.preventDefault();
        e.stopPropagation();
        this._endInput();
        break;
    }
  }

  _onTagInputSubmit(e) {
    if (this._state.isUpdating) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    let val = (this._elm.tagInput.value || '').trim();
    if (!val) {
      this._endInput();
      return;
    }
    this._onCommand('addTag', val);
    this._elm.tagInput.value = '';
  }

  _onBodyClick() {
    this._endInput();
    this._endEdit();
  }

  _beginEdit() {
    this.setState({isEditing: true});
    document.body.addEventListener('click', this._boundOnBodyClick);
  }

  _endEdit() {
    document.body.removeEventListener('click', this._boundOnBodyClick);
    this.setState({isEditing: false});
  }

  _beginInput() {
    this.setState({isInputing: true});
    document.body.addEventListener('click', this._boundOnBodyClick);
    this._elm.tagInput.value = '';
    window.setTimeout(() => {
      this._elm.tagInput.focus();
    }, 100);
  }

  _endInput() {
    this._elm.tagInput.blur();
    document.body.removeEventListener('click', this._boundOnBodyClick);
    this.setState({isInputing: false});
  }


}


// 大百科の記事の有無を示すアイコン（Task 045）。
//
// 注意（Task 047で判明）: これは <zenza-tag-item-menu> のlight DOM側にある
// <img> 用で、**カスタム要素が使える環境では描画されない**（シャドウDOMに
// slotが無いため）。実際に見えているアイコンはTagItemMenuのシャドウDOM内の
// .icon.toggle で、そちらは画像を使わずCSSで描かれている。
// ここは、カスタム要素が定義できなかった場合の予備。
//
// 元は live.nicovideo.jp の画像2枚を参照していたが、この2つのURLは
// 現在どちらも404で、画像そのものが消えていた
// （実際に読み込みを試して確認。ソースにも「本家がHTML5に完全移行したら
//   このアイコンも消えるかもしれないので代替を探す」というTODOが残っていた）。
// つまり記事の有無を正しく判定できたとしても、アイコンは表示できない
// 状態だった。
//
// 二度と外部の都合で消えないよう、画像を外部から取るのをやめて、
// その場で描いたSVGを埋め込む（本を開いた形）。
const dicIconSvg = (left, right, opacity) =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" opacity="' + opacity + '">' +
      '<path d="M1.4 2.6h5.3c.7 0 1.3.6 1.3 1.3v10c-.3-.5-.8-.8-1.3-.8H1.4z" fill="' + left + '"/>' +
      '<path d="M14.6 2.6H9.3c-.7 0-1.3.6-1.3 1.3v10c.3-.5.8-.8 1.3-.8h5.3z" fill="' + right + '"/>' +
    '</svg>');

// 記事あり: はっきり見える色。記事なし: 灰色で薄く。
TagListView.DIC_ICON_EXISTS = dicIconSvg('#d2483f', '#f0938c', '1');
TagListView.DIC_ICON_NONE   = dicIconSvg('#999999', '#cccccc', '0.5');

TagListView.__shadow__ = (`
    <style>
      :host-context(.videoTagsContainer.sideTab) .tagLink {
        color: #000 !important;
        text-decoration: none;
      }

      .TagListView {
        position: relative;
        user-select: none;
      }

      .TagListView.is-Updating {
        cursor: wait;
      }

      :host-context(.videoTagsContainer.sideTab) .TagListView.is-Updating {
        overflow: hidden;
      }

      .TagListView.is-Updating:after {
        content: '${'\\0023F3'}';
        position: absolute;
        top: 50%;
        left: 50%;
        text-align: center;
        transform: translate(-50%, -50%);
        z-index: 10001;
        color: #fe9;
        font-size: 24px;
        letter-spacing: 3px;
        text-shadow: 0 0 4px #000;
        pointer-events: none;
      }

      .TagListView.is-Updating:before {
        content: ' ';
        background: rgba(0, 0, 0, 0.6);
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
        height: 100%;
        padding: 8px;
        z-index: 10000;
        box-shadow: 0 0 8px #000;
        border-radius: 8px;
        pointer-events: none;
      }

      .TagListView.is-Updating * {
        pointer-events: none;
      }

      *[data-tooltip] {
        position: relative;
      }

      .TagListView .button {
        position: relative;
        display: inline-block;
        min-width: 40px;
        min-height: 24px;
        cursor: pointer;
        user-select: none;
        transition: 0.2s transform, 0.2s box-shadow, 0.2s background;
        text-align: center;
      }

      .TagListView .button:hover {
        background: #666;
      }

      .TagListView .button:active {
        transition: none;
        box-shadow: 0 0 2px #000 inset;
      }
      .TagListView .button .icon {
        position: absolute;
        display: inline-block;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .TagListView *[data-tooltip]:hover:after {
        content: attr(data-tooltip);
        position: absolute;
        left: 50%;
        bottom: 100%;
        transform: translate(-50%, 0) scale(0.9);
        pointer-events: none;
        background: rgba(192, 192, 192, 0.9);
        box-shadow: 0 0 4px #000;
        color: black;
        font-size: 12px;
        margin: 0;
        padding: 2px 4px;
        white-space: nowrap;
        z-index: 10000;
        letter-spacing: 2px;
      }

      .videoTags {
        display: inline-block;
        padding: 0;
      }

      /* Task 075: タグ編集・リロードのボタン（.tagEditContainerが左上に重なって置かれている）と
         ジャンルのバッジが重ならないよう、ボタン2つ分の幅だけ右へずらす。
         タグが1件も無い時はボタンが通常の位置（in-flow）に戻るので、ずらさない。 */
      .genreItem {
        display: inline-block;
        vertical-align: middle;
        margin: 0 6px 2px 84px;
      }
      .TagListView.is-Empty .genreItem {
        margin-left: 0;
      }
      .genreBadge {
        display: inline-block;
        padding: 0 8px;
        border-radius: 10px;
        background: #4a6;
        color: #fff;
        font-size: 12px;
        line-height: 18px;
        font-weight: bold;
        cursor: pointer;
        white-space: nowrap;
      }
      .genreBadge:hover {
        background: #5c8;
      }

      .videoTagsInner {
        display: flex;
        flex-wrap: wrap;
        padding: 0 8px;
      }

      .TagListView .tagItem {
        position: relative;
        list-style-type: none;
        display: inline-flex;
        margin-right: 2px;
        line-height: 20px;
        max-width: 50vw;
        align-items: center;
      }

      .TagListView .tagItem:first-child {
        margin-left: 100px;
      }

      .tagLink {
        color: #fff;
        text-decoration: none;
        user-select: none;
        display: inline-block;
        border: 1px solid rgba(0, 0, 0, 0);
      }

      .TagListView .nicodic {
        display: inline-block;
        margin-right: 4px;
        line-height: 20px;
        cursor: pointer;
        vertical-align: middle;
      }

      /* Task 045: アイコンをインラインSVGに変えたため、表示サイズを明示する
         （元の外部画像は画像自身のサイズで表示されていた）。 */
      .TagListView .dicIcon {
        width: 16px;
        height: 16px;
        vertical-align: middle;
      }

      .TagListView.is-Editing .tagItemMenu,
      .TagListView.is-Editing .nicodic,
      .TagListView:not(.is-Editing) .deleteButton {
        display: none !important;
      }

      .TagListView .deleteButton {
        display: inline-block;
        margin: 0px;
        line-height: 20px;
        width: 20px;
        height: 20px;
        font-size: 16px;
        background: #f66;
        color: #fff;
        cursor: pointer;
        border-radius: 100%;
        transition: transform 0.2s, background 0.4s;
        text-shadow: none;
        transform: scale(1.2);
        text-align: center;
        opacity: 0.8;
      }

      .TagListView.is-Editing .deleteButton:hover {
        transform: rotate(0) scale(1.2);
        background: #f00;
        opacity: 1;
      }

      .TagListView.is-Editing .deleteButton:active {
        transform: rotate(360deg) scale(1.2);
        transition: none;
        background: #888;
      }

      .TagListView.is-Editing .is-Locked .deleteButton {
        visibility: hidden;
      }
      
      .TagListView .is-Removing .deleteButton {
        background: #666;
      }

      .tagItem .playlistAppend {
        display: inline-block;
        position: relative;
        left: auto;
        bottom: auto;
      }

      .TagListView .tagItem .playlistAppend {
        display: inline-block;
        font-size: 16px;
        line-height: 24px;
        width: 24px;
        height: 24px;
        bottom: 4px;
        background: #666;
        color: #ccc;
        text-decoration: none;
        border: 1px outset;
        cursor: pointer;
        text-align: center;
        user-select: none;
        visibility: hidden;
        margin-right: -2px;
      }

      .tagItem:hover .playlistAppend {
        visibility: visible;
      }

      .tagItem:hover .playlistAppend:hover {
        transform: scale(1.5);
      }

      .tagItem:hover .playlistAppend:active {
        transform: scale(1.4);
      }

      .tagItem.is-Removing {
        transform-origin: right !important;
        transform: translate(0, 150vh) !important;
        opacity: 0 !important;
        max-width: 0 !important;
        transition:
          transform 2s ease 0.2s,
          opacity 1.5s linear 0.2s,
          max-width 0.5s ease 1.5s
        !important;
        pointer-events: none;
        overflow: hidden !important;
        white-space: nowrap;
      }

      .is-Editing .playlistAppend {
        visibility: hidden !important;
      }

      .is-Editing .tagLink {
        pointer-events: none;
      }
      .is-Editing .dicIcon {
        display: none;
      }

      .tagItem:not(.is-Locked) {
        transition: transform 0.2s, text-shadow 0.2s;
      }

      .is-Editing .tagItem.is-Locked {
        position: relative;
        cursor: not-allowed;
      }

      .is-Editing .tagItem.is-Locked *{
        pointer-events: none;
      }

      .is-Editing .tagItem.is-Locked:hover:after {
        content: '${'\\01F6AB'} ロックタグ';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #ff9;
        white-space: nowrap;
        background: rgba(0, 0, 0, 0.6);
      }

      .is-Editing .tagItem:nth-child(11).is-Locked:hover:after {
        content: '${'\\01F6AB'} ロックマン';
      }

      .is-Editing .tagItem:not(.is-Locked) {
        text-shadow: 0 4px 4px rgba(0, 0, 0, 0.8);
      }

      .is-Editing .tagItem.is-Category * {
        color: #ff9;
      }
      .is-Editing .tagItem.is-Category.is-Locked:hover:after {
        content: '${'\\01F6AB'} カテゴリタグ';
      }


      .tagInputContainer {
        display: none;
        padding: 4px 8px;
        background: #666;
        z-index: 5000;
        box-shadow: 4px 4px 4px rgba(0, 0, 0, 0.8);
        font-size: 16px;
      }

      :host-context(.videoTagsContainer.sideTab)     .tagInputContainer {
        position: absolute;
        background: #999;
      }

      .tagInputContainer .tagInputText {
        width: 200px;
        font-size: 20px;
      }

      .tagInputContainer .submit {
        font-size: 20px;
      }

      .is-Inputing .tagInputContainer {
        display: inline-block;
      }

      .is-Updating .tagInputContainer {
        pointer-events: none;
      }

        .tagInput {
          border: 1px solid;
        }

        .tagInput:active {
          box-shadow: 0 0 4px #fe9;
        }

        .submit, .cancel {
          background: #666;
          color: #ccc;
          cursor: pointer;
          border: 1px solid;
          text-align: center;
        }

      .TagListView .tagEditContainer {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 1000;
        display: inline-block;
      }

      .TagListView.is-Empty .tagEditContainer {
        position: relative;
      }

      .TagListView:hover .tagEditContainer {
        display: inline-block;
      }

      .TagListView.is-Updating .tagEditContainer * {
        pointer-events: none;
      }

      .TagListView .tagEditContainer .button,
      .TagListView .videoTags .button {
        border-radius: 16px;
        font-size: 24px;
        line-height: 24px;
        margin: 0;
      }

      .TagListView.is-Editing .button.toggleEdit,
      .TagListView .button.toggleEdit:hover {
        background: #c66;
      }

      .TagListView .button.tagRefresh .icon {
        transform: translate(-50%, -50%) rotate(90deg);
        transition: transform 0.2s ease;
        font-family: STIXGeneral;
      }

      .TagListView .button.tagRefresh:active .icon {
        transform: translate(-50%, -50%) rotate(-330deg);
        transition: none;
      }

      .TagListView.is-Inputing .button.toggleInput {
        display: none;
      }

      .TagListView  .button.toggleInput:hover {
        background: #66c;
      }

      .tagEditContainer form {
        display: inline;
      }

    </style>
    <div class="root TagListView">
      <div class="tagEditContainer">
        <div
          class="button command toggleEdit"
          data-command="toggleEdit"
          data-tooltip="タグ編集">
          <span class="icon">&#9999;</span>
        </div>

        <div class="button command tagRefresh"
          data-command="refresh"
          data-tooltip="リロード">
          <span class="icon">&#8635;</span>
        </div>
      </div>

      <div class="videoTags">
        <span class="videoTagsInner"></span>
        <div class="tagInputContainer">
          <form action="javascript: void">
            <input type="text" name="tagText" class="tagInputText">
            <button class="submit button">O K</button>
          </form>
        </div>
      </div>
    </div>
  `).trim();

TagListView.__css__ = (`

    /* Firefox用 ShaowDOMサポートしたら不要 */
    .videoTagsContainer.sideTab .is-Updating {
      overflow: hidden;
    }
    .videoTagsContainer.sideTab a {
      color: #000 !important;
      text-decoration: none !important;
    }
    .videoTagsContainer.videoHeader a {
      color: #fff !important;
      text-decoration: none !important;
    }
    .videoTagsContainer.sideTab .tagInputContainer {
      position: absolute;
    }

  `).trim();


class TagItemMenu extends HTMLElement {
  static template({text}) {
    let host = location.host;
    return `
      <style>
        .root {
          display: inline-block;
          --icon-size: 16px;
          margin-right: 4px;
          outline: none;
        }

        .icon {
          position: relative;
          display: inline-block;
          vertical-align: middle;
          box-sizing: border-box;
          width: var(--icon-size);
          height: var(--icon-size);
          margin: 0;
          padding: 0;
          font-size: var(--icon-size);
          line-height: calc(var(--icon-size));
          text-align: center;
          cursor: pointer;
        }

        .nicodic, .toggle {
          background: #888;
          color: #ccc;
          box-shadow: 0.1em 0.1em 0 #333;
          transition: background 0.2s ease, color 0.2s ease;
        }
        /* 記事があるタグ。灰色との差がはっきり出るようにしてある（Task 047） */
        .has-nicodic .nicodic,.has-nicodic .toggle {
          background: #c62828;
          color: #fff;
        }
        .toggle::after {
          content: '？';
          position: absolute;
          width: var(--icon-size);
          left: 0;
          font-size: 0.8em;
          font-weight: bolder;
        }

        .menu {
          display: none;
          position: fixed;
          background-clip: content-box;
          border-style: solid;
          border-width: 16px 0 16px 0;
          border-color: transparent;
          padding: 0;
          z-index: 100;
          transform: translateY(-30px);
        }

        :host-context(.zenzaWatchVideoInfoPanelFoot) .menu {
          position: absolute;
          bottom: 0;
          transform: translateY(8x);
        }

        .root .menu:hover,
        .root:focus-within .menu {
          display: inline-block;
        }

        li {
          list-style-type: none;
          padding: 2px 8px 2px 20px;
          background: rgba(80, 80, 80, 0.95);
        }

        li a {
          display: inline-block;
          white-space: nowrap;
          text-decoration: none;
          color: #ccc;
        }

        li a:hover {
          text-decoration: underline;
        }

      </style>
      <div class="root" tabindex="-1">
        <div class="icon toggle"></div>
        <ul class="menu">

          <li>
            <a href="//dic.nicovideo.jp/a/${text}"
              ${host !== 'dic.nicovideo.jp' ? 'target="_blank"' : ''}>
              大百科を見る
            </a>
          </li>
          <li>
            <a href="//ch.nicovideo.jp/search/${text}?type=video&mode=t"
              ${host !== 'ch.nicovideo.jp' ? 'target="_blank"' : ''}>
              チャンネル検索
            </a>
          </li>
          <li>
            <a href="https://www.google.co.jp/search?q=${text}%20site:www.nicovideo.jp&num=100&tbm=vid"
              ${host !== 'www.google.co.jp' ? 'target="_blank"' : ''}>
              Googleで検索
            </a>
          </li>
          <li>
            <a href="https://www.bing.com/videos/search?q=${text}%20site:www.nicovideo.jp&qft=+filterui:msite-nicovideo.jp"
              ${host !== 'www.bing.com' ? 'target="_blank"' : ''}>Bingで検索
            </a>
          </li>
          <li>
            <a href="https://www.google.co.jp/search?q=${text}%20site:www.nicovideo.jp/series&num=100"
              ${host !== 'www.google.co.jp' ? 'target="_blank"' : ''}>
              シリーズ検索
            </a>
          </li>
        </ul>
      </div>
    `;
  }
  constructor() {
    super();
    this.hasNicodic = parseInt(this.dataset.hasNicodic) !== 0;
    this.text = textUtil.escapeToZenkaku(this.dataset.text);
    const shadow = this._shadow = this.attachShadow({mode: 'open'});
    shadow.innerHTML = this.constructor.template({text: this.text});
    this._applyHasNicodic();
  }

  /*
    Task 047: 大百科アイコンが変わらなかった、本当の本当の原因。

    Task 044・045では、この要素の**light DOM側**にある
    <img class="dicIcon"> を書き換えていた。ところがこの要素は
    シャドウDOMを持ち、その中に <slot> が無い。つまり
    **light DOMの中身は最初から一切描画されていない**（存在はするが見えない）。
    実際に画面に出ているアイコンは、シャドウDOM内の
    <div class="icon toggle"></div>（CSSで描いた四角＋「？」）の方で、
    記事の有無は .root に has-nicodic が付くかどうかで
    背景色（#888 → #900）が変わる仕組みだった。画像は使っていない。

    そして、その has-nicodic はコンストラクタで一度きり設定されており、
    後から data-has-nicodic を書き換えても何も起きなかった。
    大百科の記事有無は通信して分かるものなので、後から反映できなければ
    意味がない。属性の変化を監視して反映するようにする。
  */
  static get observedAttributes() {
    return ['data-has-nicodic', 'data-nicodic-summary'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._shadow || oldValue === newValue) { return; }
    if (name === 'data-has-nicodic') {
      this.hasNicodic = parseInt(newValue, 10) !== 0;
      this._applyHasNicodic();
      return;
    }
    if (name === 'data-nicodic-summary') {
      // 大百科APIが返す要約。マウスを乗せると読めるようにする
      this.title = newValue || '';
    }
  }

  _applyHasNicodic() {
    const root = this._shadow && this._shadow.querySelector('.root');
    if (!root) { return; }
    root.classList.toggle('has-nicodic', this.hasNicodic);
    if (!this.title) {
      this.title = this.hasNicodic ?
        '大百科に記事があります' : '大百科の記事はまだありません';
    }
  }
}
if (window.customElements) {
  window.customElements.define('zenza-tag-item-menu', TagItemMenu);
}

//===END===

export {TagListView};
