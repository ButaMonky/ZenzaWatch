'use strict';
const fs=require('fs'),path=require('path'),Module=require('module');
const root=path.resolve(__dirname,'../..');process.chdir(root);
const filename=path.join(root,'build.js'),marker='try {\n  run();';
let code=fs.readFileSync(filename,'utf8').replace(/\r\n/g,'\n');
if(!code.includes(marker))throw Error('Build entry changed');
code=code.replace(marker,"templates = [{src:'_template.js',dist:'experiments/click-area/ZenzaWatch-dev.user.js',dev:true},{src:'_blog.js',dist:'experiments/click-area/ZenzaBlogPartsButton.user.js',dev:false}];\n"+marker);
process.argv=['node',filename,'--dev'];
const compiled=new Module(filename,module);compiled.filename=filename;compiled.paths=Module._nodeModulePaths(root);compiled._compile(code,filename);
if(process.exitCode)throw Error('Production build failed');
const output=path.join(__dirname,'ZenzaWatch-dev.user.js');
const baseVersion=fs.readFileSync('src/_template.js','utf8').match(/^\/\/ @version\s+(\S+)/m)[1];
const result=fs.readFileSync(output,'utf8').replaceAll(baseVersion,'2.7.395-click-area1021.1')
 .replace(/^\/\/ @(downloadURL|updateURL)\s+.*$/mg,(_,key)=>'// @'+key+'    https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/ZenzaWatch-dev.user.js');
require('@babel/parser').parse(result,{sourceType:'script'});
fs.writeFileSync(output,result);
console.log('TRIAL_READY '+output);