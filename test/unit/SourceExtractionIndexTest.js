'use strict';
const assert = require('assert');
const fs = require('fs');
const parser = require('@babel/parser');
const {extract, createContext, loadClass} = require('../helpers/extractSource');
let serial = 0;

describe('Task408 source extraction per-content symbol index', () => {
  let rel, source, parses, readOriginal, parseOriginal;
  beforeEach(() => {
    rel = 'test/virtual-extraction-index-' + (++serial) + '.js';
    source = 'class Alpha { value() { return 1; } } class Beta {} const answer = 42;';
    parses = 0;
    readOriginal = fs.readFileSync;
    parseOriginal = parser.parse;
    fs.readFileSync = function(file, ...args) {
      if (String(file).replace(/\\/g, '/').endsWith(rel)) { return source; }
      return readOriginal.call(this, file, ...args);
    };
    parser.parse = function(...args) {
      parses++;
      return parseOriginal.apply(this, args);
    };
  });
  afterEach(() => {
    fs.readFileSync = readOriginal;
    parser.parse = parseOriginal;
  });
  it('parses once for different classes and variable initializers in one file', () => {
    assert.strictEqual(extract(rel, 'Alpha'), 'class Alpha { value() { return 1; } }');
    assert.strictEqual(extract(rel, 'Beta'), 'class Beta {}');
    assert.strictEqual(extract(rel, 'answer', 'var'), '42');
    assert.strictEqual(parses, 1);
  });
  it('does not reparse missing symbols, but still reports each missing request', () => {
    extract(rel, 'Alpha');
    assert.throws(() => extract(rel, 'Missing'), /Missing/);
    assert.throws(() => extract(rel, 'Missing', 'var'), /Missing/);
    assert.strictEqual(extract(rel, 'answer', 'var'), '42');
    assert.strictEqual(parses, 1);
  });
  it('invalidates both positive and negative lookups on equal-length content edits', () => {
    assert.strictEqual(extract(rel, 'answer', 'var'), '42');
    assert.throws(() => extract(rel, 'Gamma'), /Gamma/);
    source = source.replace('Alpha', 'Gamma').replace('42', '43');
    assert.strictEqual(extract(rel, 'answer', 'var'), '43');
    assert(extract(rel, 'Gamma').startsWith('class Gamma'));
    assert.throws(() => extract(rel, 'Alpha'), /Alpha/);
    assert.strictEqual(parses, 2);
  });
  it('preserves first-declaration behavior and separates class from variable names', () => {
    source = 'function a() { class Same { value() { return 1; } } const SameValue = 1; } ' +
      'function b() { class Same { value() { return 2; } } const SameValue = 2; } const Same = 3;';
    assert.strictEqual(extract(rel, 'Same'), 'class Same { value() { return 1; } }');
    assert.strictEqual(extract(rel, 'SameValue', 'var'), '1');
    assert.strictEqual(extract(rel, 'Same', 'var'), '3');
    assert.strictEqual(parses, 1);
  });
  it('ignores unrelated destructuring and uninitialized variables while indexing', () => {
    source = 'let empty; const {value} = {}; class Alpha {} const answer = 42;';
    assert.strictEqual(extract(rel, 'Alpha'), 'class Alpha {}');
    assert.strictEqual(extract(rel, 'answer', 'var'), '42');
    assert.throws(() => extract(rel, 'empty', 'var'), TypeError);
    assert.strictEqual(parses, 1);
  });
  it('rejects broken syntax without retaining stale symbols, and recovers', () => {
    assert.strictEqual(extract(rel, 'answer', 'var'), '42');
    source = 'class Broken {';
    assert.throws(() => extract(rel, 'answer', 'var'), SyntaxError);
    source = 'class Repaired {} const answer = 43;';
    assert.strictEqual(extract(rel, 'answer', 'var'), '43');
    assert.strictEqual(extract(rel, 'Repaired'), 'class Repaired {}');
    assert.strictEqual(parses, 3);
  });
  it('reuses text offsets without sharing evaluated classes or mutable VM state', () => {
    source = 'class Alpha { constructor() { this.values = []; } } class Beta {}';
    const A = loadClass(rel, 'Alpha', createContext());
    const B = loadClass(rel, 'Alpha', createContext());
    extract(rel, 'Beta');
    const a = new A(), b = new B();
    a.values.push('private');
    assert.notStrictEqual(A, B);
    assert.strictEqual(b.values.length, 0);
    assert.strictEqual(parses, 1);
  });
});
