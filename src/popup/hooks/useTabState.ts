import { useCallback, useEffect, useState } from 'react';
import type { Msg } from '@/shared/messages';
import type { CompressorParams } from '@/shared/compressor-params';
import { DEFAULT_PARAMS } from '@/shared/compressor-params';
import { DEFAULT_PRESET_ID } from '@/shared/presets';
import { tabStorageKey, type TabState } from '@/shared/tab-state';

const createDefaultState = (): TabState => ({
  enabled: false,
  presetId: DEFAULT_PRESET_ID,
  params: DEFAULT_PARAMS,
});

const sendMessage = async (msg: Msg): Promise<{ ok: boolean; error?: string }> => {
  const response = (await chrome.runtime.sendMessage(msg)) as
    | { ok: boolean; error?: string }
    | undefined;
  return response ?? { ok: false, error: 'no response' };
};

export type UseTabStateResult = {
  state: TabState;
  isReady: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  updateParams: (params: CompressorParams) => Promise<void>;
  setState: (next: TabState) => Promise<void>;
};

export const useTabState = (tabId: number | null): UseTabStateResult => {
  const [state, setStateLocal] = useState<TabState>(() => createDefaultState());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (tabId === null) return;
    const key = tabStorageKey(tabId);
    let cancelled = false;

    chrome.storage.session.get(key).then((stored) => {
      if (cancelled) return;
      const loaded = stored[key] as TabState | undefined;
      setStateLocal(loaded ?? createDefaultState());
      setIsReady(true);
    }).catch(() => {
      if (!cancelled) {
        setStateLocal(createDefaultState());
        setIsReady(true);
      }
    });

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void => {
      if (area !== 'session') return;
      const change = changes[key];
      if (change === undefined) return;
      const newValue = change.newValue as TabState | undefined;
      setStateLocal(newValue ?? createDefaultState());
    };
    chrome.storage.onChanged.addListener(onChanged);

    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [tabId]);

  const enable = useCallback(async () => {
    if (tabId === null) return;
    await sendMessage({ type: 'ENABLE_TAB', tabId, params: state.params });
  }, [tabId, state.params]);

  const disable = useCallback(async () => {
    if (tabId === null) return;
    await sendMessage({ type: 'DISABLE_TAB', tabId });
  }, [tabId]);

  const updateParams = useCallback(
    async (params: CompressorParams) => {
      if (tabId === null) return;
      await sendMessage({ type: 'UPDATE_PARAMS', tabId, params });
    },
    [tabId],
  );

  const setState = useCallback(
    async (next: TabState) => {
      if (tabId === null) return;
      await chrome.storage.session.set({ [tabStorageKey(tabId)]: next });
      if (next.enabled) {
        await sendMessage({ type: 'UPDATE_PARAMS', tabId, params: next.params });
      }
    },
    [tabId],
  );

  return { state, isReady, enable, disable, updateParams, setState };
};
