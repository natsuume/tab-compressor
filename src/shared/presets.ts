import type { CompressorParams } from './compressor-params';

export type PresetId = 'bypass' | 'gentle' | 'scream' | 'broadcast';

export type Preset = {
  id: PresetId;
  name: string;
  description: string;
  params: CompressorParams;
};

export const PRESETS: readonly Preset[] = [
  {
    id: 'gentle',
    name: '絶叫抑制(弱)',
    description: '大きい音だけを軽く抑える。通常視聴向け',
    params: { threshold: -18, knee: 24, ratio: 3, attackMs: 10, releaseMs: 150 },
  },
  {
    id: 'scream',
    name: '絶叫抑制(強)',
    description: '突発的な絶叫をリミッター並に封じる。FPS実況・ホラー配信向け',
    params: { threshold: -32, knee: 4, ratio: 20, attackMs: 1, releaseMs: 50 },
  },
  {
    id: 'broadcast',
    name: '配信向け',
    description: '配信全体の音量差をまとめる一般的なセッティング',
    params: { threshold: -20, knee: 30, ratio: 6, attackMs: 5, releaseMs: 100 },
  },
  {
    id: 'bypass',
    name: 'バイパス相当',
    description: 'ratio=1 で実質無加工',
    params: { threshold: 0, knee: 0, ratio: 1, attackMs: 3, releaseMs: 250 },
  },
] as const;

export const DEFAULT_PRESET_ID: PresetId = 'broadcast';

export const findPreset = (id: PresetId): Preset | undefined =>
  PRESETS.find((preset) => preset.id === id);
