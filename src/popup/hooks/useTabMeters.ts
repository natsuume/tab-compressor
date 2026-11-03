import { useEffect, useRef, useState } from 'react';
import { BROADCAST_CHANNEL_METERS } from '@/shared/constants';
import type { MeterBatch } from '@/shared/meter-sample';
import type { MeterValues } from './useMeterStream';

const EMPTY_TAB_METERS: ReadonlyMap<number, MeterValues> = new Map();

// 計測中の全タブの最新のメーター値を、tabId → MeterValues の Map で返す。
// useMeterStream と同じく、BroadcastChannel で受けた最新の値を requestAnimationFrame ごとに画面へ反映する。
export const useTabMeters = (): ReadonlyMap<number, MeterValues> => {
  const [meters, setMeters] = useState<ReadonlyMap<number, MeterValues>>(EMPTY_TAB_METERS);
  const latestRef = useRef<ReadonlyMap<number, MeterValues>>(EMPTY_TAB_METERS);

  useEffect(() => {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_METERS);
    let rafId: number | null = null;

    const onMessage = (event: MessageEvent<MeterBatch>): void => {
      const next = new Map<number, MeterValues>();
      for (const { tabId, ...values } of event.data.samples) {
        next.set(tabId, values);
      }
      latestRef.current = next;
    };

    channel.addEventListener('message', onMessage);

    const tick = (): void => {
      setMeters(latestRef.current);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      channel.removeEventListener('message', onMessage);
      channel.close();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return meters;
};
