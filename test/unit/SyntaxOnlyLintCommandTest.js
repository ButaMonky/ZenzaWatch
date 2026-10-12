'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {ESLint} = require('eslint');
function command() {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
  assert.strictEqual(typeof pkg.scripts['lint:syntax'], 'string', 'provide the preserved syntax-only command');
  return pkg.scripts['lint:syntax'];
}
function engine() {
  command();
  return new ESLint({useEslintrc:false, ignore:false, overrideConfig:{
    env:{es2022:true, node:true, browser:true}, parserOptions:{sourceType:'module'}
  }});
}
describe('Task417 preserved non-writing syntax gate', () => {
  it('checks all src/packages JavaScript without automatic fixes or rule config', () => {
    assert.strictEqual(command(), 'eslint --no-eslintrc --env es2022,node,browser --parser-options "sourceType: module" --ext .js ./src ./packages');
    assert(!/--fix(?:\s|=|$)/.test(command()));
  });
  it('accepts supported ES2022 syntax independently of style rules', async () => {
    const [result] = await engine().lintText('export class Clock { #value = 0; static { this.ready = true; } read(x) { return x?.value ?? this.#value; } }', {filePath:'src/task417-fixture.js'});
    assert.strictEqual(result.errorCount, 0);
    assert.strictEqual(result.warningCount, 0);
  });
  it('still rejects invalid JavaScript', async () => {
    const [result] = await engine().lintText('export const broken = ;', {filePath:'src/task417-fixture.js'});
    assert(result.fatalErrorCount > 0);
    assert(result.errorCount > 0);
  });
});
