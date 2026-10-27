// Task505: byte-exact baseline JS vs strict TypeScript generated runtime parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico, read, loadLegacy} from './nico-api-harness.mjs';

emitNico();
const spec = NICO_API_BY_NAME.CommentSubmitLifetime;
const before = read(spec.fixture);
const after = read(spec.runtime);

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
async function observe(source, mode) {
  const helper = loadLegacy(source, 'CommentSubmitLifetime', {Promise});
  const comments = [], toggles = [], classes = new Set();
  const text = field(mode === 'empty' ? '  ' : '  hello world  ');
  const command = field('  red ue  ');
  const panel = {
    _submitPending: false,
    _submitPromise: null,
    _$commentInput: text,
    _$commandInput: command,
    _$view: {
      addClass(name) { classes.add(name); },
      removeClass(name) { classes.delete(name); }
    },
    _togglePopover(open) { toggles.push(open); },
    emit(event, control, chat, cmd) {
      comments.push({event, control, chat, cmd});
      if (mode === 'throw') { throw new Error('emitter unavailable'); }
    }
  };
  const first = helper.submit(panel);
  if (mode === 'empty') {
    return {noPost: first === undefined, comments: comments.length,
      stillEmpty: text.val() === '  ', pending: !!panel._submitPending};
  }
  let identicalPromise = null;
  if (mode === 'duplicate') {
    identicalPromise = helper.submit(panel) === first;
  }
  if (mode === 'changed-chat' || mode === 'changed-both') {
    text.val('new draft while waiting');
  }
  if (mode === 'changed-command' || mode === 'changed-both') {
    command.val('  blue shita  ');
  }
  if (mode !== 'throw') {
    if (mode === 'rejected' || mode === 'retry-manual') {
      comments[0].control.reject(new Error('server refused'));
    } else {
      comments[0].control.resolve();
    }
  }
  const result = await first;
  let manualRetry = null;
  if (mode === 'retry-manual') {
    const retry = helper.submit(panel);
    comments[1].control.resolve();
    manualRetry = await retry;
  }
  return {
    result, manualRetry,
    identicalPromise, emitCount: comments.length,
    emitted: comments.map(({event, chat, cmd}) => ({event, chat, cmd})),
    text: text.val(), command: command.val(),
    chatBlurs: text.blurs, commandBlurs: command.blurs,
    toggles, pending: !!panel._submitPending,
    promiseCleared: panel._submitPromise === null,
    updating: classes.has('updating')
  };
}
for (const mode of [
  'success', 'rejected', 'duplicate', 'changed-chat',
  'changed-command', 'changed-both', 'throw', 'retry-manual', 'empty'
]) {
  test('CommentSubmitLifetime preserved input/POST semantics: ' + mode, async () => {
    const original = await observe(before, mode);
    const generated = await observe(after, mode);
    assert.deepEqual(generated, original);
    if (mode === 'duplicate') {
      assert.equal(generated.emitCount, 1, 'no concurrent duplicate');
      assert.equal(generated.identicalPromise, true);
    }
    if (mode === 'rejected') {
      assert.equal(generated.text, '  hello world  ');
      assert.equal(generated.result, false);
    }
    assert.equal(generated.pending, false);
  });
}
