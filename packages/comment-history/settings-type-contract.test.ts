// Compile-time API contract; never executed in production.
import {
  SettingsStore,
  normalizeSettings,
  type CommentIncreaseSettings,
  type CommentSettingsStoreAdapter
} from './typescript-src/settings';

const prefs:CommentIncreaseSettings=normalizeSettings({
  maxAdditionalComments:5000,includeEasy:false
});
const io:CommentSettingsStoreAdapter={
  read:()=>null,
  write:()=>{}
};
const store=new SettingsStore(io);
const next:CommentIncreaseSettings=store.patch({maxRetries:2,includeEasy:true});
void prefs;void next;
// @ts-expect-error count must be a number
store.patch({maxAdditionalComments:'5000'});
// @ts-expect-error easy-comment selection must be boolean
normalizeSettings({includeEasy:1});
// @ts-expect-error old unsupported setting keys are not part of schema
store.patch({writePassword:'secret'});
// @ts-expect-error storage must use read and write
new SettingsStore({getItem:()=>null});
