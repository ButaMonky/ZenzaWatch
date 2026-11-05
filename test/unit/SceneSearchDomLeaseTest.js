'use strict';

const assert = require('assert');
const {JSDOM} = require('jsdom');
const {loadClass, createContext} = require('../helpers/extractSource');

describe('SceneSearchDomLease', function () {
  let dom, document, Lease;

  beforeEach(function () {
    dom = new JSDOM('<!doctype html><html><body></body></html>', {
      pretendToBeVisual: true
    });
    document = dom.window.document;
    Lease = loadClass('packages/zenza/src/sceneSearch/SceneSearchDomLease.js',
      'SceneSearchDomLease', createContext());
  });

  afterEach(function () {
    dom.window.close();
  });

  function fixture() {
    const original = document.createElement('section');
    const before = document.createElement('i');
    const node = document.createElement('div');
    const after = document.createElement('b');
    const tail = document.createElement('span');
    const target = document.createElement('aside');
    original.append(before, node, after, tail);
    document.body.append(original, target);
    return {original, before, node, after, tail, target};
  }

  function errorFrom(action) {
    try { action(); } catch (error) { return error; }
    assert.fail('Expected the DOM operation to report its failure');
  }

  function errorsWithin(error) {
    return error.errors ? Array.from(error.errors).flatMap(errorsWithin) : [error];
  }

  it('returns the exact borrowed node to its original sibling order after repeated moves', function () {
    const {original, before, node, after, tail, target} = fixture();
    const destinationSibling = document.createElement('em');
    target.append(destinationSibling);
    const secondTarget = document.createElement('article');
    document.body.append(secondTarget);
    const lease = new Lease(node, {position: true});

    lease.moveTo(target, destinationSibling);
    assert.strictEqual(target.firstChild, node);
    lease.moveTo(secondTarget);
    lease.moveTo(target, destinationSibling);
    lease.restore();
    lease.restore();

    assert.strictEqual(lease.node, node);
    assert.strictEqual(lease.released, true);
    assert.deepStrictEqual(Array.from(original.childNodes), [before, node, after, tail]);
    assert.deepStrictEqual(Array.from(target.childNodes), [destinationSibling]);
    assert.strictEqual(secondTarget.childNodes.length, 0);
    assert.throws(() => lease.moveTo(target), /released/i);
  });

  it('keeps the original slot when adjacent siblings are removed and new native content arrives', function () {
    const {original, before, node, after, tail, target} = fixture();
    const lease = new Lease(node, {position: true});
    lease.moveTo(target);
    assert.strictEqual(node.parentNode, target);
    before.remove();
    after.remove();
    const inserted = document.createElement('mark');
    original.insertBefore(inserted, tail);

    lease.restore();

    assert.deepStrictEqual(Array.from(original.childNodes), [node, inserted, tail]);
  });

  it('falls back to surviving original siblings when the owner removes the position marker', function () {
    const {original, before, node, tail, target} = fixture();
    const lease = new Lease(node, {position: true});
    lease.moveTo(target);
    original.replaceChildren(before, tail);

    lease.restore();

    assert.deepStrictEqual(Array.from(original.childNodes), [before, node, tail]);
  });

  it('keeps the captured sibling order if the node is reordered before its first borrow', function () {
    const {original, before, node, after, tail, target} = fixture();
    const lease = new Lease(node, {position: true});
    original.append(node);

    lease.moveTo(target);
    lease.restore();

    assert.deepStrictEqual(Array.from(original.childNodes), [before, node, after, tail]);
  });

  it('uses an earlier original sibling when all later siblings and the marker disappear', function () {
    const {original, before, node, target} = fixture();
    const lease = new Lease(node, {position: true});
    lease.moveTo(target);
    const inserted = document.createElement('mark');
    original.replaceChildren(before, inserted);

    lease.restore();

    assert.deepStrictEqual(Array.from(original.childNodes), [before, node, inserted]);
  });

  it('restores nested borrowed nodes in the caller\'s reverse acquisition order', function () {
    const {original, before, node, after, tail, target} = fixture();
    const text = document.createTextNode('native');
    const child = document.createElement('canvas');
    node.append(text, child);
    const parentLease = new Lease(node, {position: true});
    parentLease.moveTo(target);
    const childLease = new Lease(child, {position: true});
    childLease.moveTo(target);
    assert.strictEqual(node.parentNode, target);
    assert.strictEqual(child.parentNode, target);

    childLease.restore();
    parentLease.restore();

    assert.deepStrictEqual(Array.from(node.childNodes), [text, child]);
    assert.deepStrictEqual(Array.from(original.childNodes), [before, node, after, tail]);
  });

  it('returns an initially detached node to the detached state', function () {
    const node = document.createElement('canvas');
    const target = document.createElement('section');
    document.body.append(target);
    const lease = new Lease(node, {position: true});
    lease.moveTo(target);

    lease.restore();

    assert.strictEqual(node.parentNode, null);
    assert.strictEqual(target.childNodes.length, 0);
    assert.strictEqual(lease.released, true);
  });

  it('restores into the same original owner while that owner is detached', function () {
    const {original, before, node, after, tail, target} = fixture();
    const lease = new Lease(node, {position: true});
    lease.moveTo(target);
    assert.strictEqual(node.parentNode, target);
    original.remove();

    lease.restore();

    assert.strictEqual(node.parentNode, original);
    assert.strictEqual(original.parentNode, null);
    assert.deepStrictEqual(Array.from(original.childNodes), [before, node, after, tail]);
    document.body.append(original);
    assert.strictEqual(document.body.contains(node), true);
  });

  it('does not acquire or restore position for a default style-only lease', function () {
    const {original, before, node, after, tail, target} = fixture();
    const lease = new Lease(node, {styles: ['display']});
    assert.deepStrictEqual(Array.from(original.childNodes), [before, node, after, tail]);
    assert.throws(() => lease.moveTo(target), /position/i);
    target.append(node);
    node.style.display = 'none';

    lease.restore();

    assert.strictEqual(node.parentNode, target);
    assert.strictEqual(node.style.display, '');
  });

  it('rejects a second position owner while allowing independent style-only leases', function () {
    const {node, target} = fixture();
    const position = new Lease(node, {position: true});
    const styles = new Lease(node, {styles: ['display']});
    assert.throws(() => new Lease(node, {position: true}), /position|leased|owned/i);
    styles.restore();
    assert.throws(() => new Lease(node, {position: true}), /position|leased|owned/i);
    position.moveTo(target);
    position.restore();
    const next = new Lease(node, {position: true});
    next.moveTo(target);
    next.restore();
    assert.strictEqual(next.released, true);
  });

  it('restores only named style properties, class membership and attributes', function () {
    const {node} = fixture();
    node.style.setProperty('font-size', '13px', 'important');
    node.style.color = 'red';
    node.className = 'native initially-owned';
    node.setAttribute('title', 'native title');
    const lease = new Lease(node, {
      styles: ['font-size', 'display'],
      classes: ['initially-owned', 'is-docked'],
      attributes: ['title', 'data-owned']
    });
    node.style.fontSize = '32px';
    node.style.display = 'none';
    node.style.color = 'blue';
    node.style.setProperty('--worker-frame', '42');
    node.classList.remove('initially-owned');
    node.classList.add('is-docked', 'is-visible', 'worker-updated');
    node.setAttribute('title', 'borrowed title');
    node.setAttribute('data-owned', 'temporary');
    node.setAttribute('data-worker-frame', '42');

    lease.restore();

    assert.strictEqual(node.style.getPropertyValue('font-size'), '13px');
    assert.strictEqual(node.style.getPropertyPriority('font-size'), 'important');
    assert.strictEqual(node.style.display, '');
    assert.strictEqual(node.style.color, 'blue');
    assert.strictEqual(node.style.getPropertyValue('--worker-frame'), '42');
    assert.strictEqual(node.classList.contains('initially-owned'), true);
    assert.strictEqual(node.classList.contains('is-docked'), false);
    assert.strictEqual(node.classList.contains('is-visible'), true);
    assert.strictEqual(node.classList.contains('worker-updated'), true);
    assert.strictEqual(node.getAttribute('title'), 'native title');
    assert.strictEqual(node.hasAttribute('data-owned'), false);
    assert.strictEqual(node.getAttribute('data-worker-frame'), '42');
  });

  it('preserves originally absent empty style and class attributes', function () {
    const node = document.createElement('div');
    const lease = new Lease(node, {styles: ['display'], classes: ['is-docked']});
    node.style.display = 'block';
    node.classList.add('is-docked');

    lease.restore();

    assert.strictEqual(node.hasAttribute('style'), false);
    assert.strictEqual(node.hasAttribute('class'), false);
  });

  it('rejects whole style and class attribute snapshots that would overwrite native updates', function () {
    const node = document.createElement('div');
    for (const name of ['style', 'class', 'STYLE', 'CLASS']) {
      assert.throws(() => new Lease(node, {attributes: [name]}), /style|class/i);
    }
  });

  [null, '', 'until-found', 'hidden'].forEach(value => {
    it('restores the exact hidden state and attribute for ' + JSON.stringify(value), function () {
      const node = document.createElement('div');
      if (value !== null) { node.setAttribute('hidden', value); }
      const hidden = node.hidden;
      const lease = new Lease(node, {hidden: true});
      node.hidden = !hidden;
      lease.restore();
      assert.strictEqual(node.hidden, hidden);
      assert.strictEqual(node.getAttribute('hidden'), value);
    });
  });

  it('copies the six native computed typography values and later releases those overrides', function () {
    const style = document.createElement('style');
    style.textContent = '.native {font-family: serif; font-size: 14px; line-height: 20px;' +
      'font-weight: 700; letter-spacing: 2px; word-spacing: 3px;}';
    document.head.append(style);
    const node = document.createElement('span');
    node.className = 'native';
    document.body.append(node);
    const lease = new Lease(node, {styles: Lease.typography});

    Lease.preserveTypography(node);

    assert.strictEqual(node.style.fontFamily, 'serif');
    assert.strictEqual(node.style.fontSize, '14px');
    assert.strictEqual(node.style.lineHeight, '20px');
    assert.strictEqual(node.style.fontWeight, '700');
    assert.strictEqual(node.style.letterSpacing, '2px');
    assert.strictEqual(node.style.wordSpacing, '3px');
    node.style.fontStyle = 'italic';
    lease.restore();
    assert.strictEqual(node.style.fontSize, '');
    assert.strictEqual(node.style.wordSpacing, '');
    assert.strictEqual(node.style.fontStyle, 'italic');
  });

  it('rolls back a move that throws after inserting the real node', function () {
    const {original, before, node, after, tail, target} = fixture();
    const lease = new Lease(node, {position: true});
    const insertion = target.insertBefore.bind(target);
    const failure = new Error('destination failed after insertion');
    target.insertBefore = function (child, sibling) {
      insertion(child, sibling);
      throw failure;
    };

    assert.strictEqual(errorFrom(() => lease.moveTo(target)), failure);

    assert.deepStrictEqual(Array.from(original.childNodes), [before, node, after, tail]);
    assert.strictEqual(target.childNodes.length, 0);
    assert.strictEqual(lease.released, true);
    new Lease(node, {position: true}).restore();
  });

  it('retains the original snapshot when both the move and rollback fail', function () {
    const {original, before, node, after, tail, target} = fixture();
    node.style.display = 'inline';
    const lease = new Lease(node, {position: true, styles: ['display']});
    node.style.display = 'none';
    const destinationInsertion = target.insertBefore.bind(target);
    const originalInsertion = original.insertBefore.bind(original);
    const moveFailure = new Error('destination failed after insertion');
    const restoreFailure = new Error('original owner temporarily unavailable');
    target.insertBefore = function (child, sibling) {
      destinationInsertion(child, sibling);
      throw moveFailure;
    };
    let failRestore = true;
    original.insertBefore = function (child, sibling) {
      if (child === node && failRestore) {
        failRestore = false;
        throw restoreFailure;
      }
      return originalInsertion(child, sibling);
    };

    const failures = errorsWithin(errorFrom(() => lease.moveTo(target)));
    assert.strictEqual(failures.includes(moveFailure), true);
    assert.strictEqual(failures.includes(restoreFailure), true);
    assert.strictEqual(lease.released, false);
    assert.strictEqual(node.parentNode, target);
    assert.strictEqual(node.style.display, 'inline');
    assert.throws(() => new Lease(node, {position: true}), /position|leased|owned/i);

    lease.restore();

    assert.deepStrictEqual(Array.from(original.childNodes), [before, node, after, tail]);
    assert.strictEqual(lease.released, true);
  });

  it('restores every independent aspect after failures and retries only unfinished work', function () {
    const {original, before, node, after, tail, target} = fixture();
    node.style.color = 'red';
    node.style.display = 'inline';
    node.setAttribute('title', 'native');
    const lease = new Lease(node, {
      position: true, styles: ['color', 'display'], classes: ['is-docked'],
      attributes: ['title'], hidden: true
    });
    lease.moveTo(target);
    node.style.color = 'blue';
    node.style.display = 'none';
    node.classList.add('is-docked');
    node.setAttribute('title', 'borrowed');
    node.hidden = true;
    const insertion = original.insertBefore.bind(original);
    const setProperty = node.style.setProperty.bind(node.style);
    const positionFailure = new Error('position temporarily unavailable');
    const styleFailure = new Error('style temporarily unavailable');
    let failPosition = true, failStyle = true;
    original.insertBefore = function (child, sibling) {
      if (child === node && failPosition) {
        failPosition = false;
        throw positionFailure;
      }
      return insertion(child, sibling);
    };
    node.style.setProperty = function (name, value, priority) {
      if (name === 'color' && failStyle) {
        failStyle = false;
        throw styleFailure;
      }
      return setProperty(name, value, priority);
    };

    const failures = errorsWithin(errorFrom(() => lease.restore()));
    assert.strictEqual(failures.includes(positionFailure), true);
    assert.strictEqual(failures.includes(styleFailure), true);
    assert.strictEqual(lease.released, false);
    assert.strictEqual(node.style.display, 'inline');
    assert.strictEqual(node.classList.contains('is-docked'), false);
    assert.strictEqual(node.getAttribute('title'), 'native');
    assert.strictEqual(node.hidden, false);
    node.setAttribute('title', 'new native title after partial restore');

    lease.restore();
    assert.strictEqual(lease.released, true);
    assert.strictEqual(node.style.color, 'red');
    assert.strictEqual(node.getAttribute('title'), 'new native title after partial restore');
    assert.deepStrictEqual(Array.from(original.childNodes), [before, node, after, tail]);
    node.style.color = 'green';
    lease.restore();
    assert.strictEqual(node.style.color, 'green');
  });

  it('preserves the currently focused descendant during moves and restoration without scrolling', function () {
    const {node, target} = fixture();
    const first = document.createElement('input');
    const second = document.createElement('input');
    node.append(first, second);
    first.focus();
    const calls = [];
    for (const input of [first, second]) {
      const focus = input.focus.bind(input);
      input.focus = function (options) { calls.push(options); return focus(options); };
    }
    const lease = new Lease(node, {position: true});

    lease.moveTo(target);
    assert.strictEqual(document.activeElement, first);
    second.focus();
    calls.length = 0;
    lease.restore();

    assert.strictEqual(document.activeElement, second);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].preventScroll, true);
  });

  it('never steals unrelated focus when moving or restoring borrowed content', function () {
    const {node, target} = fixture();
    const child = document.createElement('input');
    const outside = document.createElement('input');
    node.append(child);
    document.body.append(outside);
    child.focus();
    const lease = new Lease(node, {position: true});
    const insertion = target.insertBefore.bind(target);
    target.insertBefore = function (moved, sibling) {
      const result = insertion(moved, sibling);
      outside.focus();
      return result;
    };

    lease.moveTo(target);
    assert.strictEqual(document.activeElement, outside);
    lease.restore();
    assert.strictEqual(document.activeElement, outside);
  });

  it('does not call focus again when a move leaves the focused descendant in place', function () {
    const {original, node, after} = fixture();
    const child = document.createElement('input');
    node.append(child);
    child.focus();
    const focus = child.focus.bind(child);
    let calls = 0;
    child.focus = function (options) { calls++; return focus(options); };
    const lease = new Lease(node, {position: true});

    lease.moveTo(original, after);
    assert.strictEqual(document.activeElement, child);
    assert.strictEqual(calls, 0);
    lease.restore();
    assert.strictEqual(document.activeElement, child);
    assert.strictEqual(calls, 0);
    assert.strictEqual(lease.released, true);
  });
});
