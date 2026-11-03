import type { CompressorParams } from './compressor-params';
import { estimateAutoMakeupCompensationDb } from './compressor-curve';

// ON のタブの経路末尾に常設するセーフティリミッターの設定 (DynamicsCompressorNode に設定する値)。
// 自動 Makeup などで持ち上げた信号が 0 dBFS を超えてクリップしないよう、-2 dBFS より上を強く抑える。
// リミッターに入る信号は最大で compressor 出力 (静的補正後は 0 dBFS 以下) + 手動 Makeup の上限 (+12 dB)
// + 自動 Makeup の上限 (+12 dB) = +24 dBFS。ratio 20 の静的カーブでは
// threshold -2 なら -2 + 26 / 20 = -0.7 dBFS に収まる (-1 では +0.25 dBFS になり超える)。
export type LimiterSettings = Pick<
  CompressorParams,
  'threshold' | 'knee' | 'ratio' | 'attackMs' | 'releaseMs'
>;

export const LIMITER_SETTINGS: LimiterSettings = {
  threshold: -2,
  knee: 0,
  ratio: 20,
  attackMs: 1,
  releaseMs: 100,
};

// Chrome の DynamicsCompressorNode が内部で掛ける自動メイクアップを打ち消す補正 dB (負値) を返す。
// 既定の LIMITER_SETTINGS では curve(0 dBFS) = -1.9 dB で、内部メイクアップは
// 0.6 × 1.9 = +1.14 dB なので、約 -1.14 dB になる。
export const computeLimiterCompensationDb = (
  settings: LimiterSettings = LIMITER_SETTINGS,
): number => estimateAutoMakeupCompensationDb(settings);
