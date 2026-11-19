import {GateAPI} from '../packages/lib/src/nico/GateAPI';
import {AntiPrototypeJs} from '../packages/lib/src/infra/AntiPrototype-js';

//===BEGIN===

const boot = async (monkey, PRODUCT, START_PAGE_QUERY, pageRealm = false) => {
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
    let startup;
    await AntiPrototypeJs();
    if (window.ZenzaLib) {
      window.ZenzaJQuery = window.ZenzaLib.$;
      // Runs in the injected page before the notification journal is necessarily available.
      const reportStartupFailure = () => {
        if (location.host === 'www.nicovideo.jp') {
          console.warn('[ZenzaWatch] 起動診断：プレイヤー本体の初期化に失敗しました。');
        }
      };
      const runDirectly = () => {
        // Strict external-site CSP (notably Google Search) can block blob:
        // script injection. Try the extension's own execution realm instead.
        if (window.ZenzaWatch) { return; }
        return Promise.resolve()
          .then(() => monkey(PRODUCT, encodeURIComponent(START_PAGE_QUERY)))
          .catch(err => {
            if (host === 'www.nicovideo.jp') {
              reportStartupFailure();
              if (pageRealm) {
                // The page journal can attribute the rejection without retaining the original message or URL.
                const failure = new Error('ZenzaWatch player initialization failed');
                failure.name = 'ZenzaWatchStartupError';
                const frame = typeof err?.stack === 'string' && /\n[^\n]*?\b(ZenzaWatch(?:Runtime|Main)\.js:\d+:\d+)\)?(?:\n|$)/.exec(err.stack);
                if (frame) failure.stack = failure.name + ': ' + failure.message + '\n    at startup (' + frame[1] + ')';
                throw failure;
              }
            } else { console.warn('ZenzaWatch direct bootstrap unavailable', err?.message || err); }
          });
      };
      if (pageRealm && host === 'www.nicovideo.jp') {
        // The outer userscript already injected this runtime into the unprivileged page.
        startup = runDirectly();
      } else {
        const blob = new Blob([
          // Task1059: 名前を付けて、ZenzaWatch 自身のエラーを見分けられるようにする（以前は UUID の名前だった）。
          `(${monkey})(${JSON.stringify(PRODUCT)}, ${JSON.stringify(encodeURIComponent(START_PAGE_QUERY))}).catch(error => { (${reportStartupFailure})(); throw error; });\n//# sourceURL=ZenzaWatchMain.js`
        ], {type: 'text/javascript'});
        const src = URL.createObjectURL(blob);
        const handler = () => {
          URL.revokeObjectURL(src);
          script.remove();
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
    }
//@require ../packages/lib/src/nico/modernLazyload.js
    return startup;
  }
};


//===END===


export {boot};
