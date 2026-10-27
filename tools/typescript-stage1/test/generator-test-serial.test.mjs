// Task513: do not reintroduce parallel writes into the shared Nico TS emit folder.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const toolRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(readFileSync(resolve(toolRoot,'package.json'),'utf8'));

test('test runner serializes files that emit to shared .generated/nico',()=>{
  assert.match(pkg.scripts.test,/node\s+--test\s+--test-concurrency=1\s+test\/\*\.test\.mjs/);
  assert.match(pkg.scripts['verify:legacy'],/nico:verify/);
});
