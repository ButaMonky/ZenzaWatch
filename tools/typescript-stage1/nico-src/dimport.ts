/**
 * Canonical TypeScript source for packages/lib/src/infra/dimport.js (Task726).
 * Dynamic `import()` that survives environments where `import` cannot be compiled
 * in a Function; falls back to injecting a module <script>.
 */
export type ModuleLoader = (url: string) => Promise<unknown>;
type CallbackHost = Record<string, unknown>;

const dimport = ((): ModuleLoader => {
  try { // google先生の真似
    return new Function('u', 'return import(u)') as ModuleLoader;
  } catch(e) {
    const map: Record<string, Promise<unknown>> = {};
    let count = 0;
    return (url: string) => {
      if (map[url]) {
        return map[url] as Promise<unknown>;
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
        const p = new Promise<unknown>((ok, ng) => {
          const s = document.createElement('script');
          s.type = 'module';
          s.onerror = ng;
          s.append(loader);
          s.dataset.import = url;
          (window as unknown as CallbackHost)[callbackName] = (module: unknown) => {
            window.console.timeEnd(`"${url}" import time`);
            ok(module);
            delete (window as unknown as CallbackHost)[callbackName];
          };
          document.head.append(s);
        });
        map[url] = p;
        return p;
      } catch (e) {
        console.warn(url, e);
        return Promise.reject(e);
      }
    };
  }
})();

export {dimport};
