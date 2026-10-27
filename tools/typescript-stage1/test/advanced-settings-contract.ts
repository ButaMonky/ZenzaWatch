// Task453: strict *public type contract* of all five advanced-settings modules.
// Legacy internal implementation has not yet achieved full strict checking.
import {
  type AdvancedSettingsDescriptor,type AdvancedSettingsValue,
  ModernAdvancedSettingsModel
} from '../.generated/advanced/ModernAdvancedSettingsModel';
import {
  UiVisibilityRegistry,type UiVisibilityScope,type UiVisibilityDescriptor
} from '../.generated/advanced/UiVisibilityRegistry';
import {
  ModernAdvancedSettingsUI,type AdvancedSettingsUiDependencies
} from '../.generated/advanced/ModernAdvancedSettingsUI';
import {
  type AdvancedSettingsStorageKey,type AdvancedSettingsStoredValue
} from '../.generated/advanced/Config';
import {type AdvancedSettingsPanelMode} from '../.generated/advanced/_setting';

const descriptor:AdvancedSettingsDescriptor={
  id:'screenMode',label:'Display',category:'Screen',subcategory:'Mode',
  type:'select',description:'test'
};
const settingValue:AdvancedSettingsValue='screenMode';
const storageKey:AdvancedSettingsStorageKey='sceneSearch.layout.normal';
const stored:AdvancedSettingsStoredValue=3;
const mode:AdvancedSettingsPanelMode='modern';
const scope:UiVisibilityScope='bar';
const ui:UiVisibilityDescriptor={
  key:'ui.bar.time',scope,label:'Time',icon:'clock',selector:'.videoTime'
};
const clone:AdvancedSettingsDescriptor=ModernAdvancedSettingsModel._clone(descriptor);
const identical:boolean=ModernAdvancedSettingsModel._same(settingValue,stored);
const category:[string,string]=ModernAdvancedSettingsModel.categoryFor(storageKey,null);
const visible:boolean=UiVisibilityRegistry.isVisibilityKey(ui.key);
const formatted:string=ModernAdvancedSettingsUI._formatNgUserIds(['user','test']);
const hex:string|null=ModernAdvancedSettingsUI._hexColor('red');
declare const typedModel: ModernAdvancedSettingsModel;
const deps:AdvancedSettingsUiDependencies={
  panel:document.createElement('div'),legacyRoot:null,model:typedModel,storage:localStorage,
  onClose:()=>{},confirm:()=>true,
  formatKeyCombo:code=>String(code),encodeKeyCombo:event=>event.keyCode
};
const invalidUiModel:AdvancedSettingsUiDependencies={
  panel:document.createElement('div'),
  // @ts-expect-error The advanced UI requires the typed settings model.
  model:{}
};
void invalidUiModel;
void clone;void identical;void category;void visible;void formatted;void hex;void deps;void mode;

const invalidDescriptor:AdvancedSettingsDescriptor={
  // @ts-expect-error Descriptor requires a string id.
  id:99,label:'Invalid',category:'A',subcategory:'B'
};
void invalidDescriptor;
// @ts-expect-error Visibility scopes form a fixed union.
const invalidScope:UiVisibilityScope='modal';
void invalidScope;
// @ts-expect-error The canonical clone type must preserve the given type.
ModernAdvancedSettingsModel._clone<string>(99);
// @ts-expect-error A category key is not a number.
ModernAdvancedSettingsModel.categoryFor(12);
// @ts-expect-error Visibility keys are strings.
UiVisibilityRegistry.isVisibilityKey(42);
// @ts-expect-error The UI visibility state is boolean.
ModernAdvancedSettingsUI.prototype.setModalVisible('yes');
// @ts-expect-error Only supported advanced panel variants.
const invalidMode:AdvancedSettingsPanelMode='classic';
void invalidMode;
