import { clampDb, meanSquareToDb } from './level-math';

// 自動 Makeup: 入力 (compressor 手前) と出力の音量が一致するように、
// compressor で下がった分の音量を補うゲインを計測値から逐次算出する。
// 出力 = compressor 出力 × 静的補正 × 手動 Makeup × 自動ゲイン なので、
// 自動ゲインが定常状態に収束すると「出力 dB = 入力 dB + 手動 Makeup dB」になる。
// 自動ゲインはブロックごとのゲイン低減量 (dB) を時間平均した値に追従するため、
// 短い大音量 (絶叫など) には追従せず、その間の抑圧はそのまま残る。

// 自動 Makeup の制御パラメータ。
export type AutoMakeupConfig = {
  // 残差 (dB) の指数移動平均の時定数 (秒)
  timeConstantSec: number;
  // この RMS (dBFS) 未満の入力ブロックではゲインを更新せず保持する (無音中に持ち上げない)
  gateDb: number;
  // 自動ゲインの下限 (dB)
  minGainDb: number;
  // 自動ゲインの上限 (dB)
  maxGainDb: number;
};

export const AUTO_MAKEUP_CONFIG: AutoMakeupConfig = {
  timeConstantSec: 5,
  gateDb: -50,
  minGainDb: -12,
  maxGainDb: 12,
};

export type AutoMakeupState = {
  // 直近に算出した自動ゲイン (dB)
  gainDb: number;
};

// 初期値 0 dB は「静的補正が正しい」状態から動き始めることを表す。
// ON にした瞬間に大音量が鳴っていても、自動ゲインが跳ね上がらない。
export const INITIAL_AUTO_MAKEUP_STATE: AutoMakeupState = {
  gainDb: 0,
};

export type AutoMakeupMeasurement = {
  // 今回のブロックの入力の平均二乗
  inputMeanSquare: number;
  // 今回のブロックの compressor 出力の平均二乗
  compressedMeanSquare: number;
  // makeupGain に既に掛かっている静的補正 (estimateAutoMakeupCompensationDb の値。通常は負)
  staticCompensationDb: number;
  // 前回の計測からの経過秒
  dtSec: number;
};

// 指数移動平均を 1 ブロック分進める (dB 値・エネルギー値のどちらにも使える汎用の平均)。
// - previous が null (未計測) なら sample をそのまま返す
// - dtSec が 0 以下なら previous をそのまま返す
// - それ以外は previous + (sample - previous) * (1 - exp(-dtSec / timeConstantSec))
//   (dtSec が timeConstantSec に等しいとき、previous から sample へ約 63.2% 進む)
export const updateExponentialAverage = (
  previous: number | null,
  sample: number,
  dtSec: number,
  timeConstantSec: number,
): number => {
  if (previous === null) return sample;
  if (dtSec <= 0) return previous;
  return previous + (sample - previous) * (1 - Math.exp(-dtSec / timeConstantSec));
};

// 計測値 1 ブロック分で自動 Makeup の状態を更新し、新しい状態オブジェクトを返す (引数は変更しない)。
// 1. 入力の RMS (meanSquareToDb(inputMeanSquare)) が config.gateDb 未満なら、state をそのまま返す
// 2. compressedMeanSquare が 0 以下なら、state をそのまま返す
// 3. residualDb = meanSquareToDb(inputMeanSquare) - meanSquareToDb(compressedMeanSquare)
//                 - staticCompensationDb
//    (静的補正は makeupGain で既に掛かっているため、その分を差し引いた残りが自動ゲインの目標)
// 4. gainDb = clamp(
//      updateExponentialAverage(state.gainDb, residualDb, dtSec, config.timeConstantSec),
//      config.minGainDb, config.maxGainDb,
//    )
//    平均した後に clamp するので、上限・下限に張り付いている間も内部値が際限なく伸びず、
//    残差が戻ればすぐに上限・下限から離れ始める。
export const stepAutoMakeup = (
  state: AutoMakeupState,
  measurement: AutoMakeupMeasurement,
  config: AutoMakeupConfig = AUTO_MAKEUP_CONFIG,
): AutoMakeupState => {
  const inputDb = meanSquareToDb(measurement.inputMeanSquare);
  if (inputDb < config.gateDb) return state;
  if (measurement.compressedMeanSquare <= 0) return state;

  const residualDb =
    inputDb
    - meanSquareToDb(measurement.compressedMeanSquare)
    - measurement.staticCompensationDb;
  const averagedDb = updateExponentialAverage(
    state.gainDb,
    residualDb,
    measurement.dtSec,
    config.timeConstantSec,
  );
  return { gainDb: clampDb(averagedDb, config.minGainDb, config.maxGainDb) };
};
