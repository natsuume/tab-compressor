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

// MV3 の Service Worker はアイドルで終了しメモリが揮発するため、
// chrome.storage.session に永続化して SW 再起動を跨いで保持する。
// Offscreen が新規作成された (= 拡張リロード等で AudioGraph が消失した)
// タイミングではこの永続データもリセットする。
const MONITORED_TABS_KEY = '__monitored_tabs__';

let monitoredTabsCache: Set<number> | null = null;

// 並行ハンドラからの read-modify-write を直列化するための単一キュー。
// (例: SW 再起動直後に2件のメッセージが同時到着すると、それぞれが個別に
//  loadMonitoredTabs を実行して相互に上書きしてしまう、ようなレースを防ぐ)
let monitoredOpsChain: Promise<unknown> = Promise.resolve();

const persistMonitoredTabs = async (set: Set<number>): Promise<void> => {
  await chrome.storage.session.set({ [MONITORED_TABS_KEY]: Array.from(set) });
};

const loadMonitoredTabs = async (): Promise<Set<number>> => {
  const stored = await chrome.storage.session.get(MONITORED_TABS_KEY);
  const list = stored[MONITORED_TABS_KEY] as number[] | undefined;
  return new Set(list ?? []);
};

const enqueueMonitoredOp = <T>(fn: (cache: Set<number>) => Promise<T> | T): Promise<T> => {
  const next = monitoredOpsChain.then(async () => {
    if (monitoredTabsCache === null) {
      monitoredTabsCache = await loadMonitoredTabs();
    }
    return fn(monitoredTabsCache);
  });
  monitoredOpsChain = next.catch(() => undefined);
  return next;
};

const addMonitoredTab = (tabId: number): Promise<void> =>
  enqueueMonitoredOp(async (set) => {
    if (set.has(tabId)) return;
    set.add(tabId);
    await persistMonitoredTabs(set);
  });

const removeMonitoredTab = (tabId: number): Promise<void> =>
  enqueueMonitoredOp(async (set) => {
    if (!set.delete(tabId)) return;
    await persistMonitoredTabs(set);
  });

const isMonitoredTab = (tabId: number): Promise<boolean> =>
  enqueueMonitoredOp((set) => set.has(tabId));

const resetMonitoredTabs = (): Promise<void> =>
  enqueueMonitoredOp(async (set) => {
    set.clear();
    await chrome.storage.session.remove(MONITORED_TABS_KEY);
  });

// 同一 tabId への並行操作 (例: popup mount で MONITOR_TAB が飛び、
// ユーザーが直後に ON を押して ENABLE_TAB が飛ぶ) を直列化する。
// 直列化しないと SET_STREAM が二重発行され、後勝ちで意図しない enabled 状態
// (例: ENABLE 後に MONITOR の bypass で上書き) になりうる。
const tabLocks = new Map<number, Promise<unknown>>();

