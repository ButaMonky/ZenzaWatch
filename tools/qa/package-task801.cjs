'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),marker='// ==/UserScript==';
for(const [file,version] of [['ZenzaWatch-dev.user.js','2.7.313-task801'],['ZenzaAdvancedSettings.user.js','0.3.65-task801']]){
 const source=fs.readFileSync(path.join(root,'dist',file),'utf8'),end=source.indexOf(marker);
 if(end<0||!new RegExp('^// @version\\s+'+version.replace(/\./g,'\\.')+'$','m').test(source))throw Error('Unexpected build '+file);
 if(file==='ZenzaWatch-dev.user.js'&&!source.includes("var VER = '2.7.313-task801'"))throw Error('Startup version mismatch');
 const output='review/task801/'+file,url='https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/refs/heads/publication/task801-scui-preview-settings/'+output;
 let header=source.slice(0,end);
 for(const key of ['downloadURL','updateURL']){
  const re=new RegExp('^// @'+key+'[^\\r\\n]*','gm');
  if((header.match(re)||[]).length!==1)throw Error('Expected one '+key+' in '+file);
  header=header.replace(re,'// @'+key+'    '+url);
 }
 const packaged=header+source.slice(end),target=path.join(root,output);
 if(packaged.slice(packaged.indexOf(marker))!==source.slice(end))throw Error('Executable body changed');
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,packaged);
 console.log(JSON.stringify({output,url,sha256:crypto.createHash('sha256').update(packaged).digest('hex'),bodyIdentical:true}));
}
