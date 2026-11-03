import { useCallback, useEffect, useState } from 'react';
import type { Msg } from '@/shared/messages';
import { parseTabStorageKey } from '@/shared/tab-state';
import {
  mixerOffsetStorageKey,
  mixerTitleStorageKey,
  normalizeMixerOffsetDb,
  saveMixerOffsetDb,
} from '@/shared/tab-mixer';

// ミキサーの一覧に並べる、コンプレッサー ON のタブ 1 つ分の情報。
export type MixerTab = {
  tabId: number;
  // popup を開いた時点で記録したタイトル。未記録なら null
  title: string | null;
  offsetDb: number;
};

export type MixerTabsStatus = 'loading' | 'ready' | 'error';

export type UseMixerTabsResult = {
  status: MixerTabsStatus;
  tabs: MixerTab[];
  setOffset: (tabId: number, offsetDb: number) => Promise<void>;
};

const isEnabledTabState = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && 'enabled' in value && value.enabled === true;

// chrome.storage.session の全体から、コンプレッサー ON のタブを tabId 昇順で取り出す。
// タイトルと手動オフセットは、同じ読み込み結果にあるタブごとのキーから取り出す。
const extractMixerTabs = (stored: Record<string, unknown>): MixerTab[] => {
  const tabs: MixerTab[] = [];
  for (const [key, value] of Object.entries(stored)) {
    const tabId = parseTabStorageKey(key);
    if (tabId === null || !isEnabledTabState(value)) continue;
    const title = stored[mixerTitleStorageKey(tabId)];
    tabs.push({
      tabId,
      title: typeof title === 'string' ? title : null,
      offsetDb: normalizeMixerOffsetDb(stored[mixerOffsetStorageKey(tabId)]),
    });
  }
  return tabs.sort((a, b) => a.tabId - b.tabId);
};

// コンプレッサー ON のタブの一覧を chrome.storage.session から読み込み、変更のたびに読み直す。
// setOffset は手動オフセットを storage へ保存してから、Offscreen へ反映するよう SW に
// UPDATE_MIXER_OFFSET を送る (UPDATE_PARAMS と同じく「保存してから送る」)。
export const useMixerTabs = (): UseMixerTabsResult => {
  const [status, setStatus] = useState<MixerTabsStatus>('loading');
  const [tabs, setTabs] = useState<MixerTab[]>([]);

  useEffect(() => {
    let cancelled = false;
    // 読み直しが重なったときに、先に始めた読み込みの結果で新しい結果を上書きしないための番号。
    let latestRequestId = 0;

    const reload = (): void => {
      latestRequestId += 1;
      const requestId = latestRequestId;
      chrome.storage.session.get(null).then((stored) => {
        if (cancelled || requestId !== latestRequestId) return;
        setTabs(extractMixerTabs(stored));
        setStatus('ready');
      }).catch(() => {
        if (cancelled || requestId !== latestRequestId) return;
        setStatus('error');
      });
    };

    reload();

    const onChanged = (
      _changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void => {
      if (area !== 'session') return;
      reload();
    };
    chrome.storage.onChanged.addListener(onChanged);

    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const setOffset = useCallback(async (tabId: number, offsetDb: number): Promise<void> => {
    await saveMixerOffsetDb(tabId, offsetDb);
    const message: Msg = { type: 'UPDATE_MIXER_OFFSET', tabId, offsetDb };
    await chrome.runtime.sendMessage(message);
  }, []);

  return { status, tabs, setOffset };
};
