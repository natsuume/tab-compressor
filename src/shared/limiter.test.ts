import { describe, expect, it } from 'vitest';
import { AUTO_MAKEUP_CONFIG } from './auto-makeup';
import { computeOutputDb } from './compressor-curve';
import { PARAM_RANGES } from './compressor-params';
import { computeLimiterCompensationDb, LIMITER_SETTINGS } from './limiter';

describe('computeLimiterCompensationDb', () => {
  it('既定のリミッター設定では、Chrome の内部メイクアップ (+1.14 dB) を打ち消す補正を返す', () => {
    // threshold -2 / knee 0 / ratio 20 では curve(0 dBFS) = -1.9 dB で、
    // 内部メイクアップは 0.6 × 1.9 = +1.14 dB になる。
    expect(computeLimiterCompensationDb()).toBeCloseTo(-1.14, 1);
  });
});

describe('LIMITER_SETTINGS', () => {
  it('手動 Makeup と自動 Makeup がどちらも上限のときでも、出力は 0 dBFS 未満に収まる', () => {
    // 内部メイクアップは後段の補正ゲインで打ち消すので、最終出力はリミッターの静的カーブの値になる。
    const maxLimiterInputDb = PARAM_RANGES.manualMakeupGainDb.max + AUTO_MAKEUP_CONFIG.maxGainDb;
    expect(computeOutputDb(maxLimiterInputDb, LIMITER_SETTINGS)).toBeLessThan(0);
  });
});
