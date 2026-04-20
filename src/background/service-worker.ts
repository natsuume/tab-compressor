import { isMsg, OFFSCREEN_TARGET, type Msg } from '@/shared/messages';
import { tabStorageKey, type TabState } from '@/shared/tab-state';
import {
  DEFAULT_PARAMS,
  normalizeCompressorParams,
  type CompressorParams,
} from '@/shared/compressor-params';
import { DEFAULT_PRESET_ID } from '@/shared/presets';
import { ensureOffscreenDocument } from './offscreen-manager';
import { getTabMediaStreamId } from './capture-stream';

const sendToOffscreen = async (msg: Msg): Promise<void> => {
  await ensureOffscreenDocument();
  await chrome.runtime.sendMessage({ ...msg, target: OFFSCREEN_TARGET });
};

// SW プロセス内で「offscreen にグラフが存在する」と確信できるタブを記録する。
// SW terminate で失われるが、popup 再オープンや ENABLE/DISABLE 時に都度 rebuild される。
const monitoredTabs = new Set<number>();

const loadTabState = async (tabId: number): Promise<TabState | undefined> => {
  const key = tabStorageKey(tabId);
  const stored = await chrome.storage.session.get(key);
  return stored[key] as TabState | undefined;
};

const saveTabState = async (tabId: number, state: TabState): Promise<void> => {
  await chrome.storage.session.set({ [tabStorageKey(tabId)]: state });
};

// 既存グラフがあれば経路切替のみ、なければタブキャプチャから構築。
const attachOrToggleGraph = async (
  tabId: number,
  params: CompressorParams,
  enabled: boolean,
): Promise<void> => {
  if (monitoredTabs.has(tabId)) {
    await sendToOffscreen({ type: 'SET_ENABLED', tabId, enabled, params });
    return;
  }
  const streamId = await getTabMediaStreamId(tabId);
  await sendToOffscreen({ type: 'SET_STREAM', tabId, streamId, params, enabled });
  monitoredTabs.add(tabId);
};

chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
  if (!isMsg(raw)) {
    sendResponse({ ok: false, error: 'invalid message' });
    return false;
  }

  const handle = async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      switch (raw.type) {
        case 'ENABLE_TAB': {
          const prev = await loadTabState(raw.tabId);
          const next: TabState = {
            enabled: true,
            presetId: prev?.presetId ?? DEFAULT_PRESET_ID,
            params: raw.params,
          };
          await saveTabState(raw.tabId, next);
          await attachOrToggleGraph(raw.tabId, raw.params, true);
          return { ok: true };
        }
        case 'DISABLE_TAB': {
          const prev = await loadTabState(raw.tabId);
          if (prev !== undefined) {
            await saveTabState(raw.tabId, { ...prev, enabled: false });
          }
          const params = prev?.params ?? DEFAULT_PARAMS;
          // グラフがまだなければ bypass として起こす必要はない（ユーザーが OFF にしただけ）。
          // 既にあるなら bypass 経路に切替。
          if (monitoredTabs.has(raw.tabId)) {
            await sendToOffscreen({
              type: 'SET_ENABLED',
              tabId: raw.tabId,
              enabled: false,
              params,
            });
          }
          return { ok: true };
        }
        case 'UPDATE_PARAMS': {
          const prev = (await loadTabState(raw.tabId)) ?? {
            enabled: false,
            presetId: DEFAULT_PRESET_ID,
            params: DEFAULT_PARAMS,
          };
          const next: TabState = { ...prev, params: raw.params, presetId: 'custom' };
          await saveTabState(raw.tabId, next);
          if (monitoredTabs.has(raw.tabId)) {
            // enabled/bypass どちらでも makeupGain に manualMakeupGainDb が反映される。
            await sendToOffscreen({
              type: 'UPDATE_PARAMS',
              tabId: raw.tabId,
              params: raw.params,
            });
          }
          return { ok: true };
        }
        case 'MONITOR_TAB': {
          // popup 起動時のメーター計測依頼。enabled 状態に応じて何もしないか bypass を起こす。
          const prev = await loadTabState(raw.tabId);
          const params = normalizeCompressorParams(prev?.params ?? raw.params);
          if (prev?.enabled === true) {
            // enabled ならユーザー操作で既に ENABLE_TAB 済み (または今後送られる)。
            // ここで追加のキャプチャはしない。
            return { ok: true };
          }
          if (monitoredTabs.has(raw.tabId)) {
            // 既に bypass で計測中。
            return { ok: true };
          }
          try {
            await attachOrToggleGraph(raw.tabId, params, false);
            return { ok: true };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { ok: false, error: message };
          }
        }
        case 'STOP_MONITOR': {
          if (!monitoredTabs.has(raw.tabId)) return { ok: true };
          const prev = await loadTabState(raw.tabId);
          if (prev?.enabled === true) {
            // enabled の間は popup を閉じてもグラフは維持する。
            return { ok: true };
          }
          await sendToOffscreen({ type: 'STOP_MONITOR', tabId: raw.tabId });
          monitoredTabs.delete(raw.tabId);
          return { ok: true };
        }
        default:
          return { ok: false, error: `unhandled type: ${raw.type}` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  };

  handle().then(sendResponse).catch((err: unknown) => {
    sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
  });
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const key = tabStorageKey(tabId);
  void chrome.storage.session.remove(key);
  monitoredTabs.delete(tabId);
  void sendToOffscreen({ type: 'DESTROY_GRAPH', tabId }).catch(() => {
    // Offscreen might already be gone; safe to ignore.
  });
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.storage.session.clear();
  monitoredTabs.clear();
});
