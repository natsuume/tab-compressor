import { METER_INTERVAL_MS } from '@/shared/constants';
import { linearToDb, meanSquareToDb } from '@/shared/level-math';
import type { MeterSample } from '@/shared/meter-sample';
import { runAutoMakeupTick } from './auto-makeup-controller';
import { listEntries } from './graph-registry';
import { sampleGraphLevels } from './level-sampler';
import { publishMeterBatch } from './meter-broadcaster';

// 1 tick で進める経過秒の上限。タイマーが間引かれて tick 間隔が空いたときに、
// 1 ブロックの計測値だけで自動 Makeup の平均が決まってしまわないようにする。
const MAX_TICK_DT_SEC = 0.5;

let timerId: number | null = null;
let lastTickMs: number | null = null;

// 前回 tick からの経過秒。初回は tick 間隔の公称値を使う。
const computeTickDtSec = (nowMs: number): number => {
  if (lastTickMs === null) return METER_INTERVAL_MS / 1000;
  return Math.min((nowMs - lastTickMs) / 1000, MAX_TICK_DT_SEC);
};

// 各タブのレベルを計測し、自動 Makeup を更新してから、メーター値をまとめて配信する。
const tick = (): void => {
  const nowMs = performance.now();
  const dtSec = computeTickDtSec(nowMs);
  lastTickMs = nowMs;

  const samples: MeterSample[] = [];
  for (const entry of listEntries()) {
    const { graph, tabId } = entry;
    const levels = sampleGraphLevels(graph);
    const autoMakeupDb = runAutoMakeupTick(
      entry,
      levels,
      dtSec,
      graph.compressor.context.currentTime,
    );
    samples.push({
      tabId,
      inRmsDb: meanSquareToDb(levels.inputMeanSquare),
      inPeakDb: linearToDb(levels.inputPeak),
      outRmsDb: meanSquareToDb(levels.outputMeanSquare),
      outPeakDb: linearToDb(levels.outputPeak),
      reductionDb: graph.compressor.reduction,
      autoMakeupDb,
    });
  }
  if (samples.length > 0) {
    publishMeterBatch({ timestamp: Date.now(), samples });
  }
};

// METER_INTERVAL_MS 間隔の処理ループを開始する。既に動いていれば何もしない。
export const startProcessingLoop = (): void => {
  if (timerId !== null) return;
  timerId = self.setInterval(tick, METER_INTERVAL_MS);
};
