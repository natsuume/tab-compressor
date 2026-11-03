import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIXER_SETTINGS,
  nextMixerSettingsUpdatedAt,
  normalizeMixerSettings,
  pickNewerMixerSettings,
  type MixerSettings,
} from './mixer-settings';

describe('normalizeMixerSettings', () => {
  it('null や object 以外の値なら既定の設定を返す', () => {
    expect(normalizeMixerSettings(null)).toEqual(DEFAULT_MIXER_SETTINGS);
    expect(normalizeMixerSettings(undefined)).toEqual(DEFAULT_MIXER_SETTINGS);
    expect(normalizeMixerSettings('on')).toEqual(DEFAULT_MIXER_SETTINGS);
  });

  it('autoBalance が true ならそのまま保持する', () => {
    expect(normalizeMixerSettings({ autoBalance: true })).toEqual({
      autoBalance: true,
      updatedAt: 0,
    });
  });

  it('autoBalance が boolean 以外なら false (既定値) にする', () => {
    expect(normalizeMixerSettings({ autoBalance: 'yes' })).toEqual({
      autoBalance: false,
      updatedAt: 0,
    });
  });

  it('autoBalance が欠けていれば false (既定値) にする', () => {
    expect(normalizeMixerSettings({})).toEqual({ autoBalance: false, updatedAt: 0 });
  });

  it('updatedAt が 0 以上の有限の数値ならそのまま保持する', () => {
    expect(normalizeMixerSettings({ autoBalance: true, updatedAt: 1700000000000 }).updatedAt)
      .toBe(1700000000000);
    expect(normalizeMixerSettings({ autoBalance: true, updatedAt: 0 }).updatedAt).toBe(0);
  });

  it('updatedAt が欠落・負数・NaN・Infinity・文字列なら 0 にする', () => {
    expect(normalizeMixerSettings({ autoBalance: true }).updatedAt).toBe(0);
    expect(normalizeMixerSettings({ autoBalance: true, updatedAt: -1 }).updatedAt).toBe(0);
    expect(normalizeMixerSettings({ autoBalance: true, updatedAt: Number.NaN }).updatedAt)
      .toBe(0);
    expect(
      normalizeMixerSettings({ autoBalance: true, updatedAt: Number.POSITIVE_INFINITY }).updatedAt,
    ).toBe(0);
    expect(normalizeMixerSettings({ autoBalance: true, updatedAt: '100' }).updatedAt).toBe(0);
  });
});

describe('pickNewerMixerSettings', () => {
  const current: MixerSettings = { autoBalance: false, updatedAt: 200 };

  it('届いた設定の方が新しければ、届いた設定を採る', () => {
    const incoming: MixerSettings = { autoBalance: true, updatedAt: 300 };
    expect(pickNewerMixerSettings(current, incoming)).toBe(incoming);
  });

  it('保存時刻が同じなら、届いた設定を採る', () => {
    const incoming: MixerSettings = { autoBalance: true, updatedAt: 200 };
    expect(pickNewerMixerSettings(current, incoming)).toBe(incoming);
  });

  it('届いた設定の方が古ければ無視して、手元の設定を保つ', () => {
    const incoming: MixerSettings = { autoBalance: true, updatedAt: 100 };
    expect(pickNewerMixerSettings(current, incoming)).toBe(current);
  });
});

describe('nextMixerSettingsUpdatedAt', () => {
  it('現在時刻が保存済みの値より後なら、現在時刻を返す', () => {
    expect(nextMixerSettingsUpdatedAt(1_000, 5_000)).toBe(5_000);
  });

  it('時計が過去に戻って現在時刻が保存済みの値以下なら、保存済みの値 + 1 を返す', () => {
    expect(nextMixerSettingsUpdatedAt(5_000, 1_000)).toBe(5_001);
    expect(nextMixerSettingsUpdatedAt(5_000, 5_000)).toBe(5_001);
  });

  it('返した値で保存した設定は、保存済みの設定より新しいものとして採られる', () => {
    const stored: MixerSettings = { autoBalance: false, updatedAt: 5_000 };
    const next: MixerSettings = {
      autoBalance: true,
      updatedAt: nextMixerSettingsUpdatedAt(stored.updatedAt, 1_000),
    };
    expect(pickNewerMixerSettings(stored, next)).toBe(next);
  });
});
