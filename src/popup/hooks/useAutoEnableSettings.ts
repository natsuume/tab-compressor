import { useCallback, useEffect, useState } from 'react';
import {
  AUTO_ENABLE_SETTINGS_STORAGE_KEY,
  DEFAULT_AUTO_ENABLE_SETTINGS,
  loadAutoEnableSettings,
  normalizeAutoEnableSettings,
  saveAutoEnableSettings,
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
export const useAutoEnableSettings = (): UseAutoEnableSettingsResult => {
  const [settings, setSettings] = useState<AutoEnableSettings>(DEFAULT_AUTO_ENABLE_SETTINGS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadAutoEnableSettings().then((loaded) => {
      if (cancelled) return;
      setSettings(loaded);
      setIsReady(true);
    }).catch(() => {
      if (!cancelled) setIsReady(true);
    });

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void => {
      if (area !== 'local') return;
      const change = changes[AUTO_ENABLE_SETTINGS_STORAGE_KEY];
      if (change === undefined) return;
      setSettings(normalizeAutoEnableSettings(change.newValue));
    };
    chrome.storage.onChanged.addListener(onChanged);

    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const update = useCallback(async (next: AutoEnableSettings): Promise<void> => {
    await saveAutoEnableSettings(next);
  }, []);

  return { settings, isReady, update };
};
