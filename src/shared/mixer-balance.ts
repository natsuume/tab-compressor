import { updateExponentialAverage } from './auto-makeup';
import { clampDb, meanSquareToDb } from './level-math';

// ミキサー: コンプレッサー ON のタブのうち「音が出ている」タブの音量の中央値に、各タブの音量を寄せる。
// 中央値を基準にすることで、1 つだけ極端に大きい (または小さい) タブに全体の基準が引っ張られない。
// 比べる相手がいない間は自動補正を動かさない。ON のタブが 1 つだけなら補正を 0 に戻し、
// 音が出ているタブが 1 つ以下の間は直前の補正を据え置く。
// 各タブのミキサーゲイン = 自動補正 (自動追従 ON のとき) + 手動オフセット。
// 自動追従 OFF のときは手動オフセットだけが掛かる、単純なタブ別ボリュームになる。
// 揃える音量 (バランス基準の音量) には手動 Makeup を含めない。手動 Makeup は自動 Makeup と同じく
// 基準に加算するオフセットなので、自動追従 ON でも「他のタブよりその dB だけ大きい・小さい」が残る。

// ミキサーの制御パラメータ。
export type MixerConfig = {
  // タブごとの音量 (dB) の指数移動平均の時定数 (秒)
  loudnessTimeConstantSec: number;
  // 入力の RMS (dBFS) がこれ未満のブロックは無音として扱い、音量の平均を更新しない
  gateDb: number;
  // 最後に音が出てからこの秒数までは「音が出ているタブ」として中央値の計算に含める
  soundingHoldSec: number;
  // 自動補正の下限 (dB)
  minAutoGainDb: number;
  // 自動補正の上限 (dB)
  maxAutoGainDb: number;
  // 状態を初期化してからこの秒数までのブロックは平均に使わない。コンプレッサーを ON にした直後は
  // compressor 出力側の AnalyserNode の窓 (2048 サンプル) がまだ新しい音で埋まっておらず、
  // 実際より低い値を平均の初期値にしてしまうため
  warmupSec: number;
};

export const MIXER_CONFIG: MixerConfig = {
  loudnessTimeConstantSec: 5,
  gateDb: -50,
  soundingHoldSec: 3,
  minAutoGainDb: -12,
  maxAutoGainDb: 12,
  warmupSec: 0.2,
};

// タブ 1 つ分の音量の計測状態。
export type TabLoudnessState = {
  // バランス基準の音量 (dB) の指数移動平均。未計測なら null
  loudnessDb: number | null;
  // 最後に入力がゲートを超えてからの経過秒
  silentSec: number;
  // 状態を初期化してからの経過秒 (warmupSec の判定に使う)
  elapsedSec: number;
};

// 未計測のタブは、一度も音が出ていない (経過秒が無限大) ものとして扱う。
export const INITIAL_TAB_LOUDNESS_STATE: TabLoudnessState = {
  loudnessDb: null,
  silentSec: Number.POSITIVE_INFINITY,
  elapsedSec: 0,
};

export type TabLoudnessMeasurement = {
  // 今回のブロックの入力 RMS (dBFS)。ゲート判定に使う
  inputDb: number;
  // 今回のブロックのバランス基準の音量 (dBFS)。compressor 出力が 0 で計測できなければ null
  balanceLevelDb: number | null;
  // 前回の計測からの経過秒
  dtSec: number;
};

// 計測値 1 ブロック分でタブの音量の状態を更新し、新しい状態オブジェクトを返す (引数は変更しない)。
// どの場合も elapsedSec に dtSec を足す。そのうえで上から順に判定する。
// 1. 足した後の elapsedSec が config.warmupSec 未満なら、loudnessDb と silentSec は据え置く
// 2. inputDb が config.gateDb 未満なら、loudnessDb は据え置き、silentSec に dtSec を足す
// 3. balanceLevelDb が null なら、loudnessDb と silentSec は据え置く
// 4. それ以外は loudnessDb を
//    updateExponentialAverage(loudnessDb, balanceLevelDb, dtSec, config.loudnessTimeConstantSec)
//    で更新し、silentSec を 0 に戻す
export const stepTabLoudness = (
  state: TabLoudnessState,
  measurement: TabLoudnessMeasurement,
  config: MixerConfig = MIXER_CONFIG,
): TabLoudnessState => {
  const elapsedSec = state.elapsedSec + measurement.dtSec;
  if (elapsedSec < config.warmupSec) {
    return { ...state, elapsedSec };
  }
  if (measurement.inputDb < config.gateDb) {
    return { ...state, silentSec: state.silentSec + measurement.dtSec, elapsedSec };
  }
  if (measurement.balanceLevelDb === null) {
    return { ...state, elapsedSec };
  }
  return {
    loudnessDb: updateExponentialAverage(
      state.loudnessDb,
      measurement.balanceLevelDb,
      measurement.dtSec,
      config.loudnessTimeConstantSec,
    ),
    silentSec: 0,
    elapsedSec,
  };
};

