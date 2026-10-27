// Task514: compile-only contract for the localStorage browser bridge.
import {
  createBrowserHistoryPreferences,
  type BrowserHistoryConfig,
  type BrowserHistorySnapshot
} from './browser-preferences';

const config: BrowserHistoryConfig={
  default:{'commentHistory.enabled':false},
  _data:{'commentHistory.enabled':false},
  emit:()=>undefined
};
const bridge=createBrowserHistoryPreferences({config});
const snapshot: BrowserHistorySnapshot=bridge.get();
const enabled: boolean=snapshot.enabled;
const commentCount: number=snapshot.settings.maxAdditionalComments;
bridge.patch({maxPages:10,includeEasy:true});
bridge.setEnabled(false);
const off:()=>boolean=bridge.subscribe(state=>{
  const valid:boolean=state.valid;void valid;
});
off();
void commentCount;void enabled;
// @ts-expect-error enabled must be a boolean.
bridge.setEnabled('yes');
// @ts-expect-error no unrelated global config keys.
bridge.patch({volume:0.4});
// @ts-expect-error valid settings have numeric page limits.
bridge.patch({maxPages:'100'});
// @ts-expect-error Config should not accept untyped direct state.
const badConfig: BrowserHistoryConfig={_data:1};
void badConfig;
// @ts-expect-error subscriber receives a snapshot, not a raw string.
bridge.subscribe((value: string)=>value.length);
