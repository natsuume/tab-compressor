import { useEffect, useRef, useState } from 'react';
import { BROADCAST_CHANNEL_METERS, DB_FLOOR } from '@/shared/constants';

export type MeterValues = {
  inRmsDb: number;
  inPeakDb: number;
  outRmsDb: number;
  outPeakDb: number;
  reductionDb: number;
};

const EMPTY_METERS: MeterValues = {
  inRmsDb: DB_FLOOR,
  inPeakDb: DB_FLOOR,
  outRmsDb: DB_FLOOR,
  outPeakDb: DB_FLOOR,
  reductionDb: 0,
};

type MeterSample = MeterValues & { tabId: number };
type MeterBatch = { timestamp: number; samples: MeterSample[] };

export const useMeterStream = (tabId: number | null): MeterValues => {
  const [values, setValues] = useState<MeterValues>(EMPTY_METERS);
  const latestRef = useRef<MeterValues>(EMPTY_METERS);

  useEffect(() => {
    if (tabId === null) return;

    const channel = new BroadcastChannel(BROADCAST_CHANNEL_METERS);
    let rafId: number | null = null;

    const onMessage = (event: MessageEvent<MeterBatch>): void => {
      const sample = event.data.samples.find((s) => s.tabId === tabId);
      if (sample === undefined) return;
      latestRef.current = {
        inRmsDb: sample.inRmsDb,
        inPeakDb: sample.inPeakDb,
        outRmsDb: sample.outRmsDb,
        outPeakDb: sample.outPeakDb,
        reductionDb: sample.reductionDb,
      };
    };

    channel.addEventListener('message', onMessage);

    const tick = (): void => {
      setValues(latestRef.current);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      channel.removeEventListener('message', onMessage);
      channel.close();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [tabId]);

  return values;
};
