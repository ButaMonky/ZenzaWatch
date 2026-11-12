const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'../../dist',name),'utf8');
test('companion is a launcher without a second player or HLS dependency',()=>{
 const source=read('ZenzaBlogPartsButton.user.js');
 assert.ok(Buffer.byteLength(source)<250000);
 assert.ok(!source.includes('class NicoVideoPlayer'));
 assert.ok(!source.includes('const monkey = async'));
 assert.ok(!source.includes('// @require'));
 assert.ok(source.includes('createMainPlayerClient'));
});
test('main owns exactly one runtime and provides isolated authenticated playback',()=>{
 const source=read('ZenzaWatch-dev.user.js');
 assert.equal(source.split('const monkey = async').length,2);
 assert.ok(source.includes('installMainPlayerProvider(window,externalTrial'));
 assert.ok(source.includes('externalTrial.gm=createGmNetwork'));
 assert.ok(source.includes('return runRuntime(window,externalTrial)'));
});
