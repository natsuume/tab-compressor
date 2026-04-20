import type { CompressorParams } from '@/shared/compressor-params';
import { estimateAutoMakeupCompensationDb } from '@/shared/compressor-curve';
import { PARAM_SMOOTHING_TIME_CONSTANT } from '@/shared/constants';

export type AudioGraph = {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  inputAnalyser: AnalyserNode;
  outputAnalyser: AnalyserNode;
  compressor: DynamicsCompressorNode;
  makeupGain: GainNode;
  destination: AudioDestinationNode;
  enabled: boolean;
};

const dbToLinear = (db: number): number => Math.pow(10, db / 20);

const computeMakeupLinear = (params: CompressorParams): number =>
  dbToLinear(estimateAutoMakeupCompensationDb(params) + params.manualMakeupGainDb);

type TabMediaConstraints = MediaStreamConstraints & {
  audio: {
    mandatory: {
      chromeMediaSource: 'tab';
      chromeMediaSourceId: string;
    };
  };
};

export const buildConstraintsForTabStream = (streamId: string): TabMediaConstraints => ({
  audio: {
    mandatory: {
      chromeMediaSource: 'tab',
      chromeMediaSourceId: streamId,
    },
  },
  video: false,
});

// outputAnalyser は destination 直前に置き、実際に出力される音量を計測する。
// これにより makeupGain (自動補正 + 手動 Makeup) の変化が Output バーに反映される。
// bypass 時は compressor/makeupGain をスキップし、input/output の値は一致する。
const connectGraphPath = (graph: AudioGraph, enabled: boolean): void => {
  graph.source.connect(graph.inputAnalyser);
  if (enabled) {
    graph.inputAnalyser.connect(graph.compressor);
    graph.compressor.connect(graph.makeupGain);
    graph.makeupGain.connect(graph.outputAnalyser);
    graph.outputAnalyser.connect(graph.destination);
  } else {
    graph.inputAnalyser.connect(graph.outputAnalyser);
    graph.outputAnalyser.connect(graph.destination);
  }
};

const disconnectAllNodes = (graph: AudioGraph): void => {
  try {
    graph.source.disconnect();
    graph.inputAnalyser.disconnect();
    graph.outputAnalyser.disconnect();
    graph.compressor.disconnect();
    graph.makeupGain.disconnect();
  } catch {
    // Already disconnected; ignore.
  }
};

export const createAudioGraph = (
  ctx: AudioContext,
  stream: MediaStream,
  params: CompressorParams,
  enabled: boolean,
): AudioGraph => {
  const source = ctx.createMediaStreamSource(stream);
  const inputAnalyser = ctx.createAnalyser();
  const outputAnalyser = ctx.createAnalyser();
  const compressor = ctx.createDynamicsCompressor();
  const makeupGain = ctx.createGain();

  inputAnalyser.fftSize = 2048;
  outputAnalyser.fftSize = 2048;

  compressor.threshold.value = params.threshold;
  compressor.knee.value = params.knee;
  compressor.ratio.value = params.ratio;
  compressor.attack.value = params.attackMs / 1000;
  compressor.release.value = params.releaseMs / 1000;
  makeupGain.gain.value = computeMakeupLinear(params);

  const graph: AudioGraph = {
    stream,
    source,
    inputAnalyser,
    outputAnalyser,
    compressor,
    makeupGain,
    destination: ctx.destination,
    enabled,
  };
  connectGraphPath(graph, enabled);
  return graph;
};

export const applyParams = (
  graph: AudioGraph,
  params: CompressorParams,
  now: number,
  smoothing = PARAM_SMOOTHING_TIME_CONSTANT,
): void => {
  const { compressor, makeupGain } = graph;
  compressor.threshold.setTargetAtTime(params.threshold, now, smoothing);
  compressor.knee.setTargetAtTime(params.knee, now, smoothing);
  compressor.ratio.setTargetAtTime(params.ratio, now, smoothing);
  compressor.attack.setTargetAtTime(params.attackMs / 1000, now, smoothing);
  compressor.release.setTargetAtTime(params.releaseMs / 1000, now, smoothing);
  makeupGain.gain.setTargetAtTime(computeMakeupLinear(params), now, smoothing);
};

export const setGraphEnabled = (
  graph: AudioGraph,
  enabled: boolean,
  params: CompressorParams,
  now: number,
  smoothing = PARAM_SMOOTHING_TIME_CONSTANT,
): void => {
  if (graph.enabled !== enabled) {
    disconnectAllNodes(graph);
    connectGraphPath(graph, enabled);
    graph.enabled = enabled;
  }
  applyParams(graph, params, now, smoothing);
};

export const disposeGraph = (graph: AudioGraph): void => {
  disconnectAllNodes(graph);
  graph.stream.getTracks().forEach((track) => track.stop());
};
