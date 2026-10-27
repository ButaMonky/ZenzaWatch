/**
 * Canonical TypeScript source for packages/lib/src/infra/AntiPrototype-js.js (Task726).
 * On pages polluted by prototype.js, borrows a clean Array from a blank iframe
 * (window.PureArray) and removes Array/String#toJSON. Runs once (bound state).
 */
type PureWindow = {Prototype?: unknown; PureArray?: ArrayConstructor};
type ToJsonSlot = {toJSON?: unknown};

const AntiPrototypeJs = function(this: {promise: Promise<unknown> | null}): Promise<unknown> {
  if (this.promise !== null || !(window as unknown as PureWindow).Prototype || (window as unknown as PureWindow).PureArray) {
    return this.promise || Promise.resolve((window as unknown as PureWindow).PureArray || window.Array);
  }
  if (document.getElementsByClassName.toString().indexOf('B,A') >= 0) {
    // console.info('%cI don\'t like prototype.js 1.5.x', 'font-family: "Arial Black";');
    delete (document as unknown as {getElementsByClassName?: unknown}).getElementsByClassName;
  }

  const waitForDom = new Promise<unknown>(resolve => {
    if (['interactive', 'complete'].includes(document.readyState)) {
      return resolve(undefined);
    }
    document.addEventListener('DOMContentLoaded', resolve, {once: true});
  });

  const f = Object.assign(document.createElement('iframe'), {
    srcdoc: '<html><title>ここだけ時間が10年遅れてるスレ</title></html>',
    id: 'prototype',
    loading: 'eager'
  });
  Object.assign(f.style, {position: 'absolute', left: '-100vw', top: '-100vh'});
  return this.promise = waitForDom
    .then(() => new Promise(res => {
      f.onload = res;
      document.body.append(f);
    })).then(() => {
      (window as unknown as PureWindow).PureArray = (f.contentWindow as unknown as {Array: ArrayConstructor}).Array;
      delete (window.Array.prototype as ToJsonSlot).toJSON;
      delete (window.String.prototype as ToJsonSlot).toJSON;
      // 副作用あるかも？
      f.remove();
      return Promise.resolve((window as unknown as PureWindow).PureArray);
    }).catch(err => console.error(err));
}.bind({promise: null});

export {AntiPrototypeJs};
