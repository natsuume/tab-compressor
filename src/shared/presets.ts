import type { CompressorParams } from './compressor-params';

export type PresetId = 'quiet';

export type Preset = {
  id: PresetId;
  name: string;
  description: string;
  params: CompressorParams;
};

const QUIET_PRESET: Preset = {
  id: 'quiet',
  name: '静音',
  description: '全体の音量を 4dB 下げつつ、大きい音を抑える',
  params: {
    threshold: -32,
    knee: 30,
    ratio: 6,
    attackMs: 5,
    releaseMs: 100,
    manualMakeupGainDb: -4,
    autoMakeup: false,
  },
};

export const PRESETS: readonly Preset[] = [QUIET_PRESET];

// 新しいタブの初期状態と、自動有効化設定の初期値に使うプリセット。
export const DEFAULT_PRESET: Preset = QUIET_PRESET;

export const DEFAULT_PRESET_ID: PresetId = DEFAULT_PRESET.id;

export const isPresetId = (id: string): id is PresetId =>
  PRESETS.some((preset) => preset.id === id);

export const findPreset = (id: PresetId): Preset | undefined =>
  PRESETS.find((preset) => preset.id === id);
