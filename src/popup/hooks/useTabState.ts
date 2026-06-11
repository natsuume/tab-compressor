import { useCallback, useEffect, useState } from 'react';
import type { Msg } from '@/shared/messages';
import { DEFAULT_PARAMS, normalizeCompressorParams } from '@/shared/compressor-params';
import { DEFAULT_PRESET_ID } from '@/shared/presets';
import { tabStorageKey, type TabState } from '@/shared/tab-state';

const createDefaultState = (): TabState => ({
  enabled: false,
  presetId: DEFAULT_PRESET_ID,
  params: DEFAULT_PARAMS,
});

const normalizeTabState = (raw: TabState | undefined): TabState => {
  if (raw === undefined) return createDefaultState();
  return { ...raw, params: normalizeCompressorParams(raw.params) };
};

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
      setStateLocal(normalizeTabState(loaded));
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
      setStateLocal(normalizeTabState(newValue));
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

  const setState = useCallback(
    async (next: TabState) => {
      if (tabId === null) return;
      const key = tabStorageKey(tabId);
      // popup から enabled を勝手に書き換えない: storage の最新 enabled で merge する。
      // SW の auto-OFF (navigation で enabled=false に降格) と popup スライダー操作が
      // 並行発生したときに、popup 側の古い state.enabled=true で書き戻して降格を
      // resurrect しないため。enabled の変更は ENABLE_TAB / DISABLE_TAB だけが行う。
      const stored = await chrome.storage.session.get(key);
      const currentEnabled = (stored[key] as TabState | undefined)?.enabled ?? false;
      const merged: TabState = { ...next, enabled: currentEnabled };
      await chrome.storage.session.set({ [key]: merged });
      if (currentEnabled) {
        await sendMessage({ type: 'UPDATE_PARAMS', tabId, params: merged.params });
      }
    },
    [tabId],
  );

  return { state, isReady, enable, disable, setState };
};
