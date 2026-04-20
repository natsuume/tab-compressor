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
