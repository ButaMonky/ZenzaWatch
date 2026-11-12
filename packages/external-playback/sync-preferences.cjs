// Keep generated main defaults/descriptors synchronized with the typed package.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
module.exports=function syncPreferences(write=false){
 const {externalDefaults,externalDescriptors}=require('./generated/settings');
 const config=path.join(root,'tools/typescript-stage1/advanced-src/Config.ts');
 const model=path.join(root,'tools/typescript-stage1/advanced-src/ModernAdvancedSettingsModel.ts');
 const source=fs.readFileSync(config,'utf8');
 const begin=source.indexOf('const DEFAULT_CONFIG: AdvancedSettingsDefaultMap = {')+'const DEFAULT_CONFIG: AdvancedSettingsDefaultMap = {'.length;
 const end=source.indexOf('    debug:',begin);
 if(begin<50||end<begin)throw Error('Config preference insertion changed');
 const next=source.slice(0,begin)+'\n'+JSON.stringify(externalDefaults).slice(1,-1)+',\n'+source.slice(end);
 const old=fs.readFileSync(model,'utf8');
 const method=/  static externalLinkSettings\(\): AdvancedModelDescriptor\[\] \{[\s\S]*?\n  static visibleExtraSettings/;
 if(!method.test(old))throw Error('Model preferences insertion changed');
 const descriptors=externalDescriptors.map(d=>{const copy={...d};delete copy.addCurrentSite;return copy;});
 const updated=old.replace(method,'  static externalLinkSettings(): AdvancedModelDescriptor[] {\n    return '+JSON.stringify(descriptors,null,2)+';\n  }\n\n  static visibleExtraSettings');
 for(const [file,before,after] of [[config,source,next],[model,old,updated]])if(before.replace(/\r\n/g,'\n')!==after.replace(/\r\n/g,'\n')){
  if(!write)throw Error('External preference schema drift: run node packages/external-playback/sync-preferences.cjs --write then advanced:emit/sync');
  fs.writeFileSync(file,after);
 }
};
if(require.main===module)module.exports(process.argv.includes('--write'));
