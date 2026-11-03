import { describe, expect, it } from 'vitest';
import { DEFAULT_MIXER_SETTINGS, normalizeMixerSettings } from './mixer-settings';

describe('normalizeMixerSettings', () => {
  it('null や object 以外の値なら既定の設定を返す', () => {
    expect(normalizeMixerSettings(null)).toEqual(DEFAULT_MIXER_SETTINGS);
    expect(normalizeMixerSettings(undefined)).toEqual(DEFAULT_MIXER_SETTINGS);
    expect(normalizeMixerSettings('on')).toEqual(DEFAULT_MIXER_SETTINGS);
  });

  it('autoBalance が true ならそのまま保持する', () => {
    expect(normalizeMixerSettings({ autoBalance: true })).toEqual({ autoBalance: true });
  });

  it('autoBalance が boolean 以外なら false (既定値) にする', () => {
    expect(normalizeMixerSettings({ autoBalance: 'yes' })).toEqual({ autoBalance: false });
  });

  it('autoBalance が欠けていれば false (既定値) にする', () => {
    expect(normalizeMixerSettings({})).toEqual({ autoBalance: false });
  });
});
