import type { CompressorParams } from '@/shared/compressor-params';
import {
  applyParams,
  buildConstraintsForTabStream,
  createAudioGraph,
  disposeGraph,
  setGraphEnabled,
  type AudioGraph,
} from './audio-graph';

type RegistryEntry = { tabId: number; graph: AudioGraph };

let audioContext: AudioContext | null = null;
const entries = new Map<number, RegistryEntry>();

// tabCapture の MediaStream は、タブ内ナビゲーション (YouTube の SPA video 切替を含む)
// でしばしば audio track が ended になる。死んだ track のまま放置すると入力レベル計測が
// 0 で固まり、ユーザーには「ON/OFF を切り替えても LEVEL が変化しない」ように見える。
// SW へ通知して monitoredTabs キャッシュを掃除し、popup 側の再 MONITOR_TAB で
// 新しい streamId を取り直せるようにする。
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
  if (entries.has(tabId)) {
    removeTab(tabId);
  }
  const stream = await captureStream(streamId);
  const graph = createAudioGraph(getAudioContext(), stream, params, enabled);
  entries.set(tabId, { tabId, graph });
  watchStreamLifecycle(tabId, graph);
};

export const updateTabParams = (tabId: number, params: CompressorParams): boolean => {
  const entry = entries.get(tabId);
  if (entry === undefined) return false;
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
