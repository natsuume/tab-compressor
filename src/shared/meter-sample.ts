// Offscreen から popup へ BroadcastChannel で配信する、タブ 1 つ分のメーター値。
export type MeterSample = {
  tabId: number;
  inRmsDb: number;
  inPeakDb: number;
  outRmsDb: number;
  outPeakDb: number;
  reductionDb: number;
  // 現在の自動ゲイン (dB)。自動 Makeup が動作していない (コンプ OFF / autoMakeup OFF) ときは null
  autoMakeupDb: number | null;
  // ミキサーの自動追従による補正 (dB)。自動追従 OFF・bypass 中は null
  mixerAutoDb: number | null;
  // mixerGain に掛けている合計 (自動補正 + 手動オフセット、dB)。bypass 中は null
  mixerGainDb: number | null;
};

// 1 回の配信で送る、計測中の全タブ分のメーター値。
export type MeterBatch = {
  timestamp: number;
  samples: MeterSample[];
};