// 「音が出ているタブ」か (中央値の計算に含めるか) を返す。
// loudnessDb が計測済みで、silentSec が config.soundingHoldSec 以下なら true。
export const isTabSounding = (
  state: TabLoudnessState,
  config: MixerConfig = MIXER_CONFIG,
): boolean => state.loudnessDb !== null && state.silentSec <= config.soundingHoldSec;

// 中央値を返す。空配列は null。奇数個は中央の値、偶数個は中央 2 値の平均。
// 引数の配列は並べ替えない (コピーしてから数値として並べる)。
export const computeMedian = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

export type AutoBalanceInput = {
  tabId: number;
  loudnessDb: number | null;
  sounding: boolean;
};

// 各タブの自動補正 (dB) を tabId → 補正値の Map で返す。tabs はコンプレッサー ON の全タブ。
// Map に含めないタブは、呼び出し側が前回値を据え置く。上から順に判定する。
// 1. tabs が 2 件未満なら、すべてのタブに 0 を割り当てる。比べる相手のタブが存在しないので
//    補正しない (他のタブを閉じた・OFF にした後に補正が残らないようにする)
// 2. 対象 (sounding が true かつ loudnessDb が計測済みのタブ) が 2 件未満なら、空の Map を返す
//    (他のタブを一時停止しても、残ったタブの音量が跳ねないようにする)
// 3. それ以外は対象だけで中央値 M を求め、対象の各タブに
//    clamp(M - loudnessDb, config.minAutoGainDb, config.maxAutoGainDb) を割り当てる。
//    対象外のタブは Map に含めない
export const computeAutoBalanceGains = (
  tabs: readonly AutoBalanceInput[],
  config: MixerConfig = MIXER_CONFIG,
): Map<number, number> => {
  const gains = new Map<number, number>();
  if (tabs.length < 2) {
    for (const tab of tabs) gains.set(tab.tabId, 0);
    return gains;
  }

  const targets: { tabId: number; loudnessDb: number }[] = [];
  for (const tab of tabs) {
    if (tab.sounding && tab.loudnessDb !== null) {
      targets.push({ tabId: tab.tabId, loudnessDb: tab.loudnessDb });
    }
  }
  if (targets.length < 2) return gains;

  const median = computeMedian(targets.map((target) => target.loudnessDb));
  if (median === null) return gains;
  for (const target of targets) {
    gains.set(
      target.tabId,
      clampDb(median - target.loudnessDb, config.minAutoGainDb, config.maxAutoGainDb),
    );
  }
  return gains;
};

export type BalanceLevelInput = {
  // compressor 出力 (makeupGain 手前) の平均二乗
  compressedMeanSquare: number;
  // makeupGain の静的補正
  staticCompensationDb: number;
  // 自動 Makeup のゲイン。動作していなければ null (0 dB として扱う)
  autoMakeupDb: number | null;
};

// バランス基準の音量 (dBFS) を、compressor 出力の計測値に静的補正と自動 Makeup のゲインを足して求める。
// 手動 Makeup は基準に加算するオフセットとして残すため含めない (ファイル冒頭のコメントを参照)。
// meanSquareToDb(compressedMeanSquare) + staticCompensationDb + (autoMakeupDb ?? 0)
// compressedMeanSquare が 0 以下なら計測できないものとして null を返す
// (DB_FLOOR に丸めた値を音量として平均に入れないため)。
export const estimateBalanceLevelDb = (input: BalanceLevelInput): number | null => {
  if (input.compressedMeanSquare <= 0) return null;
  return (
    meanSquareToDb(input.compressedMeanSquare)
    + input.staticCompensationDb
    + (input.autoMakeupDb ?? 0)
  );
};

// mixerGain に設定するゲイン (dB) を返す。
// 自動追従 ON なら自動補正 + 手動オフセット、OFF なら手動オフセットのみ。
export const computeMixerGainDb = (
  autoBalanceGainDb: number,
  offsetDb: number,
  autoBalance: boolean,
): number => (autoBalance ? autoBalanceGainDb : 0) + offsetDb;
