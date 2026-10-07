'use strict';

const assert = require('assert');
const path = require('path');
const {ESLint} = require('eslint');
const project = path.resolve(__dirname, '../..');

const probes = [
  ['optional chaining and nullish coalescing',
    'const value = source?.nested ?? fallback;\n'],
  ['private class fields',
    'class Counter { #count = 0; value() { return this.#count; } }\n'],
  ['class static blocks',
    'class Counter { static count; static { this.count = 1; } }\n']
];

describe('Task247 / Task298 ESLint modern syntax parsing', () => {
  for (const configFile of [null, '.eslintrc', '.eslintrc.js']) {
    const configName = configFile || 'project config';
    for (const [name, code] of probes) {
      it(`${configName}: parses ${name}`, async () => {
        const eslint = new ESLint({
          cwd: project,
          useEslintrc: !configFile,
          ...(configFile ? {overrideConfigFile: path.join(project, configFile)} : {})
        });
        const [result] = await eslint.lintText(code, {
          filePath: 'src/task298-modern-syntax-probe.js'
        });
        assert.deepStrictEqual(result.messages.filter(message => message.fatal), []);
      });
    }
  }

  it('still rejects invalid syntax with the project config', async () => {
    const eslint = new ESLint({cwd: project});
    const [result] = await eslint.lintText('const value = ;\n', {
      filePath: 'src/task298-invalid-syntax-probe.js'
    });
    assert.strictEqual(result.fatalErrorCount, 1);
  });
});
