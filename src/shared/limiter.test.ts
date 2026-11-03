import { describe, expect, it } from 'vitest';
import { computeLimiterCompensationDb } from './limiter';

describe('computeLimiterCompensationDb', () => {
  it('既定のリミッター設定では、Chrome の内部メイクアップ (+0.57 dB) を打ち消す補正を返す', () => {
    // threshold -1 / knee 0 / ratio 20 では curve(0 dBFS) = -0.95 dB で、
    // 内部メイクアップは 0.6 × 0.95 = +0.57 dB になる。
    expect(computeLimiterCompensationDb()).toBeCloseTo(-0.57, 1);
  });
});
