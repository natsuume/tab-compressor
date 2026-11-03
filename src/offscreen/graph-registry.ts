import type { CompressorParams } from '@/shared/compressor-params';
import { INITIAL_AUTO_MAKEUP_STATE, type AutoMakeupState } from '@/shared/auto-makeup';
import {
  applyParams,
  buildConstraintsForTabStream,
  createAudioGraph,
  disposeGraph,
  setGraphEnabled,
  type AudioGraph,
} from './audio-graph';

// タブ 1 つ分のグラフと、そのタブに適用中の params・自動 Makeup の状態。
// 処理ループが毎 tick autoMakeupState を書き換える可変オブジェクト。
export type RegistryEntry = {
  tabId: number;
  graph: AudioGraph;
  params: CompressorParams;
  autoMakeupState: AutoMakeupState;
};

let audioContext: AudioContext | null = null;
const entries = new Map<number, RegistryEntry>();

// tabCapture の MediaStream は、動画停止やデバイス切断、タブ内ナビゲーションに伴う
// Chrome 内部の音声経路変化などで audio track が ended になることがある。死んだ track の
// まま放置すると入力レベル計測が 0 で固まり、ユーザーには「ON/OFF を切り替えても LEVEL
// が変化しない」ように見える。SW へ通知し、enabled なタブなら新しい streamId で再 attach
// させる (失敗時は SW 側で auto-OFF に降格する)。
const notifyGraphLost = (tabId: number): void => {
  void chrome.runtime.sendMessage({ type: 'GRAPH_LOST', tabId }).catch(() => undefined);
};

const watchStreamLifecycle = (tabId: number, graph: AudioGraph): void => {
  const handleEnded = (): void => {
    // 自分が破棄された後の遅延 ended (track.stop による) は無視する。
    if (entries.get(tabId)?.graph !== graph) return;
    removeTab(tabId);
    notifyGraphLost(tabId);
  };
  for (const track of graph.stream.getAudioTracks()) {
    track.addEventListener('ended', handleEnded, { once: true });
  }
};

const getAudioContext = (): AudioContext => {
  if (audioContext === null) {
    audioContext = new AudioContext({ latencyHint: 'interactive' });
  }
  return audioContext;
};

const captureStream = async (streamId: string): Promise<MediaStream> => {
  const constraints = buildConstraintsForTabStream(streamId);
  const stream = await navigator.mediaDevices.getUserMedia(
    constraints as MediaStreamConstraints,
  );
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return stream;
};

export const setStreamForTab = async (
  tabId: number,
  streamId: string,
  params: CompressorParams,
  enabled: boolean,
): Promise<void> => {
  // Chrome の tabCapture は同一タブの同時キャプチャを許さない (`getUserMedia` が失敗する)。
  // そのため acquire-first の rollback-safe 順序は採れず、先に old graph を破棄して
  // tabCapture を release してから new stream を取得する必要がある。
  // captureStream が失敗した場合は old が失われるが、呼び出し側 (SW) で monitoredTabs
  // cache を整理し、popup が次に開いた MONITOR_TAB で復旧する経路に乗せる。
  if (entries.has(tabId)) {
    removeTab(tabId);
  }
  const stream = await captureStream(streamId);
  const graph = createAudioGraph(getAudioContext(), stream, params, enabled);
  entries.set(tabId, { tabId, graph, params, autoMakeupState: INITIAL_AUTO_MAKEUP_STATE });
  watchStreamLifecycle(tabId, graph);
};

// 自動 Makeup の GainNode への反映は処理ループが毎 tick 行うため、ここでは状態の更新のみ行う。
export const updateTabParams = (tabId: number, params: CompressorParams): boolean => {
  const entry = entries.get(tabId);
  if (entry === undefined) return false;
  // 自動 Makeup を切り替えたときは、前回の動作中に追従したゲインを持ち越さない。
  if (entry.params.autoMakeup !== params.autoMakeup) {
    entry.autoMakeupState = INITIAL_AUTO_MAKEUP_STATE;
  }
  entry.params = params;
  applyParams(entry.graph, params, getAudioContext().currentTime);
  return true;
};

export const setTabEnabled = (
  tabId: number,
  enabled: boolean,
  params: CompressorParams,
): boolean => {
  const entry = entries.get(tabId);
  if (entry === undefined) return false;
  // コンプレッサーの ON / OFF を切り替えたときは、自動 Makeup を初期状態から始め直す。
  // setGraphEnabled が graph.enabled を書き換えるため、その前に判定する。
  if (entry.graph.enabled !== enabled) {
    entry.autoMakeupState = INITIAL_AUTO_MAKEUP_STATE;
  }
  entry.params = params;
  setGraphEnabled(entry.graph, enabled, params, getAudioContext().currentTime);
  return true;
};

export const removeTab = (tabId: number): void => {
  const entry = entries.get(tabId);
  if (entry === undefined) return;
  disposeGraph(entry.graph);
  entries.delete(tabId);
};

// popup が閉じた際、bypass モードのみのグラフを破棄する。enabled のグラフは保持。
export const stopMonitoringTab = (tabId: number): void => {
  const entry = entries.get(tabId);
  if (entry === undefined) return;
  if (entry.graph.enabled) return;
  removeTab(tabId);
};

export const clearAll = (): void => {
  for (const [tabId] of entries) {
    removeTab(tabId);
  }
};

export const listEntries = (): ReadonlyArray<RegistryEntry> => Array.from(entries.values());

export const hasTab = (tabId: number): boolean => entries.has(tabId);
