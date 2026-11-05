import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {TimelineGeometry} from '../nico-src/TimelineGeometry.ts';

test('time and ratio clamp finite endpoints without rounding short media', () => {
  for (const [seconds, duration, expected] of [
    [-10, 200, 0], [0, 200, 0], [50, 200, 0.25], [200, 200, 1],
    [250, 200, 1], [0.2, 0.4, 0.5], [Number.MAX_VALUE, Number.MIN_VALUE, 1]
  ]) { assert.equal(TimelineGeometry.timeToRatio(seconds!, duration!), expected); }
  for (const [ratio, duration, expected] of [[-1, 200, 0], [0.25, 200, 50], [2, 200, 200]]) {
    assert.equal(TimelineGeometry.ratioToTime(ratio!, duration!), expected);
  }
});

test('invalid duration and nonfinite values are rejected, never coerced to zero', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.equal(TimelineGeometry.timeToRatio(value, 200), null);
    assert.equal(TimelineGeometry.ratioToTime(value, 200), null);
  }
  for (const duration of [0, -1, NaN, Infinity, -Infinity]) {
    assert.equal(TimelineGeometry.timeToRatio(50, duration), null);
    assert.equal(TimelineGeometry.ratioToTime(0.25, duration), null);
  }
});

test('client and local coordinates preserve distinct spaces', () => {
  const geometry = TimelineGeometry.create({clientLeft: 100, clientWidth: 600, localWidth: 300})!;
  assert.equal(geometry.clientXToRatio(250), 0.25);
  assert.equal(geometry.ratioToClientX(0.25), 250);
  assert.equal(geometry.ratioToLocalX(0.25), 75);
  assert.equal(geometry.localXToRatio(75), 0.25);
  assert.equal(TimelineGeometry.ratioToTime(geometry.clientXToRatio(250)!, 200), 50);
});

test('fractional bounds, subpixel positions and positive scale retain precision', () => {
  const geometry = TimelineGeometry.create({clientLeft: 10.25, clientWidth: 500.5, localWidth: 250})!;
  assert.equal(geometry.clientXToRatio(260.5), 0.5);
  assert.equal(geometry.ratioToClientX(0.5), 260.5);
  assert.equal(geometry.ratioToLocalX(0.5), 125);
  assert.equal(geometry.localXToRatio(62.5), 0.25);
});

test('translated and offscreen tracks clamp at their own ends', () => {
  const geometry = TimelineGeometry.create({clientLeft: -100, clientWidth: 600, localWidth: 300})!;
  for (const [x, ratio] of [[-200, 0], [-100, 0], [50, 0.25], [500, 1], [900, 1]]) {
    assert.equal(geometry.clientXToRatio(x!), ratio);
  }
  assert.equal(geometry.ratioToClientX(-1), -100);
  assert.equal(geometry.ratioToClientX(2), 500);
  assert.equal(geometry.localXToRatio(-5), 0);
  assert.equal(geometry.localXToRatio(500), 1);
  assert.equal(geometry.ratioToLocalX(-1), 0);
  assert.equal(geometry.ratioToLocalX(2), 300);
});

test('geometry rejects zero width, negative width, missing and overflowing bounds', () => {
  assert.equal(TimelineGeometry.create(null), null);
  assert.equal(TimelineGeometry.create(undefined), null);
  for (const measurement of [
    {clientLeft: 0, clientWidth: 0, localWidth: 300},
    {clientLeft: 0, clientWidth: -1, localWidth: 300},
    {clientLeft: NaN, clientWidth: 600, localWidth: 300},
    {clientLeft: Infinity, clientWidth: 600, localWidth: 300},
    {clientLeft: 0, clientWidth: Infinity, localWidth: 300},
    {clientLeft: 0, clientWidth: 600, localWidth: 0},
    {clientLeft: 0, clientWidth: 600, localWidth: NaN},
    {clientLeft: Number.MAX_VALUE, clientWidth: Number.MAX_VALUE, localWidth: 300},
    {clientLeft: 1, clientWidth: Number.MIN_VALUE, localWidth: 300}
  ]) { assert.equal(TimelineGeometry.create(measurement), null); }
});

test('invalid input remains null in every coordinate conversion', () => {
  const geometry = TimelineGeometry.create({clientLeft: 100, clientWidth: 600, localWidth: 300})!;
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.equal(geometry.clientXToRatio(value), null);
    assert.equal(geometry.localXToRatio(value), null);
    assert.equal(geometry.ratioToClientX(value), null);
    assert.equal(geometry.ratioToLocalX(value), null);
  }
});

test('large finite coordinates clamp before subtraction can overflow', () => {
  const geometry = TimelineGeometry.create({clientLeft: -1e308, clientWidth: 1e308, localWidth: 300})!;
  assert.equal(geometry.clientXToRatio(1e308), 1);
  assert.equal(geometry.clientXToRatio(-1.5e308), 0);
  assert.equal(geometry.clientXToRatio(-5e307), 0.5);
});

test('a measurement is a snapshot, with no live DOM or mutable caller state', () => {
  const measurement = {clientLeft: 100, clientWidth: 600, localWidth: 300};
  const geometry = TimelineGeometry.create(measurement)!;
  measurement.clientWidth = 1;
  measurement.localWidth = 1;
  assert.equal(geometry.clientXToRatio(250), 0.25);
  assert.equal(geometry.ratioToLocalX(0.25), 75);
});

test('generated runtime exposes the same numeric contract without TypeScript support', () => {
  const text = readFileSync(new URL('../../../packages/zenza/src/sceneSearch/TimelineGeometry.js', import.meta.url), 'utf8');
  const body = text.split('//===BEGIN===')[1]!.split('//===END===')[0]!;
  const Runtime: typeof TimelineGeometry = runInNewContext(body + '\nTimelineGeometry;');
  const geometry = Runtime.create({clientLeft: 100, clientWidth: 600, localWidth: 300})!;
  assert.equal(geometry.clientXToRatio(250), 0.25);
  assert.equal(geometry.ratioToLocalX(0.25), 75);
  assert.equal(geometry.ratioToClientX(0.75), 550);
  assert.equal(Runtime.ratioToTime(0.25, 200), 50);
  assert.equal(Runtime.clampTime(0.123456789, 200), 0.123456789);
  assert.equal(Runtime.clampTime(Infinity, 200), null);
});
