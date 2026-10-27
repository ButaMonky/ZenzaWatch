import type {CommentIncreaseSettings} from './settings.ts';
export interface CommentHistoryStorage {
  getItem(key: string): string | null;
  setItem(key: string,value: string): void;
  removeItem(key: string): void;
}
export declare class ZenzaSettingsRepository {
  constructor(options:{
    storage: CommentHistoryStorage;
    prefix?: string;
  });
  get(): CommentIncreaseSettings;
  patch(changes: Partial<CommentIncreaseSettings>): CommentIncreaseSettings;
  dispose(): void;
}
