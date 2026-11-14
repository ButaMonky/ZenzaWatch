import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PlaybackRateReconciler, createPlaybackRateReconciler, normalizeRate, MIN_RATE, MAX_RATE
} from '../.generated/task1029/nico-src/PlaybackRateReconciler.js';

const make = (respectExternal = true, initial = 1) => {
  const state = {respectExternal};
  const r = createPlaybackRateReconciler({respectExternal: () => state.respectExternal}, initial);
  return {r, state};
};

test('task1029 normalizeRate accepts only finite positive in-range values', () => {
  assert.equal(normalizeRate(1), 1);
  assert.equal(normalizeRate('1.5'), 1.5);
  assert.equal(normalizeRate(MIN_RATE), MIN_RATE);
  assert.equal(normalizeRate(MAX_RATE), MAX_RATE);
  assert.equal(normalizeRate(0), null);
  assert.equal(normalizeRate(-2), null);
  assert.equal(normalizeRate(NaN), null);
  assert.equal(normalizeRate(Infinity), null);
  assert.equal(normalizeRate(MAX_RATE + 1), null);
  assert.equal(normalizeRate(MIN_RATE / 2), null);
  assert.equal(normalizeRate(undefined), null);
  assert.equal(normalizeRate('速い'), null);
});

test('task1029 our own write echoing back as ratechange is ignored', () => {
  const {r} = make();
  r.noteApplied(2);
  const d = r.observe(2);
  assert.equal(d.kind, 'ignore');
  assert.equal(d.reason, 'self');
  assert.equal(r.currentRate, 2);
  assert.equal(r.externalAdoptions, 0);
});

test('task1029 float noise within tolerance counts as our own write', () => {
  const {r} = make();
  r.noteApplied(1.75);
  assert.equal(r.observe(1.7500001).kind, 'ignore');
  assert.equal(r.externalAdoptions, 0);
});

test('task1029 an external change is adopted, not overwritten', () => {
  const {r} = make();
  r.noteApplied(1);
  const d = r.observe(2.5);
  assert.equal(d.kind, 'adopt');
  assert.equal(d.rate, 2.5);
  assert.equal(d.reason, 'external');
  // 取り込んだ値が以後の基準になる（自分で書き戻しても反響として無視される）
  assert.equal(r.currentRate, 2.5);
  assert.equal(r.observe(2.5).kind, 'ignore');
  assert.equal(r.externalAdoptions, 1);
});

test('task1029 repeated external steps are each adopted', () => {
  const {r} = make();
  r.noteApplied(1);
  for (const rate of [1.1, 1.2, 1.3, 1.4]) {
    const d = r.observe(rate);
    assert.equal(d.kind, 'adopt');
    assert.equal(d.rate, rate);
  }
  assert.equal(r.currentRate, 1.4);
  assert.equal(r.externalAdoptions, 4);
});

test('task1029 external change is rejected when the setting is off', () => {
  const {r} = make(false);
  r.noteApplied(1.5);
  const d = r.observe(3);
  assert.equal(d.kind, 'reapply');
  assert.equal(d.rate, 1.5, 'Zenzaの保持値を書き戻す');
  assert.equal(d.reason, 'external-rejected');
  assert.equal(r.currentRate, 1.5, '拒否したので取り込まない');
  assert.equal(r.externalAdoptions, 0);
});

test('task1029 out-of-range external values are left alone, never fought over', () => {
  const {r} = make();
  r.noteApplied(2);
  for (const bad of [0, -1, NaN, 99, undefined]) {
    const d = r.observe(bad);
    assert.equal(d.kind, 'ignore', `${String(bad)} は触らない`);
    assert.equal(d.reason, 'out-of-range');
  }
  assert.equal(r.currentRate, 2);
});

test('task1029 reconcile does nothing while the element agrees', () => {
  const {r} = make();
  r.noteApplied(1.25);
  const d = r.reconcile(1.25);
  assert.equal(d.kind, 'ignore');
  assert.equal(d.reason, 'in-sync');
});

test('task1029 reconcile reapplies only when the element actually drifted', () => {
  const {r} = make();
  r.noteApplied(1.25);
  const d = r.reconcile(1);
  assert.equal(d.kind, 'reapply');
  assert.equal(d.rate, 1.25);
  assert.equal(d.reason, 'drifted');
});

test('task1029 reconcile reapplies when the element rate cannot be read', () => {
  const {r} = make();
  r.noteApplied(1.5);
  const d = r.reconcile(undefined);
  assert.equal(d.kind, 'reapply');
  assert.equal(d.rate, 1.5);
  assert.equal(d.reason, 'unreadable');
});

test('task1029 an adopted external rate survives reconcile after a source change', () => {
  // 拡張機能で 2 倍 → 次の動画を読み込む → defaultPlaybackRate により 2 倍で始まる
  const {r} = make();
  r.noteApplied(1);
  assert.equal(r.observe(2).kind, 'adopt');
  assert.equal(r.reconcile(2).kind, 'ignore', '書き戻しを起こさない');
});

test('task1029 turning the setting off mid-session stops further adoption', () => {
  const {r, state} = make();
  r.noteApplied(1);
  assert.equal(r.observe(2).kind, 'adopt');
  state.respectExternal = false;
  const d = r.observe(3);
  assert.equal(d.kind, 'reapply');
  assert.equal(d.rate, 2, '直近に取り込んだ値を保持値として書き戻す');
});

test('task1029 requestRate validates values coming from settings and commands', () => {
  const {r} = make();
  assert.equal(r.requestRate('0.5'), 0.5);
  assert.equal(r.requestRate(0), null);
  assert.equal(r.requestRate(100), null);
});

test('task1029 noteApplied ignores invalid values and keeps the last good one', () => {
  const {r} = make();
  r.noteApplied(1.5);
  r.noteApplied(NaN);
  r.noteApplied(0);
  assert.equal(r.currentRate, 1.5);
});

test('task1029 constructor falls back to 1 for an unusable initial rate', () => {
  const r = new PlaybackRateReconciler({respectExternal: () => true}, NaN);
  assert.equal(r.currentRate, 1);
});
