import {GateAPI} from '../packages/lib/src/nico/GateAPI';
import {AntiPrototypeJs} from '../packages/lib/src/infra/AntiPrototype-js';

//===BEGIN===

const boot = async (monkey, PRODUCT, START_PAGE_QUERY) => {
  if (window.ZenzaWatch) {
    return;
  }
  const document = window.document;
  const host = window.location.host || '';
  const name = window.name || '';
  const href = (location.href || '').replace(/#.*$/, '');
  if (href === 'https://www.nicovideo.jp/robots.txt' &&
    name.startsWith(`nicovideoApi${PRODUCT}Loader`)) {
    GateAPI.nicovideo();
  } else if (host.match(/^smile-.*?\.nicovideo\.jp$/)) {
    GateAPI.smile();
  } else if (host === 'snapshot.search.nicovideo.jp' && name.startsWith(`searchApi${PRODUCT}Loader`)) {
    GateAPI.search();
  } else if (host === 'ext.nicovideo.jp' && name.startsWith(`thumbInfo${PRODUCT}Loader`)) {
    GateAPI.thumbInfo();
  } else if (host === 'dic.nicovideo.jp' && name.startsWith(`nicodic${PRODUCT}Loader`)) {
    // タグの大百科記事の有無を調べるための隠しiframe（Task 044）。
    // NicodicArticleLoaderが開く。通常の大百科の閲覧時は
    // window.nameが一致しないのでここには来ない。
    GateAPI.nicodic();
  } else if (window === window.top) {
    await AntiPrototypeJs();
    if (window.ZenzaLib) {
      window.ZenzaJQuery = window.ZenzaLib.$;
      // Runs in the injected page before the notification journal is necessarily available.
      const reportStartupFailure = () => {
        if (location.host === 'www.nicovideo.jp') {
          console.warn('[ZenzaWatch] 起動診断：プレイヤー本体の初期化に失敗しました。');
        }
      };
      const blob = new Blob([
        // Task1059: 名前を付けて、ZenzaWatch 自身のエラーを見分けられるようにする（以前は UUID の名前だった）。
        `(${monkey})(${JSON.stringify(PRODUCT)}, ${JSON.stringify(encodeURIComponent(START_PAGE_QUERY))}).catch(error => { (${reportStartupFailure})(); throw error; });\n//# sourceURL=ZenzaWatchMain.js`
      ], {type: 'text/javascript'});
      const src = URL.createObjectURL(blob);
      const handler = () => {
        URL.revokeObjectURL(src);
        script.remove();
      };
      const runDirectly = () => {
        // Strict external-site CSP (notably Google Search) can block blob:
        // script injection. Try the extension's own execution realm instead.
        if (window.ZenzaWatch) { return; }
        Promise.resolve()
          .then(() => monkey(PRODUCT, encodeURIComponent(START_PAGE_QUERY)))
          .catch(err => {
            if (host === 'www.nicovideo.jp') { reportStartupFailure(); }
            else { console.warn('ZenzaWatch direct bootstrap unavailable', err?.message || err); }
          });
      };
      const script = Object.assign(document.createElement('script'), {
        id: `${PRODUCT}Loader`,
        type: 'text/javascript',
        src,
        onload: handler,
        onerror: () => {
          handler();
          runDirectly();
        }
      });
      try {
        document.head.append(script);
      } catch (_) {
        handler();
        runDirectly();
      }
    }
//@require ../packages/lib/src/nico/modernLazyload.js
  }
};


//===END===


export {boot};
