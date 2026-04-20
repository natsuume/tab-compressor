import type { CompressorParams } from './compressor-params';

export const computeOutputDb = (inputDb: number, params: CompressorParams): number => {
  const { threshold, knee, ratio } = params;
  const kneeStart = threshold - knee / 2;
  const kneeEnd = threshold + knee / 2;

  if (inputDb <= kneeStart) {
    return inputDb;
  }

  if (inputDb >= kneeEnd && knee > 0) {
    return threshold + (inputDb - threshold) / ratio;
  }

  if (knee <= 0) {
    return inputDb >= threshold ? threshold + (inputDb - threshold) / ratio : inputDb;
  }

  const x = inputDb - kneeStart;
  const kneeRatioTerm = (1 / ratio - 1) / (2 * knee);
  return inputDb + kneeRatioTerm * x * x;
};

export type CurvePoint = { inputDb: number; outputDb: number };

export const generateCurvePoints = (
  params: CompressorParams,
  minDb = -60,
  maxDb = 0,
  stepDb = 1,
): CurvePoint[] => {
  const points: CurvePoint[] = [];
  for (let inputDb = minDb; inputDb <= maxDb + 1e-9; inputDb += stepDb) {
    points.push({ inputDb, outputDb: computeOutputDb(inputDb, params) });
  }
  return points;
};

// Chrome の DynamicsCompressorNode は内部で 0 dBFS 基準の自動メイクアップゲインを適用する。
// 実装上の経験則: master_linear_gain ≈ pow(10, 0.6 * compression_at_0dBFS / 20)。
// これを打ち消すための補正 dB 値（負値）を返すことで、threshold 以下の信号を素通しに近づける。
const CHROME_MAKEUP_EMPIRICAL_FACTOR = 0.6;

export const estimateAutoMakeupCompensationDb = (params: CompressorParams): number => {
  const { threshold, ratio } = params;
  if (ratio <= 1) return 0;
  const compressionAt0dBFS = -threshold * (1 - 1 / ratio);
  return -CHROME_MAKEUP_EMPIRICAL_FACTOR * compressionAt0dBFS;
};
