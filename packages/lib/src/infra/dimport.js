// GENERATED FROM tools/typescript-stage1/nico-src/dimport.ts (Task726). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const dimport = (() => {
    try { // google先生の真似
        return new Function('u', 'return import(u)');
    }
    catch (e) {
        const map = {};
        let count = 0;
        return (url) => {
            if (map[url]) {
                return map[url];
            }
            try {
                const now = Date.now();
                const callbackName = `dimport_${now}_${count++}`;
                // `${'import'}` keeps the generated line from starting with `import`, which the
                // generator rejects as a stray ES import; the string value is unchanged.
                const loader = `
          ${'import'} * as module${now} from "${url}";
          console.log('%cdynamic import from "${url}"',
            'font-weight: bold; background: #333; color: #ff9; display: block; padding: 4px; width: 100%;');
          window.${callbackName}(module${now});
          `.trim();
                window.console.time(`"${url}" import time`);
                const p = new Promise((ok, ng) => {
                    const s = document.createElement('script');
                    s.type = 'module';
                    s.onerror = ng;
                    s.append(loader);
                    s.dataset.import = url;
                    window[callbackName] = (module) => {
                        window.console.timeEnd(`"${url}" import time`);
                        ok(module);
                        delete window[callbackName];
                    };
                    document.head.append(s);
                });
                map[url] = p;
                return p;
            }
            catch (e) {
                console.warn(url, e);
                return Promise.reject(e);
            }
        };
    }
})();
//===END===
export {dimport};
