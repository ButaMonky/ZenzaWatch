// Task950: small, standalone video cards for MylistPocket description links.
// Shares ZenzaWatch's existing ThumbInfo/AdDecoration APIs but has no lit/DLL dependency.
//===BEGIN===
const PocketDescriptionCard = (() => {
  const MAX_CONCURRENT = 3;
  // Untrusted description HTML may contain lookalike class/data attributes.
  // Only upgrade card elements that this module created itself.
  const ownedCards = new WeakSet();
  const safeId = id => typeof id === 'string' &&
    /^(?:(?:sm|nm|so|ss)\d{1,16}|\d{1,16})$/.test(id);
  const formatCount = value => {
    const n = Number(value);
    if (value == null || !Number.isFinite(n) || n < 0) { return '不明'; }
    if (n >= 1e8) { return String(Math.floor(n / 1e7) / 10) + '億'; }
    if (n >= 1e4) { return String(Math.floor(n / 1e3) / 10) + '万'; }
    return n.toLocaleString('ja-JP');
  };
  const formatDuration = seconds => {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n < 0) { return ''; }
    const t = Math.floor(n), min = Math.floor(t / 60);
    return min + ':' + String(t % 60).padStart(2, '0');
  };
  const CSS = [
    '#mylistPocket-popup .mpp-video-card { display:grid; grid-template-columns:100px minmax(0,1fr); grid-template-rows:auto; column-gap:9px; align-items:start; min-height:84px; margin:8px 0; padding:5px; background:#303035; border:1px solid #56565c; border-radius:4px; line-height:1.3; color:#ddd; box-sizing:border-box; }',
    '#mylistPocket-popup .mpp-video-card:hover { background:#393942; }',
    // The optional MylistPocket NG/favorite observer decorates these cards.
    // Old .item/.VideoItem styles do not match the new card container.
    '#mylistPocket-popup .mpp-video-card.is-ng-wait { outline:1px dotted rgba(192,192,192,.8); }',
    '#mylistPocket-popup .mpp-video-card.is-ng-queue { outline:2px dotted rgba(192,192,192,.8); }',
    '#mylistPocket-popup .mpp-video-card.is-ng-current { outline:3px dotted rgba(128,225,128,.8); }',
    '#mylistPocket-popup .mpp-video-card.is-ng-resolved { outline:0 solid green; }',
    '#mylistPocket-popup .mpp-video-card.is-fav-favorited { outline:3px dotted orange; outline-offset:3px; }',
    '#mylistPocket-popup .mpp-video-card.is-ng-rejected { display:none; }',
    // The legacy NG-OFF stylesheet uses display:block!important. Preserve the
    // new card's two-column grid instead of reverting it to a stacked block.
    'body.is-ng-disable #mylistPocket-popup .mpp-video-card.is-ng-rejected { display:grid!important; opacity:.5; pointer-events:auto; visibility:visible; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-thumb { position:relative; width:96px; height:72px; display:block; margin:0; padding:0; border:0; overflow:hidden; background:#151515; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-thumb img { display:block; width:96px; height:72px; object-fit:contain; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-duration { position:absolute; right:0; bottom:0; background:#000b; color:#fff; padding:1px 3px; font-size:11px; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-body { min-width:0; display:flex; flex-direction:column; gap:4px; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-title { color:#f4f3e9; font-size:13px; font-weight:bold; overflow-wrap:anywhere; text-decoration:none; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-title:hover { text-decoration:underline; color:#fff; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-meta { font-size:11px; color:#aaa; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-counters { font-size:11px; color:#bbb; display:flex; flex-wrap:wrap; gap:1px 8px; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-actions { display:flex; align-items:center; gap:7px; min-width:0; margin-top:auto; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-owner { display:flex; align-items:center; gap:5px; min-width:0; flex:1 1 auto; color:#c6c8cb; text-decoration:none; font-size:11px; line-height:20px; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-owner[href]:hover { color:#f8f8f8; text-decoration:underline; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-owner-icon { width:20px; height:20px; border-radius:50%; object-fit:cover; flex:none; background:#444; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-owner-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-info { margin-left:auto; flex:0 0 auto; white-space:nowrap; border:1px solid #777; background:#444; padding:2px 5px; color:#fff; cursor:pointer; font-size:11px; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-info:hover { background:#666; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-state { font-size:10px; color:#aab; }',
    '#mylistPocket-popup .mpp-video-card .mpp-card-state:empty { display:none; }',
    '#mylistPocket-popup .mpp-video-card.is-failed .mpp-card-state { color:#dbb; }',
    '#mylistPocket-popup .mpp-video-card.is-adDecoration-gold .mpp-card-thumb:after, #mylistPocket-popup .mpp-video-card.is-adDecoration-silver .mpp-card-thumb:after { content:""; position:absolute; top:0; left:0; width:22px; height:22px; z-index:1; background-size:contain; pointer-events:none; }',
    "#mylistPocket-popup .mpp-video-card.is-adDecoration-gold .mpp-card-thumb:after { background-image:url(\"data:image/svg+xml,%3csvg%20width='50'%20height='50'%20viewBox='0%200%2050%2050'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M48.9979%200H3.00073H1.00024C0.448108%200%200%200.448108%200%201.00024V3.00073V48.9979C0%2049.8911%201.08126%2050.3362%201.71041%2049.702L3.7109%2047.6855C3.89694%2047.4975%204.00097%2047.2444%204.00097%2046.9814V40.0097L40.0097%204.00097H46.9814C47.2454%204.00097%2047.4985%203.89694%2047.6855%203.7109L49.702%201.71041C50.3362%201.08126%2049.8911%200%2048.9979%200Z'%20fill='%23FFD700'/%3e%3cg%20clip-path='url(%23clip0_597_346)'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M10.6963%205.59039C11.2495%205.04209%2012.4718%205.27496%2013.9554%206.08324L13.7742%207.09236C13.0017%206.72641%2012.4028%206.64263%2012.1231%206.92109C11.4725%207.57042%2012.7897%209.93858%2015.0717%2012.2119C17.3524%2014.4839%2019.7293%2015.8011%2020.3811%2015.1505C20.662%2014.8794%2020.5758%2014.2745%2020.2086%2013.5044L21.2141%2013.3245C22.0261%2014.8055%2022.2602%2016.0204%2021.7106%2016.5699C21.5862%2016.687%2021.4321%2016.7695%2021.2658%2016.8102L21.267%2016.8127L9.91263%2019.8486L9.34337%2021.9679C9.32858%2022.032%209.29654%2022.0911%209.24972%2022.1392C8.86405%2022.515%207.63435%2021.9051%206.4909%2020.7641C5.34745%2019.6219%204.7326%2018.3935%205.11211%2018.014C5.16016%2017.9684%205.21931%2017.9364%205.28461%2017.9216L7.4101%2017.3536L10.4499%206.03395C10.4917%205.86638%2010.5768%205.7136%2010.6963%205.59039ZM21.558%2010.6172C21.8389%2010.5421%2022.1272%2010.7084%2022.2024%2010.9881L22.2319%2011.099C22.3071%2011.3787%2022.1408%2011.6658%2021.8598%2011.7409L18.1757%2012.7254C17.8947%2012.8006%2017.6076%2012.6342%2017.5312%2012.3546L17.5017%2012.2437C17.4265%2011.964%2017.5928%2011.6769%2017.8738%2011.6017L21.558%2010.6172ZM19.2388%207.22949C19.4445%207.02496%2019.7772%207.02496%2019.983%207.22949L20.0643%207.31205C20.2701%207.51658%2020.2701%207.84802%2020.0643%208.05256L16.9556%2011.1526C16.7498%2011.3571%2016.4171%2011.3571%2016.2113%2011.1526L16.13%2011.0713C15.9242%2010.8655%2015.9242%2010.5341%2016.13%2010.3295L19.2388%207.22949ZM16.0671%205.00177L16.1607%205.01806L16.2728%205.04763C16.5538%205.12279%2016.7201%205.41111%2016.6449%205.6908L15.6567%209.36256C15.5828%209.64226%2015.2932%209.80859%2015.0135%209.73343L14.9014%209.70386C14.6205%209.6287%2014.4541%209.34162%2014.5293%209.06192L15.5175%205.38893C15.5927%205.10924%2015.8798%204.9429%2016.1607%205.01806L16.0671%205.00177Z'%20fill='%23DCA000'/%3e%3c/g%3e%3cdefs%3e%3cclipPath%20id='clip0_597_346'%3e%3crect%20width='18'%20height='18'%20fill='white'%20transform='translate(5%205)'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e\"); }",
    "#mylistPocket-popup .mpp-video-card.is-adDecoration-silver .mpp-card-thumb:after { background-image:url(\"data:image/svg+xml,%3csvg%20width='50'%20height='50'%20viewBox='0%200%2050%2050'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M48.9979%200H3.00073H1.00024C0.448108%200%200%200.448108%200%201.00024V3.00073V48.9979C0%2049.8911%201.08126%2050.3362%201.71041%2049.702L3.7109%2047.6855C3.89694%2047.4975%204.00097%2047.2444%204.00097%2046.9814V40.0097L40.0097%204.00097H46.9814C47.2454%204.00097%2047.4985%203.89694%2047.6855%203.7109L49.702%201.71041C50.3362%201.08126%2049.8911%200%2048.9979%200Z'%20fill='%23BEC8C8'/%3e%3cg%20clip-path='url(%23clip0_597_345)'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M10.6963%205.59039C11.2495%205.04209%2012.4718%205.27496%2013.9554%206.08324L13.7742%207.09236C13.0017%206.72641%2012.4028%206.64263%2012.1231%206.92109C11.4725%207.57042%2012.7897%209.93858%2015.0717%2012.2119C17.3524%2014.4839%2019.7293%2015.8011%2020.3811%2015.1505C20.662%2014.8794%2020.5758%2014.2745%2020.2086%2013.5044L21.2141%2013.3245C22.0261%2014.8055%2022.2602%2016.0204%2021.7106%2016.5699C21.5862%2016.687%2021.4321%2016.7695%2021.2658%2016.8102L21.267%2016.8127L9.91263%2019.8486L9.34337%2021.9679C9.32858%2022.032%209.29654%2022.0911%209.24972%2022.1392C8.86405%2022.515%207.63435%2021.9051%206.4909%2020.7641C5.34745%2019.6219%204.7326%2018.3935%205.11211%2018.014C5.16016%2017.9684%205.21931%2017.9364%205.28461%2017.9216L7.4101%2017.3536L10.4499%206.03395C10.4917%205.86638%2010.5768%205.7136%2010.6963%205.59039ZM21.558%2010.6172C21.8389%2010.5421%2022.1272%2010.7084%2022.2024%2010.9881L22.2319%2011.099C22.3071%2011.3787%2022.1408%2011.6658%2021.8598%2011.7409L18.1757%2012.7254C17.8947%2012.8006%2017.6076%2012.6342%2017.5312%2012.3546L17.5017%2012.2437C17.4265%2011.964%2017.5928%2011.6769%2017.8738%2011.6017L21.558%2010.6172ZM19.2388%207.22949C19.4445%207.02496%2019.7772%207.02496%2019.983%207.22949L20.0643%207.31205C20.2701%207.51658%2020.2701%207.84802%2020.0643%208.05256L16.9556%2011.1526C16.7498%2011.3571%2016.4171%2011.3571%2016.2113%2011.1526L16.13%2011.0713C15.9242%2010.8655%2015.9242%2010.5341%2016.13%2010.3295L19.2388%207.22949ZM16.0671%205.00177L16.1607%205.01806L16.2728%205.04763C16.5538%205.12279%2016.7201%205.41111%2016.6449%205.6908L15.6567%209.36256C15.5828%209.64226%2015.2932%209.80859%2015.0135%209.73343L14.9014%209.70386C14.6205%209.6287%2014.4541%209.34162%2014.5293%209.06192L15.5175%205.38893C15.5927%205.10924%2015.8798%204.9429%2016.1607%205.01806L16.0671%205.00177Z'%20fill='%23889C9C'/%3e%3c/g%3e%3cdefs%3e%3cclipPath%20id='clip0_597_345'%3e%3crect%20width='18'%20height='18'%20fill='white'%20transform='translate(5%205)'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e\"); }"
  ].join('\n');
  // A popup may open before ZenzaWatch finishes loading. Upgrade the
  // already-visible card links once the bridge becomes available, without
  // rebuilding cards or losing fetched metadata/crown decorations.
  const enableZenzaLinks = container => {
    if (!container || typeof container.querySelectorAll !== 'function') { return 0; }
    const cards = container.classList?.contains('mpp-video-card') ?
      [container] : Array.from(container.querySelectorAll('.mpp-video-card'));
    let enabled = 0;
    for (const card of cards) {
      if (!ownedCards.has(card)) { continue; }
      const watchId = card.dataset && card.dataset.watchId;
      if (!safeId(watchId)) { continue; }
      for (const link of card.querySelectorAll('a.mpp-card-thumb, a.mpp-card-title')) {
        link.classList.add('command', 'noHoverMenu');
        link.dataset.command = 'zenza-open';
        link.dataset.param = watchId;
      }
      enabled++;
    }
    return enabled;
  };
  const make = (document, watchId, url, originalLabel, useZenza) => {
    if (!safeId(watchId) || !/^https:\/\/www\.nicovideo\.jp\/(?:watch|shorts)\//.test(url)) { return null; }
    const node = tag => document.createElement(tag);
    const root = node('div');
    root.className = 'mpp-video-card';
    root.dataset.watchId = watchId;
    ownedCards.add(root);
    const thumb = node('a');
    thumb.className = 'mpp-card-thumb';
    thumb.href = url;
    thumb.setAttribute('aria-label', originalLabel || watchId);
    const image = node('img');
    image.alt = '';
    image.loading = 'lazy';
    thumb.append(image);
    const duration = node('span');
    duration.className = 'mpp-card-duration';
    thumb.append(duration);
    const body = node('div');
    body.className = 'mpp-card-body';
    const title = node('a');
    title.className = 'mpp-card-title';
    title.textContent = originalLabel || watchId;
    title.title = originalLabel || watchId;
    title.href = url;
    const meta = node('span'); meta.className = 'mpp-card-meta';
    const counters = node('span'); counters.className = 'mpp-card-counters';
    const actions = node('div'); actions.className = 'mpp-card-actions';
    const ownerLink = node('a'); ownerLink.className = 'mpp-card-owner';
    const ownerIcon = node('img'); ownerIcon.className = 'mpp-card-owner-icon';
    ownerIcon.alt = ''; ownerIcon.loading = 'lazy';
    // The poster image fallback is installed by showOwner(), which has the
    // verified owner ID. It must never create an unbounded error loop.
    const ownerName = node('span'); ownerName.className = 'mpp-card-owner-name';
    ownerName.textContent = '投稿者を確認中…';
    ownerLink.append(ownerIcon, ownerName);
    const infoButton = node('button');
    infoButton.type = 'button';
    infoButton.className = 'command mpp-card-info';
    infoButton.dataset.command = 'info';
    infoButton.dataset.param = watchId;
    infoButton.textContent = '動画情報';
    const state = node('span'); state.className = 'mpp-card-state';
    state.textContent = '取得中…';
    actions.append(ownerLink, infoButton);
    body.append(title, meta, counters, state, actions);
    root.append(thumb, body);
    if (useZenza) { enableZenzaLinks(root); }
    return {root, image, title, thumb, duration, meta, counters,
      ownerLink, ownerIcon, ownerName, infoButton, state, watchId};
  };
  const BLANK_ICON = 'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank.jpg';
  const isBlank = icon => !icon || /\/defaults\/blank(?:_s)?\.jpg/i.test(icon);
  const validIcon = icon => typeof icon === 'string' && /^https?:\/\//i.test(icon) ?
    icon.replace(/^http:/i, 'https:') : BLANK_ICON;
  // NICO-OWNER-ICON-20260923: public CDN's 50px image for an already
  // confirmed user ID. Do not infer that a successful image is the profile's
  // historical avatar, or treat an HTTP404 as proof that it was deleted.
  const userCdnIcon = owner => {
    const id = String(owner?.id ?? '');
    if (owner?.type !== 'user' || !/^[1-9]\d{0,17}$/.test(id)) {
      return null;
    }
    const bucket = id.length > 4 ? id.slice(0, -4) : '0';
    return `https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/s/${bucket}/${id}.jpg`;
  };
  const selectIconSources = owner => {
    const primary = validIcon(owner?.icon || owner?.iconUrl);
    const derived = userCdnIcon(owner);
    const sources = [];
    if (!isBlank(primary)) { sources.push(primary); }
    if (derived && !sources.includes(derived)) { sources.push(derived); }
    sources.push(BLANK_ICON);
    return sources;
  };
  const showOwner = (card, owner) => {
    if (!card || !card.ownerLink) { return; }
    const label = typeof owner?.name === 'string' && owner.name.trim() ?
      owner.name.trim() : '(投稿者情報なし)';
    const type = owner?.type;
    const rawId = String(owner?.id ?? '');
    const id = type === 'channel' ? rawId.replace(/^ch/, '') : rawId;
    const valid = /^\d{1,18}$/.test(id) &&
      (type === 'user' || type === 'channel');
    card.ownerName.textContent = label;
    card.ownerName.title = label;
    if (valid) {
      card.ownerLink.href = type === 'user' ?
        `https://www.nicovideo.jp/user/${id}` :
        `https://ch.nicovideo.jp/ch${id}`;
      card.ownerLink.target = '_blank';
      card.ownerLink.rel = 'noopener noreferrer';
      card.ownerLink.title = '投稿者ページ: ' + label;
    } else {
      card.ownerLink.removeAttribute('href');
      card.ownerLink.removeAttribute('target');
      card.ownerLink.removeAttribute('title');
    }
    // Primary/API images win. Only when missing or unreadable do we try one
    // CDN candidate for a validated user ID, then the blank fallback.
    // All candidate URLs are derived from public metadata, not arbitrary text.
    const img = card.ownerIcon;
    const sources = selectIconSources(owner);
    let index = 0;
    img.onerror = () => {
      if (index + 1 >= sources.length) {
        img.onerror = null;
        img.removeAttribute('src');
        return;
      }
      img.src = sources[++index];
    };
    img.src = sources[0];
  };
  const applyExtra = (card, extra) => {
    if (!card || !extra || typeof extra !== 'object') { return false; }
    if (typeof extra.likeCount === 'number' &&
        Number.isSafeInteger(extra.likeCount) && extra.likeCount >= 0 &&
        card.likeCell) {
      card.likeCell.textContent = 'いいね: ' + formatCount(extra.likeCount);
      card.likeCell.title = 'いいね: ' + extra.likeCount.toLocaleString('ja-JP');
    }
    // getthumbinfo + OwnerSupplement remains authoritative when it resolved
    // a real uploader. Use nvapi only for placeholders and blank avatars.
    const previous = card.info?.owner;
    const isMissing = !previous?.id ||
      ['(投稿者情報なし)', '(非公開ユーザー)'].includes(previous?.name);
    const alreadyLinked = card.ownerLink?.hasAttribute('href');
    if (extra.owner && ((isMissing && !alreadyLinked) || (
      !isMissing && String(previous.id) === String(extra.owner.id) &&
      isBlank(previous.icon || previous.iconUrl)))) {
      showOwner(card, isMissing ? extra.owner : {
        ...previous, icon:extra.owner.icon || previous.icon
      });
    }
    return true;
  };
  const applyInfo = (card, info, {installImage, isCurrent} = {}) => {
    if (!card || !info || info.status !== 'ok') { return false; }
    if (typeof info.title === 'string' && info.title) {
      card.title.textContent = info.title;
      card.title.title = info.title;
    }
    if (info.postedAt) { card.meta.textContent = String(info.postedAt); }
    card.duration.textContent = formatDuration(info.duration);
    const cells = [['再生', info.viewCount], ['コメ', info.commentCount],
      ['マイ', info.mylistCount], ['いいね', info.likeCount]];
    card.counters.replaceChildren();
    for (const [label, val] of cells) {
      const item = card.root.ownerDocument.createElement('span');
      item.textContent = label + ': ' + formatCount(val);
      if (val !== null && val !== undefined && Number.isFinite(Number(val))) {
        item.title = label + ': ' + Number(val).toLocaleString('ja-JP');
      }
      card.counters.append(item);
      if (label === 'いいね') { card.likeCell = item; }
    }
    showOwner(card, info.owner);
    if (typeof installImage === 'function' && info.thumbnail) {
      installImage(card.image, info.thumbnail, isCurrent, info);
    }
    card.state.textContent = '';
    card.root.classList.remove('is-failed');
    return true;
  };
  const applyDecoration = (card, decoration) => {
    if (!card) { return; }
    card.root.classList.toggle('is-adDecoration-gold', decoration === 'gold');
    card.root.classList.toggle('is-adDecoration-silver', decoration === 'silver');
  };
  const hydrate = async (cards, {loadInfo, loadDecoration, loadExtra, installImage, isCurrent}) => {
    const safeCards = (cards || []).filter(card => card && safeId(card.watchId));
    if (!safeCards.length || !isCurrent()) { return; }
    let cursor = 0;
    const worker = async () => {
      while (cursor < safeCards.length && isCurrent()) {
        const card = safeCards[cursor++];
        try {
          const info = await loadInfo(card.watchId);
          if (!isCurrent() || !card.root.isConnected) { continue; }
          if (!applyInfo(card, info, {
            installImage, isCurrent: () => isCurrent() && card.root.isConnected
          })) {
            card.root.classList.add('is-failed');
            card.state.textContent = '動画情報を取得できません';
            continue;
          }
          card.info = info;
        } catch (_) {
          if (isCurrent() && card.root.isConnected) {
            card.root.classList.add('is-failed');
            card.state.textContent = '詳細情報を取得できません';
          }
        }
      }
    };
    await Promise.all(Array.from({length: Math.min(MAX_CONCURRENT, safeCards.length)}, () => worker()));
    if (!isCurrent()) { return; }
    const valid = safeCards.filter(card => card.info && card.info.status === 'ok' && card.root.isConnected);
    if (!valid.length) { return; }
    // Always query canonical video IDs, not alias/thread IDs.
    const idOf = card => safeId(card.info.videoId) ? card.info.videoId :
      safeId(card.info.id) ? card.info.id : card.watchId;
    const tasks = [];
    if (typeof loadDecoration === 'function') {
      tasks.push((async () => {
        const ids = [...new Set(valid.map(idOf))];
        try {
          const grades = await loadDecoration(ids);
          if (!isCurrent() || !(grades && typeof grades.get === 'function')) { return; }
          for (const card of valid) {
            if (card.root.isConnected) { applyDecoration(card, grades.get(idOf(card))); }
          }
        } catch (_) {
          // Unknown decoration must never be presented as API-confirmed normal.
        }
      })());
    }
    if (typeof loadExtra === 'function') {
      // The additional nvapi lookup is independent of the first thumbInfo
      // render and the NicoAd batch. Never flood it for a long description.
      let index = 0;
      const extraWorker = async () => {
        while (index < valid.length && isCurrent()) {
          const card = valid[index++];
          try {
            const extra = await loadExtra(idOf(card));
            if (isCurrent() && card.root.isConnected) { applyExtra(card, extra); }
          } catch (_) {
            // Like count is unknown; keep the poster from ThumbInfo/OwnerSupplement.
          }
        }
      };
      tasks.push(Promise.all(Array.from({
        length:Math.min(MAX_CONCURRENT, valid.length)
      }, () => extraWorker())));
    }
    await Promise.all(tasks);
  };
  return {CSS, make, enableZenzaLinks, applyInfo, applyExtra,
    showOwner, userCdnIcon, selectIconSources, applyDecoration, hydrate,
    formatCount, formatDuration};
})();
//===END===
export {PocketDescriptionCard};
