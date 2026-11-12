'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {stripTypeScriptTypes} = require('node:module');
function generate(check = false) {
  const base = path.resolve(__dirname, '../packages/zenza/src/menu/WatchClickNavigation');
  const source = fs.readFileSync(base + '.ts', 'utf8');
  const body = stripTypeScriptTypes(source).replace(/^export \{WatchClickNavigation\};\s*$/m, '');
  const output = '// Generated from WatchClickNavigation.ts; run node tools/generate-watch-click-navigation.cjs\n//===BEGIN===\n' + body.trim() + '\n//===END===\nexport {WatchClickNavigation};\n';
  if (check) {
    if (fs.readFileSync(base + '.js', 'utf8').replace(/\r\n/g, '\n') !== output.replace(/\r\n/g, '\n')) throw Error('WatchClickNavigation runtime is stale');
  } else fs.writeFileSync(base + '.js', output);
}
if (require.main === module) generate(process.argv.includes('--check'));
module.exports = {generate};
