// Task 095: recover historical fixes that were documented/verified but lost from current source.
import assert from 'power-assert';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../..');
const DIALOG_PATH = path.join(REPO_ROOT, 'src', 'NicoVideoPlayerDialog.js');

function readDialog() {
  return fs.readFileSync(DIALOG_PATH, 'utf-8');
}

function between(text, startNeedle, endNeedle) {
  const start = text.indexOf(startNeedle);
  assert.ok(start >= 0, `start marker not found: ${startNeedle}`);
  const end = text.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, `end marker not found: ${endNeedle}`);
  return text.slice(start, end);
}

function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) { return out; }
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { walkJs(p, out); }
    else if (entry.isFile() && entry.name.endsWith('.js')) { out.push(p); }
  }
  return out;
}

describe('Historical source recovery（Task 095）', function() {
  it('Task 051: screen-mode切替ではcontrol barだけ再計算し、header状態を触らない', function() {
    const source = readDialog();
    const responsive = between(source, '  _updateResponsive(', '  _isFullscreenControlBarScope() {');
    assert.ok(
      responsive.includes('_updateResponsive({onlyControlBar = false} = {})'),
      'onlyControlBar option が消えている'
    );

    const control = responsive.indexOf("this.toggleClass('showVideoControlBar', showVideoControlBar);");
    const guard = responsive.indexOf('if (onlyControlBar)');
    const header = responsive.indexOf("this.toggleClass('showVideoHeaderPanel', showVideoHeaderPanel);");
    assert.ok(control >= 0 && guard > control && header > guard,
      'control bar更新 → onlyControlBar guard → header更新 の順序が崩れている');

    const applyMode = between(source, '  _applyScreenMode(force = false)', '  _updateScreenModeStyle()');
    assert.ok(
      applyMode.includes('this._updateResponsive({onlyControlBar: true})'),
      'screen-mode切替が全responsive状態を再計算している'
    );
  });

  it('Task 052: backCommentのviewport-sized comment layerはfor-fullだけで有効', function() {
    const source = readDialog();
    const rule = '.zenzaPlayerContainer.is-backComment .commentLayerFrame';
    assert.equal(source.split(rule).length - 1, 1, 'backComment comment-layer ruleは1か所だけであるべき');

    const forFullEnd = source.indexOf("`, {className: 'screenMode for-full', disabled: true});");
    assert.ok(forFullEnd > 0, 'for-full style block が見つからない');
    const forFullStart = source.lastIndexOf('util.addStyle(`', forFullEnd);
    assert.ok(forFullStart >= 0, 'for-full style block の開始が見つからない');
    const forFull = source.slice(forFullStart, forFullEnd);

    const globalStart = source.indexOf('NicoVideoPlayerDialogView.__css__ = `');
    const globalEnd = source.indexOf('class NicoVideoPlayerDialog extends Emitter', globalStart);
    assert.ok(globalStart >= 0 && globalEnd > globalStart, 'global dialog CSS block が見つからない');
    const globalCss = source.slice(globalStart, globalEnd);

    assert.ok(forFull.includes(rule), 'Task 052 rule がfor-fullへ戻っていない');
    assert.ok(forFull.includes('.is-backComment .videoPlayer'), '対応するvideo shrink ruleがfor-fullに無い');
    assert.ok(!globalCss.includes(rule), 'Task 052 rule がglobal CSSへ逆流している');
  });

  it('Task 074: retired IchibaLoader file/referenceを残さない', function() {
    const removed = path.join(REPO_ROOT, 'packages', 'lib', 'src', 'nico', 'IchibaLoader.js');
    assert.ok(!fs.existsSync(removed), 'IchibaLoader.js が削除漏れのまま残っている');

    const hits = [];
    for (const root of [path.join(REPO_ROOT, 'src'), path.join(REPO_ROOT, 'packages')]) {
      for (const file of walkJs(root)) {
        const text = fs.readFileSync(file, 'utf-8');
        if (text.includes('IchibaLoader')) { hits.push(path.relative(REPO_ROOT, file)); }
      }
    }
    assert.deepEqual(hits, [], `IchibaLoader reference remains: ${hits.join(', ')}`);
  });
});
