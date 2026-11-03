// dB 値をメーターの表示量 (0〜1) に変換する。minDb 以下は 0、maxDb 以上は 1、その間は線形。
export const dbToMeterScale = (db: number, minDb = -60, maxDb = 0): number => {
  if (db <= minDb) return 0;
  if (db >= maxDb) return 1;
  return (db - minDb) / (maxDb - minDb);
};
