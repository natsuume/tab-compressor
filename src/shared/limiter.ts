import type { CompressorParams } from './compressor-params';

// ON のタブの経路末尾に常設するセーフティリミッターの設定 (DynamicsCompressorNode に設定する値)。
// 自動 Makeup などで持ち上げた信号が 0 dBFS を超えてクリップしないよう、-1 dBFS より上を強く抑える。
export type LimiterSettings = Pick<
  CompressorParams,
  'threshold' | 'knee' | 'ratio' | 'attackMs' | 'releaseMs'
>;

export const LIMITER_SETTINGS: LimiterSettings = {
  threshold: -1,
  knee: 0,
  ratio: 20,
  attackMs: 1,
  releaseMs: 100,
};

// Chrome の DynamicsCompressorNode が内部で掛ける自動メイクアップを打ち消す補正 dB (負値) を返す。
// 既定の LIMITER_SETTINGS では curve(0 dBFS) = -0.95 dB で、内部メイクアップは
// 0.6 × 0.95 = +0.57 dB なので、約 -0.57 dB になる。
export const computeLimiterCompensationDb = (
  _settings: LimiterSettings = LIMITER_SETTINGS,
): number => {
  throw new Error('not implemented');
};
