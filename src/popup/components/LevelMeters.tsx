import { DB_FLOOR } from '@/shared/constants';
import type { MeterValues } from '../hooks/useMeterStream';

type LevelMetersProps = {
  values: MeterValues;
};

const METER_MIN_DB = -60;
const METER_MAX_DB = 0;

const dbToScale = (db: number, min: number, max: number): number => {
  if (db <= min) return 0;
  if (db >= max) return 1;
  return (db - min) / (max - min);
};

const formatDb = (db: number): string => {
  if (db <= DB_FLOOR) return '−∞';
  return `${db.toFixed(1)} dB`;
};

const MeterRow = ({
  label,
  db,
  reduction = false,
}: {
  label: string;
  db: number;
  reduction?: boolean;
}) => {
  const scale = reduction
    ? Math.min(1, Math.max(0, -db / 20))
    : dbToScale(db, METER_MIN_DB, METER_MAX_DB);
  return (
    <div className="meter-row">
      <span>{label}</span>
      <div className="meter-row__bar">
        <div
          className={reduction ? 'meter-row__fill meter-row__fill--reduction' : 'meter-row__fill'}
          style={{ transform: `scaleX(${scale})` }}
        />
      </div>
      <span className="meter-row__value">{formatDb(db)}</span>
    </div>
  );
};

export const LevelMeters = ({ values }: LevelMetersProps) => (
  <div className="level-meters">
    <MeterRow label="Input" db={values.inRmsDb} />
    <MeterRow label="Output" db={values.outRmsDb} />
    <MeterRow label="Reduction" db={values.reductionDb} reduction />
  </div>
);
