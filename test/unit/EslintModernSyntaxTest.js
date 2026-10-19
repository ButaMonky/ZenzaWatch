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

describe('Task247 / Task298 ESLint modern syntax parsing', function() {
  // First lint may resolve ESLint plugins/config under full-suite CPU load.
  this.timeout(10000);
  const byConfig = new Map();
  const getESLint = configFile => {
    if (!byConfig.has(configFile)) {
      byConfig.set(configFile, new ESLint({
        cwd: project,
        useEslintrc: !configFile,
        ...(configFile ? {overrideConfigFile: path.join(project, configFile)} : {})
      }));
    }
    return byConfig.get(configFile);
  };
  for (const configFile of [null, '.eslintrc', '.eslintrc.js']) {
    const configName = configFile || 'project config';
    for (const [name, code] of probes) {
      it(`${configName}: parses ${name}`, async () => {
        const eslint = getESLint(configFile);
        const [result] = await eslint.lintText(code, {
          filePath: 'src/task298-modern-syntax-probe.js'
        });
        assert.deepStrictEqual(result.messages.filter(message => message.fatal), []);
      });
    }
  }

  it('still rejects invalid syntax with the project config', async () => {
    const eslint = getESLint(null);
    const [result] = await eslint.lintText('const value = ;\n', {
      filePath: 'src/task298-invalid-syntax-probe.js'
    });
    assert.strictEqual(result.fatalErrorCount, 1);
  });
});
