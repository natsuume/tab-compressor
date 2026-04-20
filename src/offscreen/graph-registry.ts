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
};

export const updateTabParams = (tabId: number, params: CompressorParams): void => {
  const entry = entries.get(tabId);
  if (entry === undefined) return;
  applyParams(entry.graph, params, getAudioContext().currentTime);
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
