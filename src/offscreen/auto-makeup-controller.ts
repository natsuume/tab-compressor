import { INITIAL_AUTO_MAKEUP_STATE, stepAutoMakeup } from '@/shared/auto-makeup';
import { estimateAutoMakeupCompensationDb } from '@/shared/compressor-curve';
import { setAutoMakeupGainDb } from './audio-graph';
import type { RegistryEntry } from './graph-registry';
import type { GraphLevels } from './level-sampler';

// 1 tick 分の計測値で自動 Makeup を更新して GainNode に反映し、表示用の自動ゲイン (dB) を返す。
// コンプレッサー OFF または autoMakeup OFF のときは状態を初期化してゲインを 0 dB に戻し、null を返す。
// 状態のリセットとノードの値が食い違わないよう、どちらの場合も毎 tick GainNode に反映する。
export const runAutoMakeupTick = (
  entry: RegistryEntry,
  levels: GraphLevels,
  dtSec: number,
  now: number,
): number | null => {
  if (!entry.graph.enabled || !entry.params.autoMakeup) {
    entry.autoMakeupState = INITIAL_AUTO_MAKEUP_STATE;
    setAutoMakeupGainDb(entry.graph, 0, now);
    return null;
  }

  const next = stepAutoMakeup(entry.autoMakeupState, {
    inputMeanSquare: levels.inputMeanSquare,
    compressedMeanSquare: levels.compressedMeanSquare,
    staticCompensationDb: estimateAutoMakeupCompensationDb(entry.params),
    dtSec,
  });
  entry.autoMakeupState = next;
  setAutoMakeupGainDb(entry.graph, next.gainDb, now);
  return next.gainDb;
};
