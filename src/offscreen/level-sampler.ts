import { computeMeanSquare, computePeak } from '@/shared/level-math';
import type { AudioGraph } from './audio-graph';

// グラフ上の 3 か所 (入力・compressor 出力・最終出力) で計測したレベル (リニア値)。
export type GraphLevels = {
  inputMeanSquare: number;
  inputPeak: number;
  compressedMeanSquare: number;
  outputMeanSquare: number;
  outputPeak: number;
};

// AnalyserNode の fftSize (2048) と同じ長さ。計測ごとに上書きして使い回す。
const sampleBuffer = new Float32Array(2048);

// 各 AnalyserNode の直近の波形を読み、平均二乗とピークを計算する。
export const sampleGraphLevels = (graph: AudioGraph): GraphLevels => {
  graph.inputAnalyser.getFloatTimeDomainData(sampleBuffer);
  const inputMeanSquare = computeMeanSquare(sampleBuffer);
  const inputPeak = computePeak(sampleBuffer);

  graph.compressorOutputAnalyser.getFloatTimeDomainData(sampleBuffer);
  const compressedMeanSquare = computeMeanSquare(sampleBuffer);

  graph.outputAnalyser.getFloatTimeDomainData(sampleBuffer);
  const outputMeanSquare = computeMeanSquare(sampleBuffer);
  const outputPeak = computePeak(sampleBuffer);

  return { inputMeanSquare, inputPeak, compressedMeanSquare, outputMeanSquare, outputPeak };
};
