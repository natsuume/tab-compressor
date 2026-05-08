import {
  isMsg,
  OFFSCREEN_NO_GRAPH_ERROR,
  OFFSCREEN_TARGET,
  type Msg,
} from '@/shared/messages';
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

type OffscreenResponse = { ok: boolean; error?: string };

const isOffscreenResponse = (value: unknown): value is OffscreenResponse =>
  typeof value === 'object' && value !== null && 'ok' in value;

// Offscreen が「指定 tabId のグラフが存在しない」と返してきた状況を表す型付きエラー。
// transport 失敗等の他の例外と区別して、cache 不整合の修復に限定して扱うために使う。
class OffscreenNoGraphError extends Error {
  constructor(msgType: string) {
    super(`offscreen ${msgType} failed: ${OFFSCREEN_NO_GRAPH_ERROR}`);
    this.name = 'OffscreenNoGraphError';
  }
}

// Offscreen 側の getUserMedia 失敗や missing graph 等を呼び出し側に伝播させるため、
// response を検証する。silent ok 扱いにすると monitoredTabs と実グラフの不整合を生む。
const sendToOffscreen = async (msg: Msg): Promise<void> => {
  await ensureOffscreenAndSync();
  const raw: unknown = await chrome.runtime.sendMessage({ ...msg, target: OFFSCREEN_TARGET });
  if (isOffscreenResponse(raw) && raw.ok) return;
  const reason = isOffscreenResponse(raw) ? raw.error ?? 'unknown error' : 'no response';
  if (reason === OFFSCREEN_NO_GRAPH_ERROR) {
    throw new OffscreenNoGraphError(msg.type);
  }
  throw new Error(`offscreen ${msg.type} failed: ${reason}`);
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
// 同一 tabId 並行は withTabLock で防がれる前提。SET_ENABLED が "no graph" で
// 失敗した場合 (cache と実グラフの不整合) のみ cache を捨てて attach 経路にフォールバック。
// transport エラー等は素直に伝播させ、勝手にグラフを作り直さない。
const attachOrToggleGraph = async (
  tabId: number,
  params: CompressorParams,
  enabled: boolean,
): Promise<void> => {
  if (await isMonitoredTab(tabId)) {
    try {
      await sendToOffscreen({ type: 'SET_ENABLED', tabId, enabled, params });
      return;
    } catch (err) {
      if (!(err instanceof OffscreenNoGraphError)) throw err;
      await removeMonitoredTab(tabId);
    }
  }
  const streamId = await getTabMediaStreamId(tabId);
  await sendToOffscreen({ type: 'SET_STREAM', tabId, streamId, params, enabled });
  await addMonitoredTab(tabId);
};

// SET_ENABLED / UPDATE_PARAMS が "no graph" で失敗した場合のみ cache 不整合を解消する。
// transport 等の他のエラーで cache を消すと、生きているグラフを孤立させてしまう。
const sendOrCleanupOnMissingGraph = async (
  tabId: number,
  msg: Msg,
): Promise<void> => {
  try {
    await sendToOffscreen(msg);
  } catch (err) {
    if (!(err instanceof OffscreenNoGraphError)) throw err;
    await removeMonitoredTab(tabId);
  }
};

// graph を best-effort で破棄する。Offscreen が無ければ作らずに no-op、graph が
// 既に無ければ OffscreenNoGraphError を握りつぶす。transport 失敗は warn を残す。
// ナビゲーション failure cleanup や onRemoved のような「graph が残っているか
// 不確かな経路」で使う。
const bestEffortDestroyGraph = async (tabId: number): Promise<void> => {
  if (!(await chrome.offscreen.hasDocument())) return;
  try {
    await sendToOffscreen({ type: 'DESTROY_GRAPH', tabId });
  } catch (err) {
    if (err instanceof OffscreenNoGraphError) return;
    console.warn('[tab-compressor] DESTROY_GRAPH failed', err);
  }
};

// navigation や Offscreen からの GRAPH_LOST 通知のように「graph を維持できなくなった」
// 契機の共通処理。Chrome の tabCapture は popup を閉じている間の navigation 後に
// activeTab grant が失効するため SW 単独で再 attach できない。自動再 attach を諦めて
// auto-OFF にする (graph 破棄 + monitoredTabs から除く + enabled=true なら enabled=false
// に降格)。popup を開けば storage.onChanged で OFF UI に切り替わり、ユーザーが再度 ON を
// 押せば activeTab grant が付与されて確実に attach できる。
const demoteToOffAndCleanup = async (tabId: number): Promise<void> => {
  await bestEffortDestroyGraph(tabId);
  await removeMonitoredTab(tabId);
  const prev = await loadTabState(tabId);
  if (prev !== undefined && prev.enabled) {
    await saveTabState(tabId, { ...prev, enabled: false });
  }
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
      // Offscreen から「track が ended して graph を捨てた」通知。
      // navigation 起因の graph 破棄は handleTabNavigation が先行して実行し、その
      // bestEffortDestroyGraph で entries から削除されるため、後続の `track.ended`
      // で graph-registry の handleEnded が `entries.get(tabId)?.graph !== graph`
      // で早期 return する → このルートには到達しない。
      // よって GRAPH_LOST が SW に届くのは「動画停止やデバイス切断等で track が
      // 自然に ended した」navigation 以外のケース。ユーザーが再生再開すれば次の
      // MONITOR_TAB / ENABLE_TAB で attachOrToggleGraph のセルフヒーリング
      // (SET_ENABLED → no-graph → SET_STREAM フォールバック) が再 attach する。
      // SW 側では何もしないことで popup の並行通信との race を構造的に回避する。
      if (raw.type === 'GRAPH_LOST') {
        return { ok: true };
      }
      // no-op で終わる可能性があるので Offscreen は作成しない。送信直前で必要なら作る。
      await syncMonitoredTabsIfStale();
      return await withTabLock(raw.tabId, async () => {
        switch (raw.type) {
          case 'ENABLE_TAB': {
            // attach が成功してから storage を更新する (失敗時に UI=ON / 圧縮なし
            // の不整合を起こさないため)。
            const prev = await loadTabState(raw.tabId);
            await attachOrToggleGraph(raw.tabId, raw.params, true);
            const next: TabState = {
              enabled: true,
              presetId: prev?.presetId ?? DEFAULT_PRESET_ID,
              params: raw.params,
            };
            await saveTabState(raw.tabId, next);
            return { ok: true };
          }
          case 'DISABLE_TAB': {
            const prev = await loadTabState(raw.tabId);
            if (prev !== undefined) {
              await saveTabState(raw.tabId, { ...prev, enabled: false });
            }
            const params = prev?.params ?? DEFAULT_PARAMS;
            if (await isMonitoredTab(raw.tabId)) {
              await sendOrCleanupOnMissingGraph(raw.tabId, {
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
              await sendOrCleanupOnMissingGraph(raw.tabId, {
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
            const enabled = prev?.enabled === true;
            // attachOrToggleGraph は「graph があれば SET_ENABLED で再確認 → missing なら
            // cache を破棄して新規 attach」というセルフヒーリングを持つ。
            // GRAPH_LOST 通知が popup 側より遅れて届くケース (Offscreen → popup → SW の経路で
            // MONITOR_TAB が先に SW へ届く) でも、ここで死んだ graph を検出して再キャプチャできる。
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
            // STOP_MONITOR は no-op 化された応答も返らないが、no-graph 応答だった
            // ケースだけ握りつぶす (transport エラーは伝播させる)。
            try {
              await sendToOffscreen({ type: 'STOP_MONITOR', tabId: raw.tabId });
            } catch (err) {
              if (!(err instanceof OffscreenNoGraphError)) throw err;
            }
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

// タブ内ナビゲーション (フル page navigation, history.pushState 等の SPA) を能動検知し、
// graph を破棄して enabled=false に降格する (auto-OFF)。`MediaStreamTrack.ended` は
// 「fully reload で track が live のまま silent 化」「pushState で document はそのまま」
// 等で発火しないため、`ended` 起点の検知では取りこぼす。graph を放置すると
// `tabCapture` が拡張機能に専有された状態が続き、他のオーディオ系拡張も動かなくなる。
//
// 自動再 attach は試みない: Chrome の activeTab grant は navigation で失効するため、
// popup を閉じている間は SW 単独で再 attach できない。代わりに「動画切替時は OFF
// に戻る」という分かりやすい仕様にし、popup を開いたユーザーが再度 ON を押す。
const handleTabNavigation = (
  details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
): void => {
  if (details.frameId !== 0) return;
  // Hot path 早期 return: webNavigation は全タブ全フレームで頻繁に発火する。
  // cache が初期化済みかつ非対象タブで、in-flight な per-tab 操作も無いなら
  // withTabLock も async chain も取らずに抜ける。
  // - cache 未初期化 (SW 起動直後) はすり抜けて lock 内で確定判定する。
  // - tabLocks に entry がある場合 (例: MONITOR_TAB の attach が進行中で
  //   addMonitoredTab がまだ反映前) は cache を信用できないため、lock を
  //   取って attach 完了後の cache で判定し直す。これがないと「attach 完了直前に
  //   navigation が発火 → fast-path で skip → 新 graph が pre-navigation stream で
  //   構築されたまま生き残る」レースで取りこぼす。
  if (
    monitoredTabsCache !== null
    && !monitoredTabsCache.has(details.tabId)
    && !tabLocks.has(details.tabId)
  ) {
    return;
  }
  const { tabId } = details;
  void withTabLock(tabId, async () => {
    if (!(await isMonitoredTab(tabId))) return;
    await demoteToOffAndCleanup(tabId);
  });
};

chrome.webNavigation.onCommitted.addListener(handleTabNavigation);
chrome.webNavigation.onHistoryStateUpdated.addListener(handleTabNavigation);

chrome.tabs.onRemoved.addListener((tabId) => {
  void withTabLock(tabId, async () => {
    await chrome.storage.session.remove(tabStorageKey(tabId));
    await removeMonitoredTab(tabId);
    await bestEffortDestroyGraph(tabId);
  });
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    await chrome.storage.session.clear();
    await resetMonitoredTabs();
  })();
});
