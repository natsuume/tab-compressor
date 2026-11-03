// ゲインなどの dB 値を符号付き小数 1 桁で表示する (例: +3.2 dB / -1.0 dB)。null は「—」。
// 丸めた結果が 0.0 のときは符号を付けない (-0.04 を -0.0 と表示しない)。
export const formatSignedDb = (db: number | null): string => {
  if (db === null) return '—';
  const magnitude = Math.abs(db).toFixed(1);
  if (magnitude === '0.0') return '0.0 dB';
  return `${db > 0 ? '+' : '-'}${magnitude} dB`;
};
