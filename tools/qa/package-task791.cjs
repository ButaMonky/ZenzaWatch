'use strict';
// Build first with tools/build_task_sandbox.js. Keep canonical dist reproducible;
// the review copy differs only in its two update/download metadata URLs.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'dist/ZenzaWatch-dev.user.js'),'utf8');
const output='review/task791/ZenzaWatch-dev.user.js';
const url='https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/refs/heads/publication/task791-scui02-twin-idle/'+output;
const marker='// ==/UserScript==';
const end=source.indexOf(marker);
if(end<0||!source.includes('// @version        2.7.304-scui02-twin-idle')||
   !/var VER\s*=\s*'2\.7\.304-scui02-twin-idle'/.test(source)){
  throw Error('Unexpected Task791 build or missing version/startup marker');
}
let header=source.slice(0,end);
for(const key of ['downloadURL','updateURL']){
  const re=new RegExp('^// @'+key+'[^\\r\\n]*','gm');
  if((header.match(re)||[]).length!==1)throw Error('Expected one '+key);
  header=header.replace(re,'// @'+key+'    '+url);
}
const packaged=header+source.slice(end);
if(packaged.slice(packaged.indexOf(marker))!==source.slice(end)){
  throw Error('Review packaging changed executable code');
}
const target=path.join(root,output);
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,packaged);
const sha=crypto.createHash('sha256').update(packaged).digest('hex');
console.log(JSON.stringify({output,url,sha256:sha,bodyIdentical:true}));
