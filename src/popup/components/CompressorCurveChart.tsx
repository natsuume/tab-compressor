import { useMemo } from 'react';
import type { CompressorParams } from '@/shared/compressor-params';
import { generateCurvePoints } from '@/shared/compressor-curve';

type CompressorCurveChartProps = {
  params: CompressorParams;
  inputDb?: number;
};

const MIN_DB = -60;
const MAX_DB = 0;
const WIDTH = 316;
const HEIGHT = 160;
const PADDING = { top: 8, right: 8, bottom: 20, left: 28 };
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

const dbToX = (db: number): number =>
  PADDING.left + ((db - MIN_DB) / (MAX_DB - MIN_DB)) * PLOT_WIDTH;
const dbToY = (db: number): number =>
  PADDING.top + (1 - (db - MIN_DB) / (MAX_DB - MIN_DB)) * PLOT_HEIGHT;

export const CompressorCurveChart = ({ params, inputDb }: CompressorCurveChartProps) => {
  const polylinePoints = useMemo(() => {
    const points = generateCurvePoints(params, MIN_DB, MAX_DB, 0.5);
    return points.map((p) => `${dbToX(p.inputDb)},${dbToY(p.outputDb)}`).join(' ');
  }, [params]);

  const gridValues = [-60, -40, -20, 0];
  const thresholdX = dbToX(params.threshold);
  const inputMarkerX =
    inputDb !== undefined && inputDb >= MIN_DB && inputDb <= MAX_DB ? dbToX(inputDb) : null;

  return (
    <svg
      className="curve-chart"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="コンプレッサー入出力カーブ"
    >
      {gridValues.map((v) => (
        <g key={v}>
          <line
            x1={dbToX(v)}
            y1={PADDING.top}
            x2={dbToX(v)}
            y2={PADDING.top + PLOT_HEIGHT}
            stroke="#2a2e33"
            strokeWidth={1}
          />
          <line
            x1={PADDING.left}
            y1={dbToY(v)}
            x2={PADDING.left + PLOT_WIDTH}
            y2={dbToY(v)}
            stroke="#2a2e33"
            strokeWidth={1}
          />
          <text x={dbToX(v)} y={HEIGHT - 6} fill="#6e757c" fontSize="9" textAnchor="middle">
            {v}
          </text>
          <text x={6} y={dbToY(v) + 3} fill="#6e757c" fontSize="9">
            {v}
          </text>
        </g>
      ))}

      <line
        x1={dbToX(MIN_DB)}
        y1={dbToY(MIN_DB)}
        x2={dbToX(MAX_DB)}
        y2={dbToY(MAX_DB)}
        stroke="#3a3f45"
        strokeWidth={1}
        strokeDasharray="3 3"
      />

      <line
        x1={thresholdX}
        y1={PADDING.top}
        x2={thresholdX}
        y2={PADDING.top + PLOT_HEIGHT}
        stroke="#dba13c"
        strokeWidth={1}
        strokeDasharray="2 3"
        opacity={0.7}
      />

      <polyline fill="none" stroke="#3fa066" strokeWidth={2} points={polylinePoints} />

      {inputMarkerX !== null && (
        <line
          x1={inputMarkerX}
          y1={PADDING.top}
          x2={inputMarkerX}
          y2={PADDING.top + PLOT_HEIGHT}
          stroke="#d6dbe1"
          strokeOpacity={0.3}
          strokeWidth={1}
        />
      )}
    </svg>
  );
};
