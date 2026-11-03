import { describe, expect, it } from 'vitest';
import {
  FALLBACK_PARAMS,
  normalizeCompressorParams,
  type CompressorParams,
} from './compressor-params';

describe('normalizeCompressorParams', () => {
  it('raw が null / undefined なら補完値をそのまま使う', () => {
    expect(normalizeCompressorParams(null)).toEqual(FALLBACK_PARAMS);
    expect(normalizeCompressorParams(undefined)).toEqual(FALLBACK_PARAMS);
  });

  it('autoMakeup が欠けていれば false で補う', () => {
    expect(normalizeCompressorParams({ threshold: -30 }).autoMakeup).toBe(false);
  });

  it('autoMakeup が true ならそのまま保持する', () => {
    expect(normalizeCompressorParams({ autoMakeup: true }).autoMakeup).toBe(true);
  });

  it('autoMakeup が boolean 以外なら false に置き換える', () => {
    const raw = { autoMakeup: 'yes' } as unknown as Partial<CompressorParams>;
    expect(normalizeCompressorParams(raw).autoMakeup).toBe(false);
  });

  it('数値フィールドの欠落も補完値で補い、存在する値は保持する', () => {
    const params = normalizeCompressorParams({ knee: 10 });
    expect(params.threshold).toBe(-20);
    expect(params.knee).toBe(10);
  });
});
