'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../..');
const DATA=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/research/api_catalog.json'),'utf8'));
const CLI=path.join(ROOT,'tools/research_lookup.py');

function python(args,{inline=false}={}){
 const options=process.platform==='win32'?['python','py']:['python3','python'];
 let result;
 for(const bin of options){
  const cmdArgs=inline?args:[CLI,...args];
  const argv=bin==='py'?['-3',...cmdArgs]:cmdArgs;
  result=spawnSync(bin,argv,{cwd:ROOT,encoding:'utf8',timeout:40000,
   env:{...process.env,PYTHONIOENCODING:'utf-8',PYTHONUTF8:'1'}});
  if(!result.error||result.error.code!=='ENOENT')return result;
 }
 return result;
}
function query(args){
 const result=python([...args,'--json']);
 assert.strictEqual(result.status,0,
  'lookup '+args.join(' ')+' failed: '+result.stderr);
 return JSON.parse(result.stdout);
}
const record=id=>DATA.entries.find(x=>x.id===id);
describe('Task969: offline API research catalog',function(){
 this.timeout(60000);
 it('lists 40+ cited operations across 11 categories',()=>{
  assert(DATA.entries.length>=40);
  assert.strictEqual(new Set(DATA.entries.map(x=>x.id)).size,DATA.entries.length);
  for(const group of ['search','tags','comments','video','likes','playlist',
   'mylist','dictionary','commons','history','ranking']){
    assert(DATA.entries.some(x=>x.category===group),group);
  }
  for(const x of DATA.entries){
   assert(x.sources.length>0,x.id);
   assert(x.caveats.length>0,x.id);
   assert(x.keywords.length>0,x.id);
   for(const s of x.sources){
    assert(fs.existsSync(path.join(ROOT,s.path)),x.id+': source missing '+s.path);
   }
  }
 });
 it('validates every source anchor and dependency without network',()=>{
  const check=python(['--validate']);
  assert.strictEqual(check.status,0,check.stderr||check.stdout);
  assert(check.stdout.includes('entries='+DATA.entries.length));
  assert(check.stdout.includes('offline=yes'));
 });
 it('distinguishes POST used for reading from actual comment creation',()=>{
  const reading=record('comment.read'),posting=record('comment.post');
  assert.strictEqual(reading.method,'POST');
  assert.strictEqual(reading.action,'read');
  assert.strictEqual(posting.method,'POST');
  assert.strictEqual(posting.action,'write');
  assert.strictEqual(posting.auth,'authorized');
  assert(posting.depends_on.includes('comment.post-key'));
  assert(posting.caveats.some(c=>c.includes('再送')));
 });
 it('prioritizes tag deletion, not unrelated comment deletion',()=>{
  const r=query(['タグ','削除','--limit','5']).matches;
  assert.strictEqual(r[0].id,'tags.delete');
  assert.strictEqual(r[0].method,'DELETE');
  assert(r[0].sources[0].line>0);
 });
 it('prioritizes comment posting and shows its key dependency',()=>{
  const r=query(['コメント','投稿','--limit','5']).matches;
  assert.strictEqual(r[0].id,'comment.post');
  const more=query(['--id','comment.post','--related']).matches;
  assert.deepStrictEqual(more.map(x=>x.id),['comment.post','comment.post-key']);
 });
 it('indexes search, tag suggestions, like counters, nicoru and watch-later',()=>{
  const samples=[['検索','search.video'],['タグ候補','search.suggest'],
   ['いいね数','video.likes-and-owner'],['ニコる','comment.nicoru'],
   ['あとで見る','watchlater.items']];
  for(const [search,expected] of samples){
   const ids=query([search,'--limit','100']).matches.map(x=>x.id);
   assert(ids.includes(expected),search+': missing '+expected);
  }
 });
 it('keeps live/current observations distinct from source-only knowledge',()=>{
  for(const x of DATA.entries){
   if(x.verification==='live_get'){
    assert.strictEqual(x.method,'GET');
    assert.strictEqual(x.verified_on,'2026-10-27');
   }
   if(x.verification==='code')assert.strictEqual(x.verified_on,null);
   if(x.action==='write')assert.strictEqual(x.auth,'authorized');
  }
 });
 it('returns bounded document excerpts instead of flooding context',()=>{
  const r=query(['投稿者','アイコン','--docs','--limit','3']);
  assert(r.documents.length>=1&&r.documents.length<=3);
  for(const doc of r.documents){
   assert(doc.path.startsWith('docs/'));
   assert(doc.excerpt.length<=190);
   assert(doc.line>0);
   assert(!doc.excerpt.includes('C:\\Users\\'));
  }
 });
 it('derives Markdown from the single JSON source, with no drift',()=>{
  const res=python(['--generate-markdown']);
  assert.strictEqual(res.status,0,res.stderr);
  const committed=fs.readFileSync(path.join(ROOT,'docs/research/API_QUICK_REFERENCE.md'),'utf8');
  assert.strictEqual(res.stdout.replace(/\r\n/g,'\n'),committed.replace(/\r\n/g,'\n'));
  for(const id of ['tags.add','tags.delete','comment.read','comment.post',
   'video.likes-and-owner','video.owner.nicoad'])assert(committed.includes(id));
 });
 it('has discoverable entrypoints and no dangerous live API execution',()=>{
  const agents=fs.readFileSync(path.join(ROOT,'AGENTS.md'),'utf8');
  const intro=fs.readFileSync(path.join(ROOT,'docs/research/README.md'),'utf8');
  const raw=fs.readFileSync(path.join(ROOT,'docs/research/api_catalog.json'),'utf8');
  assert(agents.includes('tools/research_lookup.py'));
  assert(intro.includes('api_catalog.json'));
  assert(!/C:\\Users\\/i.test(raw));
  assert(!/Bearer\s+[a-zA-Z0-9_-]{20,}/i.test(raw));
  const code=fs.readFileSync(CLI,'utf8');
  assert(!/urllib\.request|requests\.get|urlopen\(/.test(code));
 });
 it('recognizes natural-language API queries and prioritizes the matching operation',()=>{
  const expected=[
   ['タグ登録 API','tags.add'],
   ['コメントを投稿','comment.post'],
   ['動画検索','search.video'],
   ['検索API','search.video'],
   ['ニコる','comment.nicoru'],
   ['いいね解除','like.delete'],
   ['投稿者不明','video.owner.nicoad']
  ];
  for(const [term,id] of expected){
   const matches=query([term,'--limit','5']).matches;
   assert.strictEqual(matches[0].id,id,term);
  }
  const tagResults=query(['タグ登録 API','--limit','100']).matches;
  assert(!tagResults.some(x=>x.id==='like.add'),'unrelated POST must not match tag registration');
  const likeResults=query(['いいね解除','--limit','100']).matches;
  assert(!likeResults.some(x=>x.id==='tags.delete'),'unrelated DELETE must not match unlike');
 });
 it('can search original documents even before an API gets cataloged',()=>{
  const found=query(['HLS','--docs','--limit','3']);
  assert.strictEqual(found.matches.length,0);
  assert(found.documents.length>0);
  assert(found.documents.every(x=>x.path.startsWith('docs/')&&x.line>0));
 });
 it('suppresses fake credentials and personal paths in isolated document fixtures',()=>{
  const script=[
   'import sys,tempfile',
   'from pathlib import Path',
   'sys.path.insert(0, '+JSON.stringify(path.join(ROOT,'tools'))+')',
   'import research_lookup as r',
   'with tempfile.TemporaryDirectory() as tmp:',
   '    r.ROOT=Path(tmp)',
   '    folder=r.ROOT/"docs"/"research"',
   '    folder.mkdir(parents=True)',
   '    (folder/"fixture.md").write_text("動画検索 Cookie: FAKE\\n動画検索 Bearer FAKE\\n動画検索 user@example.org\\n動画検索 C:/Users/Test/private\\n動画検索 公開APIの説明",encoding="utf8")',
   '    found=r.find_docs(["検索"],5)',
   '    assert len(found)==1,found',
   '    assert found[0]["line"]==5,found',
   '    assert found[0]["excerpt"]=="動画検索 公開APIの説明",found'
  ].join('\n');
  const result=python(['-c',script],{inline:true});
  assert.strictEqual(result.status,0,result.stderr);
 });
 it('rejects an impossible verification date, insecure URL and read/write confusion',()=>{
  const script=[
   'import sys,copy',
   'sys.path.insert(0, '+JSON.stringify(path.join(ROOT,'tools'))+')',
   'import research_lookup as r',
   'base=r.load()',
   'bad=copy.deepcopy(base)',
   'bad["entries"][0]["verified_on"]="2026-02-30"',
   'assert any("valid observation date" in x for x in r.validate(bad))',
   'bad=copy.deepcopy(base)',
   'bad["entries"][0]["url"]="http://unsafe.example/"',
   'assert any("unsafe or malformed endpoint" in x for x in r.validate(bad))',
   'bad=copy.deepcopy(base)',
   'bad["entries"][0]["action"]="write"',
   'assert any("mutating operation" in x for x in r.validate(bad))'
  ].join('\n');
  const result=python(['-c',script],{inline:true});
  assert.strictEqual(result.status,0,result.stderr);
 });

 it('public references never depend on nonpublic TypeScript research sources',()=>{
  const sourcePaths=DATA.entries.map(x=>x.sources[0].path);
  const observations=DATA.entries.filter(x=>
   x.sources[0].path==='docs/research/API_OBSERVATIONS.md').map(x=>x.id);
  assert.deepStrictEqual(observations,['video.likes-and-owner','video.owner.icon-cdn']);
  for(const x of sourcePaths){
   assert(!x.startsWith('tools/typescript-stage1/'),x);
   assert(!x.startsWith('C:')&&!x.includes('\\\\Users\\\\'),x);
   assert(x.startsWith('packages/lib/src/nico/')||
     x==='docs/research/API_OBSERVATIONS.md',x);
  }
 });
});
