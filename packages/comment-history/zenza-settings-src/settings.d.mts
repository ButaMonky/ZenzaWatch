export interface ZenzaHistorySettings {
  maxAdditionalComments: number;
  maxPages: number;
  maxRequests: number;
  minIntervalMs: number;
  requestTimeoutMs: number;
  maxElapsedMs: number;
  maxRetries: number;
  maxKeyRefreshes: number;
  includeEasy: boolean;
}
export type ZenzaHistorySettingKey = keyof ZenzaHistorySettings;
export interface ZenzaHistorySettingField {
  name: ZenzaHistorySettingKey;
  key: string;
  default: number | boolean;
}
export declare const SETTINGS_SCHEMA: readonly ZenzaHistorySettingField[];
export declare function normalizeSettings(
  settings?: Partial<ZenzaHistorySettings>
): ZenzaHistorySettings;
