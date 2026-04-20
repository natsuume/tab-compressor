import type { CompressorParams } from '@/shared/compressor-params';
import { PARAM_SMOOTHING_TIME_CONSTANT } from '@/shared/constants';

export type AudioGraph = {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  inputAnalyser: AnalyserNode;
  outputAnalyser: AnalyserNode;
  compressor: DynamicsCompressorNode;
};

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

  inputAnalyser.fftSize = 2048;
  outputAnalyser.fftSize = 2048;

  source.connect(inputAnalyser);
  inputAnalyser.connect(compressor);
  compressor.connect(outputAnalyser);
  outputAnalyser.connect(ctx.destination);

  applyParams(compressor, params, ctx.currentTime, 0);
  return { stream, source, inputAnalyser, outputAnalyser, compressor };
};

export const applyParams = (
  compressor: DynamicsCompressorNode,
  params: CompressorParams,
  now: number,
  smoothing = PARAM_SMOOTHING_TIME_CONSTANT,
): void => {
  if (smoothing <= 0) {
    compressor.threshold.setValueAtTime(params.threshold, now);
    compressor.knee.setValueAtTime(params.knee, now);
    compressor.ratio.setValueAtTime(params.ratio, now);
    compressor.attack.setValueAtTime(params.attackMs / 1000, now);
    compressor.release.setValueAtTime(params.releaseMs / 1000, now);
    return;
  }
  compressor.threshold.setTargetAtTime(params.threshold, now, smoothing);
  compressor.knee.setTargetAtTime(params.knee, now, smoothing);
  compressor.ratio.setTargetAtTime(params.ratio, now, smoothing);
  compressor.attack.setTargetAtTime(params.attackMs / 1000, now, smoothing);
  compressor.release.setTargetAtTime(params.releaseMs / 1000, now, smoothing);
};

export const disposeGraph = (graph: AudioGraph): void => {
  try {
    graph.source.disconnect();
    graph.inputAnalyser.disconnect();
    graph.outputAnalyser.disconnect();
    graph.compressor.disconnect();
  } catch {
    // Already disconnected; ignore.
  }
  graph.stream.getTracks().forEach((track) => track.stop());
};
