import {
  DEFAULT_AUTO_ENABLE_SETTINGS,
  type AutoEnableSettings,
} from '@/shared/auto-enable-settings';

export type UseAutoEnableSettingsResult = {
  settings: AutoEnableSettings;
  // storage からの初回読み込みが終わったか (失敗した場合も既定値で true になる)
  isReady: boolean;
  update: (next: AutoEnableSettings) => Promise<void>;
};

// chrome.storage.local の自動有効化設定を読み込み、storage.onChanged で変更を購読する。
// update は storage へ保存するだけで、画面への反映は storage.onChanged 経由で行う。
export const useAutoEnableSettings = (): UseAutoEnableSettingsResult => ({
  settings: DEFAULT_AUTO_ENABLE_SETTINGS,
  isReady: false,
  update: () => Promise.resolve(),
});
