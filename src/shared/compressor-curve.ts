import type { CompressorParams } from './compressor-params';

// Chromium の DynamicsCompressorNode 静的カーブの移植。
// (third_party/blink/renderer/platform/audio/dynamics_compressor_kernel.cc)
//
// Web Audio 仕様 / Chrome 実装のニーは「threshold の上側 [threshold, threshold + knee]」
// に置かれ (threshold 未満は素通し)、ratio 直線はニー終端の出力値にアンカーされる。
// 教科書的な threshold 中心ニーで近似するとカーブ表示が実挙動と最大 10 dB 超ズレ、
// 自動メイクアップ補正も大幅に過大評価される (デフォルトプリセットで約 -8 dB) ため、
// 表示・補正の両方をこの移植カーブで計算する。

const dbToLinear = (db: number): number => Math.pow(10, db / 20);
const linearToDb = (linear: number): number => 20 * Math.log10(linear);

// ニー領域の指数カーブ。x < linearThreshold では恒等 (素通し)。
const kneeCurve = (x: number, k: number, linearThreshold: number): number => {
  if (x < linearThreshold) return x;
  return linearThreshold + (1 - Math.exp(-k * (x - linearThreshold))) / k;
};

// dB-in/dB-out 平面でのニー カーブの傾き (数値微分)。
const slopeAt = (x: number, k: number, linearThreshold: number): number => {
  if (x < linearThreshold) return 1;
  const x2 = x * 1.001;
  const yDb = linearToDb(kneeCurve(x, k, linearThreshold));
  const y2Db = linearToDb(kneeCurve(x2, k, linearThreshold));
  return (y2Db - yDb) / (linearToDb(x2) - linearToDb(x));
};

// ニー終端での傾きが 1/ratio になる k を幾何二分法で解く (Chromium と同じ 15 回反復)。
const kAtSlope = (
  desiredSlope: number,
  kneeThresholdLinear: number,
  linearThreshold: number,
): number => {
  let minK = 0.1;
  let maxK = 10000;
  let k = 5;
  for (let i = 0; i < 15; i += 1) {
    if (slopeAt(kneeThresholdLinear, k, linearThreshold) < desiredSlope) {
      maxK = k;
    } else {
      minK = k;
    }
    k = Math.sqrt(minK * maxK);
  }
  return k;
};

type CurveModel = {
  linearThreshold: number;
  kneeThresholdDb: number;
  kneeThresholdLinear: number;
  // ニー終端での出力 dB。ratio 直線はこの点にアンカーされる
  // (ハードニー直線 threshold + (x - threshold) / ratio とは一致しない)。
  ykneeThresholdDb: number;
  k: number;
  slope: number;
};

const buildCurveModel = (params: CompressorParams): CurveModel => {
  const { threshold, knee, ratio } = params;
  const linearThreshold = dbToLinear(threshold);
  const kneeThresholdDb = threshold + knee;
  const kneeThresholdLinear = dbToLinear(kneeThresholdDb);
  const slope = 1 / ratio;
  const k = kAtSlope(slope, kneeThresholdLinear, linearThreshold);
  const ykneeThresholdDb = linearToDb(kneeCurve(kneeThresholdLinear, k, linearThreshold));
  return { linearThreshold, kneeThresholdDb, kneeThresholdLinear, ykneeThresholdDb, k, slope };
};

// 圧縮カーブ本体 (リニア入力 → リニア出力)。Chromium の Saturate() に対応。
const saturate = (x: number, model: CurveModel): number => {
  if (x < model.kneeThresholdLinear) {
    return kneeCurve(x, model.k, model.linearThreshold);
  }
  const yDb = model.ykneeThresholdDb + model.slope * (linearToDb(x) - model.kneeThresholdDb);
  return dbToLinear(yDb);
};

const computeOutputDbWithModel = (inputDb: number, model: CurveModel): number =>
  linearToDb(saturate(dbToLinear(inputDb), model));

export const computeOutputDb = (inputDb: number, params: CompressorParams): number =>
  computeOutputDbWithModel(inputDb, buildCurveModel(params));

export type CurvePoint = { inputDb: number; outputDb: number };

export const generateCurvePoints = (
  params: CompressorParams,
  minDb = -60,
  maxDb = 0,
  stepDb = 1,
): CurvePoint[] => {
  const model = buildCurveModel(params);
  const points: CurvePoint[] = [];
  for (let inputDb = minDb; inputDb <= maxDb + 1e-9; inputDb += stepDb) {
    points.push({ inputDb, outputDb: computeOutputDbWithModel(inputDb, model) });
  }
  return points;
};

// Chrome の DynamicsCompressorNode は 0 dBFS 基準の自動メイクアップゲイン
// linear_post_gain = pow(1 / curve(1.0), 0.6) を内部適用する
// (dynamics_compressor.cc)。これを打ち消す補正 dB 値 (負値) を返すことで、
// threshold 以下の信号を素通しに近づける。
const CHROME_MAKEUP_EXPONENT = 0.6;

export const estimateAutoMakeupCompensationDb = (params: CompressorParams): number => {
  if (params.ratio <= 1) return 0;
  const fullRangeGainDb = linearToDb(saturate(1, buildCurveModel(params)));
  return CHROME_MAKEUP_EXPONENT * fullRangeGainDb;
};
