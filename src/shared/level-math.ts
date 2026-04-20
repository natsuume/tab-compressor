import { DB_FLOOR } from './constants';

export const computeRms = (samples: Float32Array): number => {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i] ?? 0;
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / samples.length);
};

export const computePeak = (samples: Float32Array): number => {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const abs = Math.abs(samples[i] ?? 0);
    if (abs > peak) peak = abs;
  }
  return peak;
};

export const linearToDb = (linear: number): number => {
  if (linear <= 0) return DB_FLOOR;
  const db = 20 * Math.log10(linear);
  return db < DB_FLOOR ? DB_FLOOR : db;
};

export const dbToLinear = (db: number): number => 10 ** (db / 20);

export const clampDb = (db: number, min = DB_FLOOR, max = 0): number => {
  if (db < min) return min;
  if (db > max) return max;
  return db;
};
