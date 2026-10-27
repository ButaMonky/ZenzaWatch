// Task502: byte-exact pre-migration behavior parity for posting target selection.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico, read, loadLegacy, snapshot, settle} from './nico-api-harness.mjs';

emitNico();
const spec = NICO_API_BY_NAME.CommentPostTarget;
const oldSource = read(spec.fixture);
const currentSource = read(spec.runtime);
const original = loadLegacy(oldSource, 'CommentPostTarget', {});
const migrated = loadLegacy(currentSource, 'CommentPostTarget', {});

function verify(name, threads, issues, expected) {
  test('CommentPostTarget legacy/TS parity: ' + name, async () => {
    const beforeInput = structuredClone(threads);
    const afterInput = structuredClone(threads);
    const before = await settle(() => original.select(beforeInput, issues));
    const after = await settle(() => migrated.select(afterInput, issues));
    assert.deepEqual(snapshot(after), snapshot(before));
    assert.equal(after.ok, true);
    assert.equal(after.value.canPost, expected.canPost);
    assert.equal(after.value.postUnavailableReason, expected.reason);
    assert.deepEqual(after.value.optionalThreads.map(t => t.id), expected.optionalIds);
    if (expected.defaultIndex === null) {
      assert.equal(after.value.defaultThread, null);
      assert.equal(after.value.threadId, null);
    } else {
      assert.equal(after.value.defaultThread, afterInput[expected.defaultIndex],
        'selected thread is original element, not a clone');
      assert.equal(after.value.threadId, afterInput[expected.defaultIndex].id);
    }
    assert.equal(afterInput.length, threads.length, 'no array mutation');
  });
}

verify('normal numeric ID',
  [{id: 10, isDefaultPostTarget: true}, {id: 11, isDefaultPostTarget: false}],
  [], {canPost: true, reason: null, optionalIds: [11], defaultIndex: 0});
verify('no candidate',
  [{id: 10, isDefaultPostTarget: false}, {id: 11}],
  [], {canPost: false, reason: 'no-post-target', optionalIds: [10, 11], defaultIndex: null});
verify('metadata partially invalid',
  [{id: 10, isDefaultPostTarget: false}],
  ['threads'], {canPost: false, reason: 'malformed-comment',
  optionalIds: [10], defaultIndex: null});
verify('missing every thread', [], ['comment'],
  {canPost: false, reason: 'malformed-comment', optionalIds: [], defaultIndex: null});
verify('duplicate target IDs removed from optional list',
  [{id: '7', isDefaultPostTarget: true}, {id: '7'}, {id: '8'}],
  [], {canPost: true, reason: null, optionalIds: ['8'], defaultIndex: 0});
verify('first candidate wins regardless of later targets',
  [{id: 1, isDefaultPostTarget: true}, {id: 2, isDefaultPostTarget: true}],
  [], {canPost: true, reason: null, optionalIds: [2], defaultIndex: 0});
verify('zero ID remains a target',
  [{id: 0, isDefaultPostTarget: true}, {id: 1}],
  [], {canPost: true, reason: null, optionalIds: [1], defaultIndex: 0});
verify('legacy truthy flag retained',
  [{id: 1, isDefaultPostTarget: 'true'}, {id: 2}],
  [], {canPost: true, reason: null, optionalIds: [2], defaultIndex: 0});
verify('missing id retained as undefined, not invented fallback',
  [{isDefaultPostTarget: true}, {id: 2}],
  [], {canPost: true, reason: null, optionalIds: [2], defaultIndex: 0});
verify('non-default threads never turn into implicit targets',
  [{id: 5}, {id: 6}], ['layers', 'components'],
  {canPost: false, reason: 'malformed-comment', optionalIds: [5, 6],
  defaultIndex: null});
