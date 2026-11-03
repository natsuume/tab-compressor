import { estimateAutoMakeupCompensationDb } from '@/shared/compressor-curve';
import { meanSquareToDb } from '@/shared/level-math';
import {
  computeAutoBalanceGains,
  computeMixerGainDb,
  estimateBalanceLevelDb,
  isTabSounding,
  stepTabLoudness,
} from '@/shared/mixer-balance';
import {
  DEFAULT_MIXER_SETTINGS,
  pickNewerMixerSettings,
  type MixerSettings,
} from '@/shared/mixer-settings';
import { setMixerGainDb } from './audio-graph';
import type { RegistryEntry } from './graph-registry';
import type { GraphLevels } from './level-sampler';

// 全タブ共通のミキサー設定 (自動追従の ON / OFF)。Offscreen は chrome.storage を読めないため、
// SW から SET_STREAM / SET_MIXER_SETTINGS で値を受け取る。attach と設定変更の順序が前後しても
// 最新の設定が残るよう、保存時刻 (updatedAt) の新しい方を採る。
let mixerSettings: MixerSettings = DEFAULT_MIXER_SETTINGS;

export const applyMixerSettings = (incoming: MixerSettings): void => {
  mixerSettings = pickNewerMixerSettings(mixerSettings, incoming);
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
// 2. ON のタブ全体で自動補正を求める。結果に含まれないタブ (比べる相手の音が出ていない間など) は
//    前回値を据え置く。ON のタブが 1 つだけになったときは、結果の 0 で補正を外す
// 3. ON の各タブで、自動補正 (自動追従 ON のとき) + 手動オフセットを mixerGain に毎 tick 反映する
// 4. bypass のタブは自動補正を計算せず、表示用の値は null にする。ただし mixerGain は経路に無くても
//    手動オフセットだけの値に毎 tick 保つ。ON に戻したとき (自動補正は 0 から始め直す) に、
//    GainNode が古い補正の値から時定数をかけて移る間だけ意図しない音量になるのを防ぐため
// 自動追従 OFF の間も 1・2 は続ける。ON に戻したときにすぐ補正を始められるようにするため。
export const runMixerTick = (
  inputs: readonly MixerTickInput[],
  dtSec: number,
): Map<number, MixerTickResult> => {
  const { autoBalance } = mixerSettings;
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
      autoBalance,
    );
    setMixerGainDb(entry.graph, mixerGainDb, entry.graph.compressor.context.currentTime);
    results.set(entry.tabId, {
      mixerAutoDb: autoBalance ? entry.autoBalanceGainDb : null,
      mixerGainDb,
    });
  }

  for (const { entry } of inputs) {
    if (entry.graph.enabled) continue;
    setMixerGainDb(entry.graph, entry.mixerOffsetDb, entry.graph.compressor.context.currentTime);
    results.set(entry.tabId, BYPASS_RESULT);
  }
  return results;
};
