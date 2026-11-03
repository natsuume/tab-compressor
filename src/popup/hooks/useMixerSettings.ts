import { useCallback, useEffect, useState } from 'react';
import type { Msg } from '@/shared/messages';
import {
  DEFAULT_MIXER_SETTINGS,
  loadMixerSettings,
  MIXER_SETTINGS_STORAGE_KEY,
  normalizeMixerSettings,
  saveMixerSettings,
  type MixerSettings,
} from '@/shared/mixer-settings';

export type UseMixerSettingsResult = {
  settings: MixerSettings;
  // storage からの初回読み込みが終わったか (失敗した場合も既定値で true になる)
  isReady: boolean;
  // 保存時刻 (updatedAt) は update が付けるので、呼び出し側は変えたい値だけを渡す
  update: (next: Omit<MixerSettings, 'updatedAt'>) => Promise<void>;
};

// chrome.storage.local の全タブ共通のミキサー設定を読み込み、storage.onChanged で変更を購読する。
// update は保存時刻を付けて storage へ保存してから、Offscreen へ反映するよう SW に
// UPDATE_MIXER_SETTINGS を送る。Offscreen は保存時刻の新しい方だけを採るので、attach と
// 設定変更の順序が前後しても最新の設定が残る。画面への反映は storage.onChanged 経由で行う。
export const useMixerSettings = (): UseMixerSettingsResult => {
  const [settings, setSettings] = useState<MixerSettings>(DEFAULT_MIXER_SETTINGS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadMixerSettings().then((loaded) => {
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
      const change = changes[MIXER_SETTINGS_STORAGE_KEY];
      if (change === undefined) return;
      setSettings(normalizeMixerSettings(change.newValue));
    };
    chrome.storage.onChanged.addListener(onChanged);

    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const update = useCallback(
    async (next: Omit<MixerSettings, 'updatedAt'>): Promise<void> => {
      const settingsToSave: MixerSettings = { ...next, updatedAt: Date.now() };
      await saveMixerSettings(settingsToSave);
      const message: Msg = { type: 'UPDATE_MIXER_SETTINGS', settings: settingsToSave };
      await chrome.runtime.sendMessage(message);
    },
    [],
  );

  return { settings, isReady, update };
};
