// GENERATED FROM tools/typescript-stage1/nico-src/AntiPrototypeJs.ts (Task726). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const AntiPrototypeJs = function () {
    if (this.promise !== null || !window.Prototype || window.PureArray) {
        return this.promise || Promise.resolve(window.PureArray || window.Array);
    }
    if (document.getElementsByClassName.toString().indexOf('B,A') >= 0) {
        // console.info('%cI don\'t like prototype.js 1.5.x', 'font-family: "Arial Black";');
        delete document.getElementsByClassName;
    }
    const waitForDom = new Promise(resolve => {
        if (['interactive', 'complete'].includes(document.readyState)) {
            return resolve(undefined);
        }
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
    const f = Object.assign(document.createElement('iframe'), {
        srcdoc: '<html><title>ここだけ時間が10年遅れてるスレ</title></html>',
        id: 'prototype',
        loading: 'eager'
    });
    Object.assign(f.style, { position: 'absolute', left: '-100vw', top: '-100vh' });
    return this.promise = waitForDom
        .then(() => new Promise(res => {
        f.onload = res;
        document.body.append(f);
    })).then(() => {
        window.PureArray = f.contentWindow.Array;
        delete window.Array.prototype.toJSON;
        delete window.String.prototype.toJSON;
        // 副作用あるかも？
        f.remove();
        return Promise.resolve(window.PureArray);
    }).catch(err => console.error(err));
}.bind({ promise: null });
//===END===
export {
  AntiPrototypeJs
};
