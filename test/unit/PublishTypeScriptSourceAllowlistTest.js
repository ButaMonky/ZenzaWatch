'use strict';
// Task910: accepted TypeScript sources must match the private publisher AND public scanner.
const assert = require('assert');
const path = require('path');
const {spawnSync} = require('child_process');
const {findPython} = require('../helpers/buildSandbox');

const root=path.resolve(__dirname,'../..');
const allow=[
  'tools/typescript-stage1/README.md',
  'tools/typescript-stage1/package.json',
  'tools/typescript-stage1/package-lock.json',
  'tools/typescript-stage1/.gitignore',
  'tools/typescript-stage1/.gitattributes',
  'tools/typescript-stage1/nico-src/VideoInfoLoader.ts',
  'tools/typescript-stage1/advanced-src/Config.ts',
  'tools/typescript-stage1/comment-src/CommentWriter.ts',
  'tools/typescript-stage1/src/RequestAnimationFrame.ts',
  'tools/typescript-stage1/nico-api-manifests/VideoInfoLoader.json',
  'tools/typescript-stage1/scripts/sync-nico-api.mjs',
  'tools/typescript-stage1/test/fixtures/BeforeMigration.js',
  'tools/typescript-stage1/test/suite/contracts.test.mjs',
  'tools/typescript-stage1/tsconfig.raf.contract.json',
  'tools/typescript-stage1/style-switcher-manifest.json'
];
const deny=[
  'tools/publish_common.ps1',
  'tools/typescript-stage1/.env',
  'tools/typescript-stage1/.npmrc',
  'tools/typescript-stage1/src/.private.ts',
  'tools/typescript-stage1/src/.generated-ts/generated.ts',
  'tools/typescript-stage1/nico-src/../outside.ts',
  'tools/typescript-stage1/nico-src/../../outside.ts',
  'tools/typescript-stage1/test/foo/../bar.js',
  'tools/typescript-stage1/test//hidden.ts',
  'tools/typescript-stage1/test/.cache/sample.ts',
  'tools/typescript-stage1/src/node_modules/pkg.ts',
  'tools/typescript-stage1/src/.git/credentials.ts',
  'tools/typescript-stage1/src/token.ts',
  'tools/typescript-stage1/nico-api-manifests/ClientSecret.json',
  'tools/typescript-stage1/scripts/helpers.ps1',
  'tools/typescript-stage1/test/network.har',
  'tools/typescript-stage1/test/shared-generator.test.mjs',
  '/tools/typescript-stage1/src/external.ts',
  'C:/tmp/tools/typescript-stage1/src/private.ts'
];
function pythonPolicy(paths){
  const py=findPython();
  assert(py,'Python must be available for release validation');
  const code=[
    'import sys,json',
    'sys.path.insert(0,sys.argv[1])',
    'from publish_policy import check_path',
    'print(json.dumps({p:check_path(p) for p in json.loads(sys.argv[2])}))'
  ].join('\n');
  const result=spawnSync(py.cmd,[...py.pre,'-c',code,path.join(root,'tools'),JSON.stringify(paths)],
    {encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8',PYTHONDONTWRITEBYTECODE:'1'}});
  assert.equal(result.status,0,result.stderr);
  return JSON.parse(result.stdout);
}
function psFiltered(paths){
  const quoted=s=>"'"+s.replace(/'/g,"''")+"'";
  const source=path.join(root,'tools','publish_common.ps1');
  const script='. '+quoted(source)+'; $v=@('+paths.map(quoted).join(',')+'); ConvertTo-Json -Compress -InputObject @(Get-PublicFiles $v)';
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],
    {encoding:'utf8',maxBuffer:1024*1024});
  assert.equal(result.status,0,result.stderr);
  const json=JSON.parse(result.stdout);
  return Array.isArray(json)?json.flat(Infinity):[json];
}
describe('Task910 non-UI TypeScript publication path security',function(){
  this.timeout(18000);
  before(function(){if(!findPython())this.skip();});
  it('allows only reviewed source, manifest, generator and type contract paths',()=>{
    const output=pythonPolicy(allow);
    for(const p of allow)assert.equal(output[p],null,'Denied expected source: '+p);
  });
  it('rejects traversal, hidden/generated files, credentials and unrelated tools',()=>{
    const output=pythonPolicy(deny);
    for(const p of deny)assert.notEqual(output[p],null,'Unsafe path accepted: '+p);
  });
  it('PowerShell publication list matches the Python allowlist',function(){
    if(process.platform!=='win32')this.skip();
    const paths=[...allow,...deny];
    const policy=pythonPolicy(paths);
    const expected=paths.filter(p=>policy[p]===null);
    assert.deepStrictEqual(psFiltered(paths),expected);
  });
});
