// Task524: both accepted and rejected public Zenza settings contracts.
import {
  ZenzaSettingsRepository,
  type FeatureStorage,
  type FeatureChangeBus,
  type ZenzaSettingsSnapshot
} from './zenza-settings-src/zenza-settings';
const storage:FeatureStorage={
  getItem:()=>null,
  setItem:()=>{},
  removeItem:()=>{}
};
const bus:FeatureChangeBus={
  subscribe:()=>()=>{},
  publish:()=>{}
};
const store=new ZenzaSettingsRepository({storage,prefix:'ZenzaWatch_',bus});
const settings:ZenzaSettingsSnapshot=store.get();
const next:ZenzaSettingsSnapshot=store.patch({
  maxAdditionalComments:7500,
  maxRetries:2,
  includeEasy:false
});
const reset:ZenzaSettingsSnapshot=store.reset(['includeEasy']);
const off:()=>void=store.subscribe((current:ZenzaSettingsSnapshot)=>{
  const count:number=current.maxAdditionalComments;
  void count;
});
off();
store.dispose();
void settings;void next;void reset;

// @ts-expect-error Invalid setting type must not be accepted.
store.patch({maxPages:'50'});
// @ts-expect-error Feature-only update: unrelated volume is never valid.
store.patch({volume:0.5});
// @ts-expect-error reset keys belong to known comment-history settings only.
store.reset(['ZenzaWatch_volume']);
// @ts-expect-error A storage adapter needs write and delete methods.
new ZenzaSettingsRepository({storage:{getItem:()=>null}});
// @ts-expect-error Notifications must include named changed keys.
const badBus:FeatureChangeBus={subscribe:()=>()=>{},publish:(message:{type:number})=>{}};
void badBus;
