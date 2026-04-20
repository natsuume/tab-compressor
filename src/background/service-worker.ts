import { isMsg, OFFSCREEN_TARGET, type Msg } from '@/shared/messages';
import { tabStorageKey, type TabState } from '@/shared/tab-state';
import { DEFAULT_PARAMS } from '@/shared/compressor-params';
import { DEFAULT_PRESET_ID } from '@/shared/presets';
import { ensureOffscreenDocument } from './offscreen-manager';
import { getTabMediaStreamId } from './capture-stream';

const sendToOffscreen = async (msg: Msg): Promise<void> => {
  await ensureOffscreenDocument();
  await chrome.runtime.sendMessage({ ...msg, target: OFFSCREEN_TARGET });
};

const enableTab = async (tabId: number, state: TabState): Promise<void> => {
  const streamId = await getTabMediaStreamId(tabId);
  await sendToOffscreen({
    type: 'SET_STREAM',
    tabId,
    streamId,
    params: state.params,
  });
};

const disableTab = async (tabId: number): Promise<void> => {
  await sendToOffscreen({ type: 'DESTROY_GRAPH', tabId });
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
          const state: TabState = {
            enabled: true,
            presetId: DEFAULT_PRESET_ID,
            params: raw.params,
          };
          await chrome.storage.session.set({ [tabStorageKey(raw.tabId)]: state });
          await enableTab(raw.tabId, state);
          return { ok: true };
        }
        case 'DISABLE_TAB': {
          await chrome.storage.session.remove(tabStorageKey(raw.tabId));
          await disableTab(raw.tabId);
          return { ok: true };
        }
        case 'UPDATE_PARAMS': {
          const key = tabStorageKey(raw.tabId);
          const stored = await chrome.storage.session.get(key);
          const prev = (stored[key] as TabState | undefined) ?? {
            enabled: false,
            presetId: DEFAULT_PRESET_ID,
            params: DEFAULT_PARAMS,
          };
          const next: TabState = { ...prev, params: raw.params, presetId: 'custom' };
          await chrome.storage.session.set({ [key]: next });
          if (next.enabled) {
            await sendToOffscreen({
              type: 'UPDATE_PARAMS',
              tabId: raw.tabId,
              params: raw.params,
            });
          }
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
  void sendToOffscreen({ type: 'DESTROY_GRAPH', tabId }).catch(() => {
    // Offscreen might already be gone; safe to ignore.
  });
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.storage.session.clear();
});
