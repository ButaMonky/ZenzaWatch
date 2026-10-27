// Task453: explicitly owned advanced settings modules, no user-supplied paths.
export const ADVANCED_MODULES=Object.freeze([
  'ModernAdvancedSettingsModel',
  'ModernAdvancedSettingsUI',
  'UiVisibilityRegistry',
  'Config',
  '_setting',
  'ScreenshotFileName',
  'RelatedMenuOrder',
  'RelatedMenuSettings',
  'NgCompositeRules',
  'NgCompositeRuleEditor'
].map(name=>Object.freeze({
  name,
  source:'tools/typescript-stage1/advanced-src/'+name+'.ts',
  emitted:'tools/typescript-stage1/.generated/advanced/'+name+'.js',
  runtime:'src/'+name+'.js',
  manifest:'tools/typescript-stage1/advanced-manifests/'+name+'.json'
})));
