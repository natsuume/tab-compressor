import { describe, expect, it } from 'vitest';
import { dbToMeterScale } from './meter-scale';

describe('dbToMeterScale', () => {
  it('下限 (-60 dB) 以下は 0', () => {
    expect(dbToMeterScale(-60)).toBe(0);
    expect(dbToMeterScale(-80)).toBe(0);
  });

  it('上限 (0 dB) 以上は 1', () => {
    expect(dbToMeterScale(0)).toBe(1);
    expect(dbToMeterScale(6)).toBe(1);
  });

  it('下限と上限の中間は 0.5', () => {
    expect(dbToMeterScale(-30)).toBe(0.5);
  });
});
