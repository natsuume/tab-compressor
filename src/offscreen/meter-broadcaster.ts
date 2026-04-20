import { BROADCAST_CHANNEL_METERS, METER_INTERVAL_MS } from '@/shared/constants';
import { computePeak, computeRms, linearToDb } from '@/shared/level-math';
import { listEntries } from './graph-registry';

export type MeterSample = {
  tabId: number;
  inRmsDb: number;
  inPeakDb: number;
  outRmsDb: number;
  outPeakDb: number;
  reductionDb: number;
};

export type MeterBatch = {
  timestamp: number;
  samples: MeterSample[];
};

let channel: BroadcastChannel | null = null;
let timerId: number | null = null;
const inBuffer = new Float32Array(2048);
const outBuffer = new Float32Array(2048);

const readMeters = (): MeterBatch => {
  const samples: MeterSample[] = [];
  for (const entry of listEntries()) {
    const { graph, tabId } = entry;
    graph.inputAnalyser.getFloatTimeDomainData(inBuffer);
    graph.outputAnalyser.getFloatTimeDomainData(outBuffer);

    samples.push({
      tabId,
      inRmsDb: linearToDb(computeRms(inBuffer)),
      inPeakDb: linearToDb(computePeak(inBuffer)),
      outRmsDb: linearToDb(computeRms(outBuffer)),
      outPeakDb: linearToDb(computePeak(outBuffer)),
      reductionDb: graph.compressor.reduction,
    });
  }
  return { timestamp: Date.now(), samples };
};

export const startBroadcasting = (): void => {
  if (timerId !== null) return;
  channel ??= new BroadcastChannel(BROADCAST_CHANNEL_METERS);
  timerId = self.setInterval(() => {
    const batch = readMeters();
    if (batch.samples.length === 0) return;
    channel?.postMessage(batch);
  }, METER_INTERVAL_MS);
};

export const stopBroadcasting = (): void => {
  if (timerId !== null) {
    self.clearInterval(timerId);
    timerId = null;
  }
  channel?.close();
  channel = null;
};
