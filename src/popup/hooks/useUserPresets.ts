import { useCallback, useEffect, useState } from 'react';
import type { CompressorParams } from '@/shared/compressor-params';
import {
  createUserPreset,
  loadUserPresets,
  saveUserPresets,
  USER_PRESETS_STORAGE_KEY,
  type UserPreset,
  type UserPresetId,
} from '@/shared/user-presets';

export type UseUserPresetsResult = {
  presets: UserPreset[];
  isReady: boolean;
  add: (name: string, params: CompressorParams) => Promise<UserPreset>;
  remove: (id: UserPresetId) => Promise<void>;
};

export const useUserPresets = (): UseUserPresetsResult => {
  const [presets, setPresets] = useState<UserPreset[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadUserPresets().then((loaded) => {
      if (cancelled) return;
      setPresets(loaded);
      setIsReady(true);
    }).catch(() => {
      if (!cancelled) setIsReady(true);
    });

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void => {
      if (area !== 'local') return;
      const change = changes[USER_PRESETS_STORAGE_KEY];
      if (change === undefined) return;
      const next = Array.isArray(change.newValue) ? (change.newValue as UserPreset[]) : [];
      setPresets(next);
    };
    chrome.storage.onChanged.addListener(onChanged);

    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const add = useCallback(
    async (name: string, params: CompressorParams): Promise<UserPreset> => {
      const preset = createUserPreset(name, params);
      const next = [...presets, preset];
      await saveUserPresets(next);
      return preset;
    },
    [presets],
  );

  const remove = useCallback(
    async (id: UserPresetId): Promise<void> => {
      const next = presets.filter((p) => p.id !== id);
      await saveUserPresets(next);
    },
    [presets],
  );

  return { presets, isReady, add, remove };
};
