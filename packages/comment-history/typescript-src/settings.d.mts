import type {CommentIncreaseSettings,CommentSettingName} from './settings.ts';
export declare const SETTINGS_SCHEMA: readonly {
  name: CommentSettingName;
  key: string;
  default: number | boolean;
}[];
export declare const DEFAULT_SETTINGS: Readonly<CommentIncreaseSettings>;
export declare function normalizeSettings(
  input?: Partial<CommentIncreaseSettings>
): CommentIncreaseSettings;
export type {CommentIncreaseSettings,CommentSettingName} from './settings.ts';
