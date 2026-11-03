import { BROADCAST_CHANNEL_METERS } from '@/shared/constants';
import type { MeterBatch } from '@/shared/meter-sample';

let channel: BroadcastChannel | null = null;

// メーター値を popup へ配信する。BroadcastChannel は初回の配信時に作成する。
export const publishMeterBatch = (batch: MeterBatch): void => {
  channel ??= new BroadcastChannel(BROADCAST_CHANNEL_METERS);
  channel.postMessage(batch);
};
