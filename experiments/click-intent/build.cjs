'use strict';
// Reuse the production builder, changing only its output destination.
const fs=require('fs'),path=require('path'),Module=require('module');
const root=path.resolve(__dirname,'../..');process.chdir(root);
const output='experiments/click-intent/ZenzaWatch-click-trial-dev.user.js';
const filename=path.join(root,'build.js');
let code=fs.readFileSync(filename,'utf8');
const marker='try {\n  run();';
code=code.replace(/\r\n/g,'\n');
if(!code.includes(marker))throw Error('Build entry changed');
code=code.replace(marker,`templates = [{src:'_template.js',dist:${JSON.stringify(output)},dev:true},{src:'_pocket.js',dist:'experiments/click-intent/MylistPocket-hover-trial.user.js',dev:false}];\n${marker}`);
process.argv=['node',filename,'--dev'];
const compiled=new Module(filename,module);compiled.filename=filename;compiled.paths=Module._nodeModulePaths(root);compiled._compile(code,filename);
if(process.exitCode)throw Error('Production build failed');
let result=fs.readFileSync(output,'utf8').replaceAll('2.7.389-task1014','2.7.390-click1015.2');
const url='https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/fix/click-intent1015/'+output;
result=result.replace(/^\/\/ @(downloadURL|updateURL)\s+.*$/mg,(_,key)=>'// @'+key+'    '+url);
fs.writeFileSync(output,result);
console.log('TRIAL_READY '+output);

const pocket='experiments/click-intent/MylistPocket-hover-trial.user.js';
let pocketResult=fs.readFileSync(pocket,'utf8').replace(/^\/\/ @version\s+.*$/m,'// @version        0.5.89-hover1015.2');
const pocketUrl='https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/fix/click-intent1015/'+pocket;
pocketResult=pocketResult.replace(/^\/\/ @(downloadURL|updateURL)\s+.*$/mg,(_,key)=>'// @'+key+'    '+pocketUrl);
fs.writeFileSync(pocket,pocketResult);
