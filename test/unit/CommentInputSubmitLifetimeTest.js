'use strict';
const assert = require('assert');
const {loadClass, createContext, extract, run} = require('../helpers/extractSource');

function field(initial) {
  let value = initial, blurs = 0;
  return {
    val(next) {
      if (arguments.length) { value = next; return this; }
      return value;
    },
    blur() { blurs++; return this; },
    get blurs() { return blurs; }
  };
}
function fixture(path) {
  const tasks = [], posts = [], toggles = [], styles = new Set();
  const ctx = createContext({
    Emitter: class {},
    setTimeout: fn => { tasks.push(fn); return tasks.length; }
  });
  // Evaluate exactly the bundled helper alongside the real class in both paths.
  const helperPath = path === 'src/CommentInputPanel.js' ?
    'packages/lib/src/nico/CommentSubmitLifetime.js' : path;
  run('const CommentSubmitLifetime = ' +
    extract(helperPath, 'CommentSubmitLifetime', 'var') + ';', ctx);
  const Subject = loadClass(path, 'CommentInputPanel', ctx);
  const subject = Object.create(Subject.prototype);
  const message = field('  hello world  ');
  const command = field('  red shita  ');
  subject._$commentInput = message;
  subject._$commandInput = command;
  subject._$view = {
    addClass(name) { styles.add(name); return this; },
    removeClass(name) { styles.delete(name); return this; }
  };
  subject._togglePopover = arg => toggles.push(arg);
  subject.emit = (name, control, chat, cmd) => {
    assert.strictEqual(name, 'post');
    posts.push({control, chat, cmd});
  };
  const flush = async () => {
    while (tasks.length) { tasks.shift()(); }
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
  };
  return {subject, message, command, styles, toggles, posts, flush};
}
for (const path of ['src/CommentInputPanel.js', 'dist/ZenzaWatch-dev.user.js']) {
  describe('Task371 AUD-01 comment submit lifetime (' + path + ')', () => {
    it('keeps unsent text and command through a failed post', async () => {
      const h = fixture(path);
      h.subject.submit();
      await h.flush();
      assert.strictEqual(h.posts.length, 1);
      assert.strictEqual(h.message.val(), '  hello world  ', 'keep draft while sending');
      h.posts[0].control.reject(new Error('post failed'));
      await h.flush();
      assert.strictEqual(h.message.val(), '  hello world  ');
      assert.strictEqual(h.command.val(), '  red shita  ');
      assert.strictEqual(h.message.blurs, 0);
      assert.strictEqual(h.command.blurs, 0);
      assert.strictEqual(h.styles.has('updating'), false);
      assert.strictEqual(h.subject._submitPending, false);
    });

    it('blocks duplicate form and button submissions until the post settles', async () => {
      const h = fixture(path);
      const first = h.subject.submit();
      await h.flush();
      h.subject._onSubmitButtonClick({preventDefault() {}});
      h.subject._onSubmit({preventDefault() {}});
      await h.flush();
      assert.strictEqual(h.posts.length, 1, 'the same draft may post only once');
      assert.strictEqual(h.subject._submitPending, true);
      h.posts[0].control.reject(new Error('retry permitted'));
      await h.flush();
      h.subject.submit();
      await h.flush();
      assert.strictEqual(h.posts.length, 2, 'allow retry after failure');
      h.posts[1].control.resolve();
      await h.flush();
    });
    it('clears only an unchanged draft after successful posting', async () => {
      const h = fixture(path);
      h.subject.submit();
      await h.flush();
      assert.strictEqual(h.message.val(), '  hello world  ');
      assert.strictEqual(h.command.val(), '  red shita  ');
      assert.strictEqual(h.styles.has('updating'), true);
      assert.deepStrictEqual(h.posts.map(p => [p.chat, p.cmd]),
        [['hello world', 'red shita']]);
      h.posts[0].control.resolve();
      await h.flush();
      assert.strictEqual(h.message.val(), '');
      assert.strictEqual(h.command.val(), '  red shita  ', 'keep command selection');
      assert.strictEqual(h.message.blurs, 1);
      assert.strictEqual(h.command.blurs, 1);
      assert.strictEqual(h.toggles.length, 1);
      assert.strictEqual(h.styles.has('updating'), false);
      assert.strictEqual(h.subject._submitPending, false);
    });

    it('never erases a newer comment while the earlier send is pending', async () => {
      const h = fixture(path);
      h.subject.submit();
      h.message.val('new draft in progress');
      await h.flush();
      h.posts[0].control.resolve();
      await h.flush();
      assert.strictEqual(h.message.val(), 'new draft in progress');
      assert.strictEqual(h.message.blurs, 0);
      assert.strictEqual(h.toggles.length, 0);
    });

    it('retains a changed command and draft after the old post succeeds', async () => {
      const h = fixture(path);
      h.subject.submit();
      h.command.val('blue ue');
      await h.flush();
      h.posts[0].control.resolve();
      await h.flush();
      assert.strictEqual(h.command.val(), 'blue ue');
      assert.strictEqual(h.message.val(), '  hello world  ');
      assert.strictEqual(h.toggles.length, 0);
    });

    it('does not destroy edits if the old asynchronous post fails', async () => {
      const h = fixture(path);
      h.subject.submit();
      h.message.val('brand new message');
      h.command.val('green naka');
      await h.flush();
      h.posts[0].control.reject(new Error('old failure'));
      await h.flush();
      assert.strictEqual(h.message.val(), 'brand new message');
      assert.strictEqual(h.command.val(), 'green naka');
    });
    it('prevents native submit and click default actions', async () => {
      const h = fixture(path);
      let submitPrevented = 0, clickPrevented = 0;
      h.subject._onSubmit({preventDefault() { submitPrevented++; }});
      h.subject._onSubmitButtonClick({preventDefault() { clickPrevented++; }});
      await h.flush();
      assert.strictEqual(submitPrevented, 1);
      assert.strictEqual(clickPrevented, 1);
      assert.strictEqual(h.posts.length, 1);
      h.posts[0].control.resolve();
      await h.flush();
    });

    it('handles a synchronous emitter error without losing the draft', async () => {
      const h = fixture(path);
      h.subject.emit = () => { throw new Error('emitter unavailable'); };
      h.subject.submit();
      await h.flush();
      assert.strictEqual(h.message.val(), '  hello world  ');
      assert.strictEqual(h.subject._submitPending, false);
      assert.strictEqual(h.styles.has('updating'), false);
    });

    it('does not send blank drafts', async () => {
      const h = fixture(path);
      h.message.val('  ');
      h.subject.submit();
      await h.flush();
      assert.strictEqual(h.posts.length, 0);
      assert.strictEqual(h.styles.has('updating'), false);
    });
  });
}
