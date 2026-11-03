import { describe, expect, it } from 'vitest';
import { AUTO_MAKEUP_CONFIG } from './auto-makeup';
import { computeOutputDb } from './compressor-curve';
import { PARAM_RANGES } from './compressor-params';
import { computeLimiterCompensationDb, LIMITER_SETTINGS } from './limiter';
import { MIXER_CONFIG } from './mixer-balance';
import { MIXER_OFFSET_RANGE } from './tab-mixer';

describe('computeLimiterCompensationDb', () => {
  it('既定のリミッター設定では、Chrome の内部メイクアップ (+1.71 dB) を打ち消す補正を返す', () => {
    // threshold -3 / knee 0 / ratio 20 では curve(0 dBFS) = -2.85 dB で、
    // 内部メイクアップは 0.6 × 2.85 = +1.71 dB になる。
    expect(computeLimiterCompensationDb()).toBeCloseTo(-1.71, 1);
  });
});

describe('LIMITER_SETTINGS', () => {
  it('リミッターより前のゲインがすべて上限のときでも、出力は 0 dBFS 未満に収まる', () => {
    // 内部メイクアップは後段の補正ゲインで打ち消すので、最終出力はリミッターの静的カーブの値になる。
    // compressor 出力 (静的補正後は 0 dBFS 以下) に、手動 Makeup・自動 Makeup・ミキサーの
    // 自動補正・ミキサーのオフセットの上限を足した値が、リミッターに入る最大値になる。
    const maxLimiterInputDb =
      PARAM_RANGES.manualMakeupGainDb.max +
      AUTO_MAKEUP_CONFIG.maxGainDb +
      MIXER_CONFIG.maxAutoGainDb +
      MIXER_OFFSET_RANGE.max;
    expect(computeOutputDb(maxLimiterInputDb, LIMITER_SETTINGS)).toBeLessThan(0);
  });
});
