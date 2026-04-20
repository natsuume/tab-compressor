import type { CompressorParams } from '@/shared/compressor-params';
import { PARAM_LABELS, PARAM_RANGES } from '@/shared/compressor-params';
import { ParameterSlider } from './ParameterSlider';

type ParameterPanelProps = {
  params: CompressorParams;
  disabled?: boolean;
  onChange: (params: CompressorParams) => void;
};

const PRECISION: Record<keyof CompressorParams, number> = {
  threshold: 1,
  knee: 1,
  ratio: 1,
  attackMs: 0,
  releaseMs: 0,
};

export const ParameterPanel = ({ params, disabled = false, onChange }: ParameterPanelProps) => {
  const keys = Object.keys(PARAM_RANGES) as Array<keyof CompressorParams>;
  return (
    <div className="parameter-panel">
      {keys.map((key) => {
        const range = PARAM_RANGES[key];
        return (
          <ParameterSlider
            key={key}
            label={PARAM_LABELS[key]}
            value={params[key]}
            min={range.min}
            max={range.max}
            step={range.step}
            unit={range.unit}
            precision={PRECISION[key]}
            disabled={disabled}
            onChange={(value) => onChange({ ...params, [key]: value })}
          />
        );
      })}
    </div>
  );
};
