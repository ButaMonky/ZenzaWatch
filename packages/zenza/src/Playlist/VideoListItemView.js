import {textUtil} from '../../../lib/src/text/textUtil';
import {dll} from '../../../components/src/dll';
//===BEGIN===
// なんか汎用性を持たせようとして失敗してる奴
class VideoListItemView  {
  static get ITEM_HEIGHT() { return 100; }
  static get THUMBNAIL_WIDTH() { return 96; }
  static get THUMBNAIL_HEIGHT() { return 72; }
  // ここはDOM的に隔離されてるので外部要因との干渉を考えなくてよい
  static get CSS() { return `
  * {
    box-sizing: border-box;
  }

  .videoItem {
    position: relative;
    display: grid;
    width: 100%;
    height: 100%;
    overflow: hidden;
    grid-template-columns: ${this.THUMBNAIL_WIDTH}px 1fr;
    grid-template-rows: ${this.THUMBNAIL_HEIGHT}px 1fr;
    padding: 2px;
    transition:
      box-shadow 0.4s ease;
    contain: layout size paint;
    /*content-visibility: auto;*/
  }

  .is-updating .videoItem {
    transition: none !important;
  }

  .playlist .videoItem {
    cursor: move;
  }

  .playlist .videoItem.is-inview::before {
    content: attr(data-index);
    /*counter-increment: itemIndex;*/
    position: absolute;
    right: 8px;
    top: 80%;
    color: #666;
    font-family: Impact;
    font-size: 45px;
    pointer-events: none;
    z-index: 1;
    line-height: ${this.ITEM_HEIGHT}px;
    opacity: 0.6;

    transform: translate(0, -50%);
  }

  .videoItem.is-updating {
    opacity: 0.3;
    cursor: wait;
  }
  .videoItem.is-updating * {
    pointer-events: none;
  }

  .videoItem.is-dragging {
    pointer-events: none;
    box-shadow: 8px 8px 4px #000;
    background: #666;
    opacity: 0.8;
    transform: translate(var(--trans-x-pp), var(--trans-y-pp));
    transition:
      box-shadow 0.4s ease;
    z-index: 10000;
  }

  .videoItem.is-dropped {
    display: none;
  }

  .is-dragging * {
    cursor: move;
  }

  .is-dragging .videoItem.is-dragover {
    outline: 5px dashed #99f;
  }

  .is-dragging .videoItem.is-dragover * {
    opacity: 0.3;
  }

  .videoItem + .videoItem {
    border-top: 1px dotted var(--item-border-color);
    margin-top: 4px;
    outline-offset: -8px;
  }

  .videoItem.is-ng-rejected {
    display: none;
  }
  .videoItem.is-favorited .postedAt::after {
    content: ' ★';
    color: #fea;
    text-shadow: 2px 2px 2px #000;
  }

  .thumbnailContainer {
    position: relative;
    transform: translate(0, 2px);
    margin: 0;
    /*background-color: black;*/
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }

  /* ニコニ広告の金冠・銀冠(Task 054)。
     ニコニコ本家のランキング等で実際に使われているのと同じSVG（左上の
     折れたリボン風アイコン）をそのまま流用する。本家はサムネイル画像に
     <img>を別要素として重ねているが、ここではCSSの背景画像1枚で
     同じ見た目を再現する（サムネイル96x72pxに合わせてサイズは縮小）。 */
  .videoItem.is-adDecoration-gold .thumbnailContainer::after,
  .videoItem.is-adDecoration-silver .thumbnailContainer::after {
    content: '';
    position: absolute;
    left: -2px;
    top: -2px;
    width: 22px;
    height: 22px;
    background-repeat: no-repeat;
    background-size: contain;
    pointer-events: none;
    z-index: 1;
  }
  .videoItem.is-adDecoration-silver .thumbnailContainer::after {
    background-image: url("data:image/svg+xml,%3csvg%20width='50'%20height='50'%20viewBox='0%200%2050%2050'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M48.9979%200H3.00073H1.00024C0.448108%200%200%200.448108%200%201.00024V3.00073V48.9979C0%2049.8911%201.08126%2050.3362%201.71041%2049.702L3.7109%2047.6855C3.89694%2047.4975%204.00097%2047.2444%204.00097%2046.9814V40.0097L40.0097%204.00097H46.9814C47.2454%204.00097%2047.4985%203.89694%2047.6855%203.7109L49.702%201.71041C50.3362%201.08126%2049.8911%200%2048.9979%200Z'%20fill='%23BEC8C8'/%3e%3cg%20clip-path='url(%23clip0_597_345)'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M10.6963%205.59039C11.2495%205.04209%2012.4718%205.27496%2013.9554%206.08324L13.7742%207.09236C13.0017%206.72641%2012.4028%206.64263%2012.1231%206.92109C11.4725%207.57042%2012.7897%209.93858%2015.0717%2012.2119C17.3524%2014.4839%2019.7293%2015.8011%2020.3811%2015.1505C20.662%2014.8794%2020.5758%2014.2745%2020.2086%2013.5044L21.2141%2013.3245C22.0261%2014.8055%2022.2602%2016.0204%2021.7106%2016.5699C21.5862%2016.687%2021.4321%2016.7695%2021.2658%2016.8102L21.267%2016.8127L9.91263%2019.8486L9.34337%2021.9679C9.32858%2022.032%209.29654%2022.0911%209.24972%2022.1392C8.86405%2022.515%207.63435%2021.9051%206.4909%2020.7641C5.34745%2019.6219%204.7326%2018.3935%205.11211%2018.014C5.16016%2017.9684%205.21931%2017.9364%205.28461%2017.9216L7.4101%2017.3536L10.4499%206.03395C10.4917%205.86638%2010.5768%205.7136%2010.6963%205.59039ZM21.558%2010.6172C21.8389%2010.5421%2022.1272%2010.7084%2022.2024%2010.9881L22.2319%2011.099C22.3071%2011.3787%2022.1408%2011.6658%2021.8598%2011.7409L18.1757%2012.7254C17.8947%2012.8006%2017.6076%2012.6342%2017.5312%2012.3546L17.5017%2012.2437C17.4265%2011.964%2017.5928%2011.6769%2017.8738%2011.6017L21.558%2010.6172ZM19.2388%207.22949C19.4445%207.02496%2019.7772%207.02496%2019.983%207.22949L20.0643%207.31205C20.2701%207.51658%2020.2701%207.84802%2020.0643%208.05256L16.9556%2011.1526C16.7498%2011.3571%2016.4171%2011.3571%2016.2113%2011.1526L16.13%2011.0713C15.9242%2010.8655%2015.9242%2010.5341%2016.13%2010.3295L19.2388%207.22949ZM16.0671%205.00177L16.1607%205.01806L16.2728%205.04763C16.5538%205.12279%2016.7201%205.41111%2016.6449%205.6908L15.6567%209.36256C15.5828%209.64226%2015.2932%209.80859%2015.0135%209.73343L14.9014%209.70386C14.6205%209.6287%2014.4541%209.34162%2014.5293%209.06192L15.5175%205.38893C15.5927%205.10924%2015.8798%204.9429%2016.1607%205.01806L16.0671%205.00177Z'%20fill='%23889C9C'/%3e%3c/g%3e%3cdefs%3e%3cclipPath%20id='clip0_597_345'%3e%3crect%20width='18'%20height='18'%20fill='white'%20transform='translate(5%205)'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e");
  }
  .videoItem.is-adDecoration-gold .thumbnailContainer::after {
    background-image: url("data:image/svg+xml,%3csvg%20width='50'%20height='50'%20viewBox='0%200%2050%2050'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M48.9979%200H3.00073H1.00024C0.448108%200%200%200.448108%200%201.00024V3.00073V48.9979C0%2049.8911%201.08126%2050.3362%201.71041%2049.702L3.7109%2047.6855C3.89694%2047.4975%204.00097%2047.2444%204.00097%2046.9814V40.0097L40.0097%204.00097H46.9814C47.2454%204.00097%2047.4985%203.89694%2047.6855%203.7109L49.702%201.71041C50.3362%201.08126%2049.8911%200%2048.9979%200Z'%20fill='%23FFD700'/%3e%3cg%20clip-path='url(%23clip0_597_346)'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M10.6963%205.59039C11.2495%205.04209%2012.4718%205.27496%2013.9554%206.08324L13.7742%207.09236C13.0017%206.72641%2012.4028%206.64263%2012.1231%206.92109C11.4725%207.57042%2012.7897%209.93858%2015.0717%2012.2119C17.3524%2014.4839%2019.7293%2015.8011%2020.3811%2015.1505C20.662%2014.8794%2020.5758%2014.2745%2020.2086%2013.5044L21.2141%2013.3245C22.0261%2014.8055%2022.2602%2016.0204%2021.7106%2016.5699C21.5862%2016.687%2021.4321%2016.7695%2021.2658%2016.8102L21.267%2016.8127L9.91263%2019.8486L9.34337%2021.9679C9.32858%2022.032%209.29654%2022.0911%209.24972%2022.1392C8.86405%2022.515%207.63435%2021.9051%206.4909%2020.7641C5.34745%2019.6219%204.7326%2018.3935%205.11211%2018.014C5.16016%2017.9684%205.21931%2017.9364%205.28461%2017.9216L7.4101%2017.3536L10.4499%206.03395C10.4917%205.86638%2010.5768%205.7136%2010.6963%205.59039ZM21.558%2010.6172C21.8389%2010.5421%2022.1272%2010.7084%2022.2024%2010.9881L22.2319%2011.099C22.3071%2011.3787%2022.1408%2011.6658%2021.8598%2011.7409L18.1757%2012.7254C17.8947%2012.8006%2017.6076%2012.6342%2017.5312%2012.3546L17.5017%2012.2437C17.4265%2011.964%2017.5928%2011.6769%2017.8738%2011.6017L21.558%2010.6172ZM19.2388%207.22949C19.4445%207.02496%2019.7772%207.02496%2019.983%207.22949L20.0643%207.31205C20.2701%207.51658%2020.2701%207.84802%2020.0643%208.05256L16.9556%2011.1526C16.7498%2011.3571%2016.4171%2011.3571%2016.2113%2011.1526L16.13%2011.0713C15.9242%2010.8655%2015.9242%2010.5341%2016.13%2010.3295L19.2388%207.22949ZM16.0671%205.00177L16.1607%205.01806L16.2728%205.04763C16.5538%205.12279%2016.7201%205.41111%2016.6449%205.6908L15.6567%209.36256C15.5828%209.64226%2015.2932%209.80859%2015.0135%209.73343L14.9014%209.70386C14.6205%209.6287%2014.4541%209.34162%2014.5293%209.06192L15.5175%205.38893C15.5927%205.10924%2015.8798%204.9429%2016.1607%205.01806L16.0671%205.00177Z'%20fill='%23DCA000'/%3e%3c/g%3e%3cdefs%3e%3cclipPath%20id='clip0_597_346'%3e%3crect%20width='18'%20height='18'%20fill='white'%20transform='translate(5%205)'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e");
  }

  .thumbnailContainer a {
    display: inline-block;
    width:  100%;
    height: 100%;
    transition: box-shaow 0.4s ease, transform 0.4s ease;
  }

  .thumbnailContainer a:active {
    box-shadow: 0 0 8px #f99;
    transform: translate(0, 4px);
    transition: none;
  }

  .thumbnailContainer .playlistAppend,
  .playlistRemove,
  .thumbnailContainer .deflistAdd,
  .thumbnailContainer .pocket-info {
    position: absolute;
    display: none;
    color: #fff;
    background: #666;
    width: 24px;
    height: 20px;
    line-height: 18px;
    font-size: 14px;
    box-sizing: border-box;
    text-align: center;
    font-weight: bolder;

    color: #fff;
    cursor: pointer;
  }
  .thumbnailContainer .playlistAppend {
    left: 0;
    bottom: 0;
  }
  .playlistRemove {
    right: 8px;
    top: 0;
  }
  .thumbnailContainer .deflistAdd {
    right: 0;
    bottom: 0;
  }
  .thumbnailContainer .pocket-info {
    display: none !important;
    right: 24px;
    bottom: 0;
  }
  .is-pocketReady .videoItem:hover .pocket-info {
    display: inline-block !important;
  }

  .playlist .playlistAppend {
    display: none !important;
  }
  .playlistRemove {
    display: none;
  }
  .playlist .videoItem:not(.is-active):hover .playlistRemove {
    display: inline-block;
  }


  .playlist .videoItem:not(.is-active):hover .playlistRemove,
  .videoItem:hover .thumbnailContainer .playlistAppend,
  .videoItem:hover .thumbnailContainer .deflistAdd,
  .videoItem:hover .thumbnailContainer .pocket-info {
    display: inline-block;
    border: 1px outset;
  }

  .playlist .videoItem:not(.is-active):hover .playlistRemove:hover,
  .videoItem:hover .thumbnailContainer .playlistAppend:hover,
  .videoItem:hover .thumbnailContainer .deflistAdd:hover,
  .videoItem:hover .thumbnailContainer .pocket-info:hover {
    transform: scale(1.5);
    box-shadow: 2px 2px 2px #000;
  }

  .playlist .videoItem:not(.is-active):hover .playlistRemove:active,
  .videoItem:hover .thumbnailContainer .playlistAppend:active,
  .videoItem:hover .thumbnailContainer .deflistAdd:active,
  .videoItem:hover .thumbnailContainer .pocket-info:active {
    transform: scale(1.3);
    border: 1px inset;
    transition: none;
  }

  .videoItem.is-updating .thumbnailContainer .deflistAdd {
    transform: scale(1.0) !important;
    border: 1px inset !important;
    pointer-events: none;
  }

  .thumbnailContainer .duration {
    position: absolute;
    right: 0;
    bottom: 0;
    background: #000;
    font-size: 12px;
    color: #fff;
  }
  .videoItem:hover .thumbnailContainer .duration {
    display: none;
  }

  .videoInfo {
    height: 100%;
    padding-left: 4px;
  }

  .postedAt {
    font-size: 12px;
    color: #ccc;
  }
  .is-played .postedAt::after {
    content: ' ●';
    font-size: 10px;
  }

  .counter {
    position: absolute;
    top: 80px;
    width: 100%;
    text-align: center;
  }

  .title {
    height: 52px;
    overflow: hidden;
  }

  .videoLink {
    font-size: 14px;
    color: #ff9;
    transition: background 0.4s ease, color 0.4s ease;
  }
  .videoLink:visited {
    color: #ffd;
  }
  .videoLink:active {
    color: #fff;
    background: #663;
    transition: none;
  }


  .noVideoCounter .counter {
    display: none;
  }
  .counter {
    font-size: 12px;
    color: #ccc;
  }
  .counter .value {
    font-weight: bolder;
  }
  .counter .count {
    white-space: nowrap;
  }
  .counter .count + .count {
    margin-left: 8px;
  }

  .videoItem.is-active {
    border: none !important;
    background: #776;
  }

  @media screen and (min-width: 600px)
  {
    #listContainerInner {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    }

    .videoItem {
      margin: 4px 8px 0;
      border-top: none !important;
      border-bottom: 1px dotted var(--item-border-color);
    }
  }
  `;
  }
  static build(item, index = 0) {
    const {html} = dll.lit;
    const {classMap} = dll.directives;

    const addComma = m => isNaN(m) ? '---' : (m.toLocaleString ? m.toLocaleString() : m);
    const {cache, timestamp, index: _index} = this.map.get(item) || {};
    if (cache && timestamp === item.timestamp && index === _index) {
      return cache;
    }
    const title = item.title;
    const count = item.count;
    const itemId = item.itemId;
    const watchId = item.watchId;
    const watchUrl = `https://www.nicovideo.jp/watch/${watchId}`;
    const cmap = ({
      'videoItem': true,
      [`watch${watchId}`]: true,
      [`item${itemId}`]: true,
      [item.isLazy     ? 'is-lazy-load' : 'is-inview'] : true,
      'is-active':        item.isActive,
      'is-updating':      item.isUpdating,
      'is-played':        item.isPlayed,
      'is-dragging':      item.isDragging,
      'is-dragover':      item.isDragover,
      'is-drropped':      item.isDropped,
      'is-favorited':      item.isFavorited,
      'is-not-resolved': !item.isPocketResolved,
      'is-adDecoration-gold':   item.adDecoration === 'gold',
      'is-adDecoration-silver': item.adDecoration === 'silver'
    });
    // const className = `videoItem watch${watchId} item${itemId}`;
    const thumbnailStyle = `background-image: url(${item.thumbnail})`;

    const result = html`
      <div class=${classMap(cmap)} data-index=${index + 1} data-item-id=${itemId} data-watch-id=${watchId}>
        ${item.isLazy ? '' : html`
          <span class="command playlistRemove" data-command="playlistRemove" data-param=${watchId} title="プレイリストから削除">×</span>
          <div class="thumbnailContainer" style=${thumbnailStyle} data-watch-id=${watchId} data-src=${item.thumbnail}>
            <a class="command" href=${watchUrl} data-command="select" data-param=${itemId}>
              <span class="duration">${textUtil.secToTime(item.duration)}</span>
            </a>
            <span class="command playlistAppend" data-command="playlistAppend" data-param=${watchId} title="プレイリストに追加">▶</span>
            <span class="command deflistAdd"  data-command="deflistAdd" data-param=${watchId} title="とりあえずマイリスト">&#x271A;</span>
            <span class="command pocket-info" data-command="pocket-info" data-param=${watchId} title="動画情報">？</span>
          </div>
          <div class="videoInfo">
            <div class="postedAt">${new Date(item.postedAt).toLocaleString()}</div>
            <div class="title">
              <a class="command videoLink"
                href=${watchUrl} data-command="select" data-param=${itemId} title=${title}>${title}</a>
            </div>
          </div>
          <div class="counter">
            <span class="count">再生: <span class="value viewCount">${addComma(count.view)}</span></span>
            <span class="count">コメ: <span class="value commentCount">${addComma(count.comment)}</span></span>
            <span class="count">マイ: <span class="value mylistCount">${addComma(count.mylist)}</span></span>
          </div>
        `}
      </div>`;
      this.map.set(item, {cache: result, timestamp: item.timestamp, index});
      return result;
  }
}
VideoListItemView.map = new WeakMap;



//===END===

export {VideoListItemView};