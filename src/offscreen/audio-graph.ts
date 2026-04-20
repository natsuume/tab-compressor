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
};

const dbToLinear = (db: number): number => Math.pow(10, db / 20);

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

export const createAudioGraph = (
  ctx: AudioContext,
  stream: MediaStream,
  params: CompressorParams,
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
  makeupGain.gain.value = dbToLinear(estimateAutoMakeupCompensationDb(params));

  source.connect(inputAnalyser);
  inputAnalyser.connect(compressor);
  compressor.connect(outputAnalyser);
  outputAnalyser.connect(makeupGain);
  makeupGain.connect(ctx.destination);

  return { stream, source, inputAnalyser, outputAnalyser, compressor, makeupGain };
};

export const applyParams = (
  compressor: DynamicsCompressorNode,
  makeupGain: GainNode,
  params: CompressorParams,
  now: number,
  smoothing = PARAM_SMOOTHING_TIME_CONSTANT,
): void => {
  const compensationLinear = dbToLinear(estimateAutoMakeupCompensationDb(params));
  compressor.threshold.setTargetAtTime(params.threshold, now, smoothing);
  compressor.knee.setTargetAtTime(params.knee, now, smoothing);
  compressor.ratio.setTargetAtTime(params.ratio, now, smoothing);
  compressor.attack.setTargetAtTime(params.attackMs / 1000, now, smoothing);
  compressor.release.setTargetAtTime(params.releaseMs / 1000, now, smoothing);
  makeupGain.gain.setTargetAtTime(compensationLinear, now, smoothing);
};

export const disposeGraph = (graph: AudioGraph): void => {
  try {
    graph.source.disconnect();
    graph.inputAnalyser.disconnect();
    graph.outputAnalyser.disconnect();
    graph.compressor.disconnect();
    graph.makeupGain.disconnect();
  } catch {
    // Already disconnected; ignore.
  }
  graph.stream.getTracks().forEach((track) => track.stop());
};
