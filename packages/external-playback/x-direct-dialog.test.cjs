'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const mount = require('./x-direct-dialog.cjs');

for (const linked of [false,true]) {
  test('opening the dialog makes no X request and ignores programmatic clicks (linked=' + linked + ')', () => {
    const dom = new JSDOM('<button id="previous">Open</button>', {runScripts:'outside-only'});
    const win = dom.window;
    try {
      win.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      win.HTMLDialogElement.prototype.close = function () { this.open = false; };
      let shadow,closed = 0;
      const attach = win.Element.prototype.attachShadow;
      win.Element.prototype.attachShadow = function (opts) { shadow = attach.call(this,opts); return shadow; };
      const calls = [];
      const button = win.document.querySelector('button');
      button.focus();
      const dialog = win.eval('(' + mount.toString() + ')')({
        file:new win.File(['clip'],'</p><img src=x>.mp4',{type:'video/mp4'}),text:'<b>draft</b>',
        auth:{config:()=>({}),isLinked:()=>linked,configure:()=>calls.push('config'),disconnect:()=>calls.push('disconnect')},
        publish:()=>calls.push('publish'),account:()=>calls.push('account'),onClose:()=>closed++
      });
      assert.equal(win.document.querySelector('#zenza-x-direct').shadowRoot,null);
      assert.equal(shadow.querySelector('#setup').hidden,linked);
      assert.equal(shadow.querySelector('#linked').hidden,!linked);
      assert.equal(shadow.querySelector('[data-action=publish]').hidden,true);
      assert.equal(shadow.querySelector('img'),null);
      assert.equal(shadow.querySelector('textarea').value,'<b>draft</b>');
      for (const control of shadow.querySelectorAll('button')) control.click();
      assert.deepEqual(calls,[]);
      dialog.close(); dialog.close();
      assert.equal(closed,1);
      assert.equal(win.document.activeElement,button);
    } finally { win.close(); }
  });
}
