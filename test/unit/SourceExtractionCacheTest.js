import assert from 'power-assert';
const fs = require('fs');
const parser = require('@babel/parser');
const {extract, createContext, loadClass} = require('../helpers/extractSource');

describe('ソース抽出の反復コストと独立性（H-04 / Task108）', function() {
  const rel = 'test/virtual-source-extraction.js';
  let source, parses, oldRead, oldParse;
  beforeEach(function() {
    source = 'class Subject { constructor() { this.values = []; } } const value = 1;';
    parses = 0;
    oldRead = fs.readFileSync; oldParse = parser.parse;
    fs.readFileSync = function(file, ...args) {
      if (String(file).replace(/\\/g, '/').endsWith(rel)) return source;
      return oldRead.call(this, file, ...args);
    };
    parser.parse = function(...args) { parses++; return oldParse.apply(this, args); };
  });
  afterEach(function() { fs.readFileSync = oldRead; parser.parse = oldParse; });
  it('同じ内容のクラスを60回取り出しても解析を繰り返さない', function() {
    const first = extract(rel, 'Subject');
    for (let i=0; i<59; i++) assert.equal(extract(rel, 'Subject'), first);
    assert.equal(parses, 1);
  });
  it('同じパスのソースを書き換えたら、同じ長さの変更も反映する', function() {
    assert.equal(extract(rel, 'value', 'var'), '1');
    source = source.replace('value = 1', 'value = 2');
    assert.equal(extract(rel, 'value', 'var'), '2');
    source = 'const other = 3;';
    assert.throws(() => extract(rel, 'value', 'var'), /見つからない/);
  });
  it('実行するクラスとインスタンスはコンテキスト間で共有しない', function() {
    const A=loadClass(rel,'Subject',createContext());
    const B=loadClass(rel,'Subject',createContext());
    const a=new A(), b=new B(); a.values.push('A');
    assert.notEqual(A,B); assert.equal(b.values.length,0);
  });
});
