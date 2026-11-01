'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {staticValue,labeledStyle}=require('../../test/helpers/nativeCssFixture.cjs');
test('extracts a trimmed template without swallowing subsequent code',()=>{
  const source='A.__css__ = ` .a{opacity:1} `.trim(); A.__tpl__ = `<div/>`;';
  assert.equal(staticValue(source,'A.__css__'),'.a{opacity:1}');
});
test('handles parenthesized trim and interpolation',()=>{
  const source='A.__css__ = (`.a{width:${CONSTANT.W}px}`).trim();';
  assert.equal(staticValue(source,'A.__css__',{CONSTANT:{W:320}}),'.a{width:320px}');
});
test('does not confuse literal delimiters with escaped template content',()=>{
  const source='A.__css__ = `/* \\`); */ .a{height:30px}`;';
  assert.equal(staticValue(source,'A.__css__'),'/* `); */ .a{height:30px}');
});
test('selects only the exact style label and preserves full CSS',()=>{
  const source='css.addStyle(`.x{opacity:0}`, {className:"full"}); css.addStyle(`.y{opacity:1}`,{className:"dialog"});';
  assert.equal(labeledStyle(source,'dialog'),'.y{opacity:1}');
});
test('missing or duplicated assignment fails closed',()=>{
  assert.throws(()=>staticValue('A.__css__="a";A.__css__="b";','A.__css__'),/unique/);
  assert.throws(()=>staticValue('A.__tpl__="a";','A.__css__'),/unique/);
});
test('selects the owning class binding in a bundled lexical scope',()=>{
  const {bindingValue}=require('../../test/helpers/nativeCssFixture.cjs');
  const source='const value=1;(()=>{const value=2;class Target{}})();';
  assert.equal(bindingValue(source,'Target','value'),2);
});
