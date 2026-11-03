import { describe, expect, it } from 'vitest';
import { DB_FLOOR } from './constants';
import { computeMeanSquare, meanSquareToDb } from './level-math';

describe('computeMeanSquare', () => {
  it('サンプルの二乗の平均を返す', () => {
    expect(computeMeanSquare(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.25);
  });

  it('空配列では 0 を返す', () => {
    expect(computeMeanSquare(new Float32Array([]))).toBe(0);
  });
});

describe('meanSquareToDb', () => {
  it('平均二乗 1 は 0 dB', () => {
    expect(meanSquareToDb(1)).toBeCloseTo(0);
  });

  it('平均二乗 0.01 は -20 dB', () => {
    expect(meanSquareToDb(0.01)).toBeCloseTo(-20);
  });

  it('平均二乗 0 は DB_FLOOR (-100 dB)', () => {
    expect(meanSquareToDb(0)).toBe(DB_FLOOR);
  });

  it('DB_FLOOR を下回る値 (1e-20 = -200 dB) は DB_FLOOR に揃える', () => {
    expect(meanSquareToDb(1e-20)).toBe(DB_FLOOR);
  });
});
