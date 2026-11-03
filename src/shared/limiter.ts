import type { CompressorParams } from './compressor-params';
import { estimateAutoMakeupCompensationDb } from './compressor-curve';

// ON のタブの経路末尾に常設するセーフティリミッターの設定 (DynamicsCompressorNode に設定する値)。
// 自動 Makeup やミキサーで持ち上げた信号が 0 dBFS を超えてクリップしないよう、-3 dBFS より上を強く抑える。
// リミッターに入る信号は最大で compressor 出力 (静的補正後は 0 dBFS 以下) + 手動 Makeup の上限 (+12 dB)
// + 自動 Makeup の上限 (+12 dB) + ミキサーの自動補正の上限 (+12 dB) + ミキサーのオフセットの上限 (+12 dB)
// = +48 dBFS。ratio 20 の静的カーブでは threshold -3 なら -3 + 51 / 20 = -0.45 dBFS に収まる
// (-2 では +0.5 dBFS になり超える)。
export type LimiterSettings = Pick<
  CompressorParams,
  'threshold' | 'knee' | 'ratio' | 'attackMs' | 'releaseMs'
>;

export const LIMITER_SETTINGS: LimiterSettings = {
  threshold: -3,
  knee: 0,
  ratio: 20,
  attackMs: 1,
  releaseMs: 100,
};

// Chrome の DynamicsCompressorNode が内部で掛ける自動メイクアップを打ち消す補正 dB (負値) を返す。
// 既定の LIMITER_SETTINGS では curve(0 dBFS) = -2.85 dB で、内部メイクアップは
// 0.6 × 2.85 = +1.71 dB なので、約 -1.71 dB になる。
export const computeLimiterCompensationDb = (
  settings: LimiterSettings = LIMITER_SETTINGS,
): number => estimateAutoMakeupCompensationDb(settings);
