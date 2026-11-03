import type { CompressorParams } from '@/shared/compressor-params';
import { estimateAutoMakeupCompensationDb } from '@/shared/compressor-curve';
import {
  AUTO_MAKEUP_APPLY_SMOOTHING_SEC,
  MIXER_APPLY_SMOOTHING_SEC,
  PARAM_SMOOTHING_TIME_CONSTANT,
} from '@/shared/constants';
import { computeLimiterCompensationDb, LIMITER_SETTINGS } from '@/shared/limiter';

export type AudioGraph = {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  inputAnalyser: AnalyserNode;
  compressorOutputAnalyser: AnalyserNode;
  outputAnalyser: AnalyserNode;
  compressor: DynamicsCompressorNode;
  makeupGain: GainNode;
  autoMakeupGain: GainNode;
  mixerGain: GainNode;
  limiter: DynamicsCompressorNode;
  limiterCompensationGain: GainNode;
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

// enabled 時の経路:
//   source → inputAnalyser → compressor → compressorOutputAnalyser → makeupGain
//   → autoMakeupGain → mixerGain → limiter → limiterCompensationGain → outputAnalyser → destination
// - compressorOutputAnalyser は自動 Makeup の計測用。makeupGain (静的補正 + 手動 Makeup) の
//   手前で計測するので、自動ゲインが手動 Makeup のオフセットを打ち消さない。
// - mixerGain はタブ間の音量バランスを揃えるミキサーのゲイン (自動補正 + 手動オフセット)。
//   limiter の手前に置き、ミキサーで持ち上げた分もリミッターで抑える。
// - limiter は自動 Makeup などで持ち上げた信号のクリップを防ぐセーフティリミッター。
//   limiterCompensationGain で limiter 自身の内部メイクアップを打ち消す。
// - outputAnalyser は destination 直前に置き、実際に出力される音量を計測する。
//   これにより makeupGain・autoMakeupGain・mixerGain・limiter の変化が Output バーに反映される。
// bypass 時は compressor 以降の処理をスキップし、input/output の値は一致する。
const connectGraphPath = (graph: AudioGraph, enabled: boolean): void => {
  graph.source.connect(graph.inputAnalyser);
  if (enabled) {
    graph.inputAnalyser.connect(graph.compressor);
    graph.compressor.connect(graph.compressorOutputAnalyser);
    graph.compressorOutputAnalyser.connect(graph.makeupGain);
    graph.makeupGain.connect(graph.autoMakeupGain);
    graph.autoMakeupGain.connect(graph.mixerGain);
    graph.mixerGain.connect(graph.limiter);
    graph.limiter.connect(graph.limiterCompensationGain);
    graph.limiterCompensationGain.connect(graph.outputAnalyser);
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
    graph.compressorOutputAnalyser.disconnect();
    graph.outputAnalyser.disconnect();
    graph.compressor.disconnect();
    graph.makeupGain.disconnect();
    graph.autoMakeupGain.disconnect();
    graph.mixerGain.disconnect();
    graph.limiter.disconnect();
    graph.limiterCompensationGain.disconnect();
  } catch {
    // Already disconnected; ignore.
  }
};

export const createAudioGraph = (
  ctx: AudioContext,
  stream: MediaStream,
  params: CompressorParams,
  enabled: boolean,
  initialMixerGainDb: number,
): AudioGraph => {
  const source = ctx.createMediaStreamSource(stream);
  const inputAnalyser = ctx.createAnalyser();
  const compressorOutputAnalyser = ctx.createAnalyser();
  const outputAnalyser = ctx.createAnalyser();
  const compressor = ctx.createDynamicsCompressor();
  const makeupGain = ctx.createGain();
  const autoMakeupGain = ctx.createGain();
  const mixerGain = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  const limiterCompensationGain = ctx.createGain();

  inputAnalyser.fftSize = 2048;
  compressorOutputAnalyser.fftSize = 2048;
  outputAnalyser.fftSize = 2048;

  compressor.threshold.value = params.threshold;
  compressor.knee.value = params.knee;
  compressor.ratio.value = params.ratio;
  compressor.attack.value = params.attackMs / 1000;
  compressor.release.value = params.releaseMs / 1000;
  makeupGain.gain.value = computeMakeupLinear(params);
  // 自動ゲインは処理ループが tick ごとに設定する。それまでは 0 dB (素通し)。
  autoMakeupGain.gain.value = 1;
  // ミキサーのゲインも処理ループが tick ごとに設定する。それまでは呼び出し側が渡した初期値。
  mixerGain.gain.value = dbToLinear(initialMixerGainDb);

  limiter.threshold.value = LIMITER_SETTINGS.threshold;
  limiter.knee.value = LIMITER_SETTINGS.knee;
  limiter.ratio.value = LIMITER_SETTINGS.ratio;
  limiter.attack.value = LIMITER_SETTINGS.attackMs / 1000;
  limiter.release.value = LIMITER_SETTINGS.releaseMs / 1000;
  limiterCompensationGain.gain.value = dbToLinear(computeLimiterCompensationDb());

  const graph: AudioGraph = {
    stream,
    source,
    inputAnalyser,
    compressorOutputAnalyser,
    outputAnalyser,
    compressor,
    makeupGain,
    autoMakeupGain,
    mixerGain,
    limiter,
    limiterCompensationGain,
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

// 自動 Makeup のゲイン (dB) を autoMakeupGain に反映する。
export const setAutoMakeupGainDb = (
  graph: AudioGraph,
  gainDb: number,
  now: number,
  smoothing = AUTO_MAKEUP_APPLY_SMOOTHING_SEC,
): void => {
  graph.autoMakeupGain.gain.setTargetAtTime(dbToLinear(gainDb), now, smoothing);
};

// ミキサーのゲイン (dB) を mixerGain に反映する。
export const setMixerGainDb = (
  graph: AudioGraph,
  gainDb: number,
  now: number,
  smoothing = MIXER_APPLY_SMOOTHING_SEC,
): void => {
  graph.mixerGain.gain.setTargetAtTime(dbToLinear(gainDb), now, smoothing);
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
