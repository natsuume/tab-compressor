import { describe, expect, it } from 'vitest';
import { STORAGE_KEY_PREFIX } from './constants';
import {
  MIXER_OFFSET_RANGE,
  mixerOffsetStorageKey,
  mixerTitleStorageKey,
  normalizeMixerOffsetDb,
} from './tab-mixer';

describe('mixerOffsetStorageKey / mixerTitleStorageKey', () => {
  it('タブ ID ごとに mixer_ で始まるキーを返す', () => {
    expect(mixerOffsetStorageKey(5)).toBe('mixer_offset_5');
    expect(mixerTitleStorageKey(5)).toBe('mixer_title_5');
  });

  it('TabState のキーの接頭辞 (tab_) で始まらない', () => {
    expect(mixerOffsetStorageKey(5).startsWith(STORAGE_KEY_PREFIX)).toBe(false);
    expect(mixerTitleStorageKey(5).startsWith(STORAGE_KEY_PREFIX)).toBe(false);
  });
});

describe('normalizeMixerOffsetDb', () => {
  it('範囲内の数値はそのまま返す', () => {
    expect(normalizeMixerOffsetDb(3.5)).toBe(3.5);
  });

  it('範囲外の数値は上限・下限 (±12 dB) に収める', () => {
    expect(normalizeMixerOffsetDb(20)).toBe(MIXER_OFFSET_RANGE.max);
    expect(normalizeMixerOffsetDb(-20)).toBe(MIXER_OFFSET_RANGE.min);
  });

  it('有限の数値以外 (未保存・NaN・Infinity・文字列) は 0 にする', () => {
    expect(normalizeMixerOffsetDb(undefined)).toBe(0);
    expect(normalizeMixerOffsetDb(Number.NaN)).toBe(0);
    expect(normalizeMixerOffsetDb(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeMixerOffsetDb('3')).toBe(0);
  });
});