const withTabLock = <T>(tabId: number, fn: () => Promise<T>): Promise<T> => {
  const prev = tabLocks.get(tabId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  const guard = next.catch(() => undefined);
  tabLocks.set(tabId, guard);
  void guard.then(() => {
    if (tabLocks.get(tabId) === guard) tabLocks.delete(tabId);
  });
  return next;
};

// 並行ハンドラが同じ Offscreen 作成サイクルを共有できるよう、
// in-flight Promise をキャッシュする。これにより
// ensureOffscreenDocument の "creating !== null" 待機者も
// 同じ reset 完了を待ってから先へ進む。
let syncInFlight: Promise<void> | null = null;

// Offscreen を必要に応じて作成し、新規作成だった場合は
// 永続化された monitoredTabs をクリアする。送信直前のみ呼ぶ。
const ensureOffscreenAndSync = (): Promise<void> => {
  if (syncInFlight !== null) return syncInFlight;
  syncInFlight = (async () => {
    try {
      const { created } = await ensureOffscreenDocument();
      if (created) {
        await resetMonitoredTabs();
      }
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
};

// no-op で終わる可能性のあるハンドラ冒頭で、Offscreen を作成せずに整合性だけ取る。
// Offscreen が消えていれば cache は古いのでクリア。
const syncMonitoredTabsIfStale = async (): Promise<void> => {
  if (!(await chrome.offscreen.hasDocument())) await resetMonitoredTabs();
};

const sendToOffscreen = async (msg: Msg): Promise<void> => {
  await ensureOffscreenAndSync();
  await chrome.runtime.sendMessage({ ...msg, target: OFFSCREEN_TARGET });
};

const loadTabState = async (tabId: number): Promise<TabState | undefined> => {
  const key = tabStorageKey(tabId);
  const stored = await chrome.storage.session.get(key);
  return stored[key] as TabState | undefined;
};

const saveTabState = async (tabId: number, state: TabState): Promise<void> => {
  await chrome.storage.session.set({ [tabStorageKey(tabId)]: state });
};

// 既存グラフがあれば経路切替のみ、なければタブキャプチャから構築。
// 同一 tabId 並行は withTabLock で防がれる前提なので、ここでは has → add の
// 単純な並びでよい (TOCTOU は外側ロックで排他されている)。
const attachOrToggleGraph = async (
  tabId: number,
  params: CompressorParams,
  enabled: boolean,
): Promise<void> => {
  if (await isMonitoredTab(tabId)) {
    await sendToOffscreen({ type: 'SET_ENABLED', tabId, enabled, params });
    return;
  }
  const streamId = await getTabMediaStreamId(tabId);
  await sendToOffscreen({ type: 'SET_STREAM', tabId, streamId, params, enabled });
  await addMonitoredTab(tabId);
};

chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
  if (!isMsg(raw)) {
    sendResponse({ ok: false, error: 'invalid message' });
    return false;
  }

  const handle = async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      if (!('tabId' in raw)) {
        return { ok: false, error: `unhandled type: ${raw.type}` };
      }
      // no-op で終わる可能性があるので Offscreen は作成しない。送信直前で必要なら作る。
      await syncMonitoredTabsIfStale();
      return await withTabLock(raw.tabId, async () => {
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
            if (await isMonitoredTab(raw.tabId)) {
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
            if (await isMonitoredTab(raw.tabId)) {
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
            const prev = await loadTabState(raw.tabId);
            const params = normalizeCompressorParams(prev?.params ?? raw.params);
            // enabled なのに Offscreen にグラフが無い (= 拡張リロード等) 場合は再構築する。
            // それ以外の MONITOR_TAB は bypass モードでメーター計測を起こす。
            if (await isMonitoredTab(raw.tabId)) return { ok: true };
            const enabled = prev?.enabled === true;
            await attachOrToggleGraph(raw.tabId, params, enabled);
            return { ok: true };
          }
          case 'STOP_MONITOR': {
            if (!(await isMonitoredTab(raw.tabId))) return { ok: true };
            const prev = await loadTabState(raw.tabId);
            if (prev?.enabled === true) {
              // enabled の間は popup を閉じてもグラフは維持する。
              return { ok: true };
            }
            await sendToOffscreen({ type: 'STOP_MONITOR', tabId: raw.tabId });
            await removeMonitoredTab(raw.tabId);
            return { ok: true };
          }
          default:
            return { ok: false, error: `unhandled type: ${raw.type}` };
        }
      });
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
  void withTabLock(tabId, async () => {
    await chrome.storage.session.remove(tabStorageKey(tabId));
    await removeMonitoredTab(tabId);
    // Offscreen が無ければ destroy 対象も無いので作成しない。
    if (!(await chrome.offscreen.hasDocument())) return;
    try {
      await sendToOffscreen({ type: 'DESTROY_GRAPH', tabId });
    } catch {
      // Offscreen might already be gone; safe to ignore.
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    await chrome.storage.session.clear();
    await resetMonitoredTabs();
  })();
});
