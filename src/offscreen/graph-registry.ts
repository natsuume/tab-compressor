import type { CompressorParams } from '@/shared/compressor-params';
import {
  applyParams,
  buildConstraintsForTabStream,
  createAudioGraph,
  disposeGraph,
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

export const setStreamForTab = async (
  tabId: number,
  streamId: string,
  params: CompressorParams,
): Promise<void> => {
  if (entries.has(tabId)) {
    removeTab(tabId);
  }

  const constraints = buildConstraintsForTabStream(streamId);
  const stream = await navigator.mediaDevices.getUserMedia(
    constraints as MediaStreamConstraints,
  );

  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  const graph = createAudioGraph(ctx, stream, params);
  entries.set(tabId, { tabId, graph });
};

export const updateTabParams = (tabId: number, params: CompressorParams): void => {
  const entry = entries.get(tabId);
  if (entry === undefined) return;
  applyParams(entry.graph.compressor, params, getAudioContext().currentTime);
};

export const removeTab = (tabId: number): void => {
  const entry = entries.get(tabId);
  if (entry === undefined) return;
  disposeGraph(entry.graph);
  entries.delete(tabId);
};

export const clearAll = (): void => {
  for (const [tabId] of entries) {
    removeTab(tabId);
  }
};

export const listEntries = (): ReadonlyArray<RegistryEntry> => Array.from(entries.values());

export const hasTab = (tabId: number): boolean => entries.has(tabId);
