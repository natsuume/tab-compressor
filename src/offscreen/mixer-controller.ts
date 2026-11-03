import { estimateAutoMakeupCompensationDb } from '@/shared/compressor-curve';
import { meanSquareToDb } from '@/shared/level-math';
import {
  computeAutoBalanceGains,
  computeMixerGainDb,
  estimateBalanceLevelDb,
  isTabSounding,
  stepTabLoudness,
} from '@/shared/mixer-balance';
import { setMixerGainDb } from './audio-graph';
import type { RegistryEntry } from './graph-registry';
import type { GraphLevels } from './level-sampler';

// 自動追従 (音量バランスを自動で揃える) の ON / OFF。全タブ共通の設定で、
// SET_STREAM / SET_AUTO_BALANCE で受け取った値に更新する。
let autoBalanceEnabled = false;

export const setAutoBalanceEnabled = (enabled: boolean): void => {
  autoBalanceEnabled = enabled;
};

export type MixerTickInput = {
  entry: RegistryEntry;
  levels: GraphLevels;
  // 同じ tick で算出した自動 Makeup のゲイン。動作していなければ null
  autoMakeupDb: number | null;
};

export type MixerTickResult = {
  // 自動追従による補正 (dB)。自動追従 OFF・bypass 中は null
  mixerAutoDb: number | null;
  // mixerGain に掛けている合計 (dB)。bypass 中は null
  mixerGainDb: number | null;
};

const BYPASS_RESULT: MixerTickResult = { mixerAutoDb: null, mixerGainDb: null };

// 1 tick 分の計測値で全タブのミキサーを更新して GainNode に反映し、tabId ごとの表示用の値を返す。
// 中央値は全タブの音量から求めるため、タブごとではなく全タブ分をまとめて処理する。
// 1. コンプレッサー ON の各タブで、揃える音量 (バランス基準の音量) の平均を更新する
// 2. ON のタブ全体で自動補正を求める。結果に含まれない (音が出ていない) タブは前回値を保持する
// 3. ON の各タブで、自動補正 (自動追従 ON のとき) + 手動オフセットを mixerGain に毎 tick 反映する
// 4. bypass のタブはミキサーが経路に無いので計算せず、表示用の値は null にする
// 自動追従 OFF の間も 1・2 は続ける。ON に戻したときにすぐ補正を始められるようにするため。
export const runMixerTick = (
  inputs: readonly MixerTickInput[],
  dtSec: number,
): Map<number, MixerTickResult> => {
  const enabledInputs = inputs.filter(({ entry }) => entry.graph.enabled);

  for (const { entry, levels, autoMakeupDb } of enabledInputs) {
    const balanceLevelDb = estimateBalanceLevelDb({
      compressedMeanSquare: levels.compressedMeanSquare,
      staticCompensationDb: estimateAutoMakeupCompensationDb(entry.params),
      autoMakeupDb,
    });
    entry.loudnessState = stepTabLoudness(entry.loudnessState, {
      inputDb: meanSquareToDb(levels.inputMeanSquare),
      balanceLevelDb,
      dtSec,
    });
  }

  const autoBalanceGains = computeAutoBalanceGains(
    enabledInputs.map(({ entry }) => ({
      tabId: entry.tabId,
      loudnessDb: entry.loudnessState.loudnessDb,
      sounding: isTabSounding(entry.loudnessState),
    })),
  );

  const results = new Map<number, MixerTickResult>();
  for (const { entry } of enabledInputs) {
    const autoBalanceGainDb = autoBalanceGains.get(entry.tabId);
    if (autoBalanceGainDb !== undefined) {
      entry.autoBalanceGainDb = autoBalanceGainDb;
    }
    const mixerGainDb = computeMixerGainDb(
      entry.autoBalanceGainDb,
      entry.mixerOffsetDb,
      autoBalanceEnabled,
    );
    setMixerGainDb(entry.graph, mixerGainDb, entry.graph.compressor.context.currentTime);
    results.set(entry.tabId, {
      mixerAutoDb: autoBalanceEnabled ? entry.autoBalanceGainDb : null,
      mixerGainDb,
    });
  }

  for (const { entry } of inputs) {
    if (!entry.graph.enabled) results.set(entry.tabId, BYPASS_RESULT);
  }
  return results;
};
