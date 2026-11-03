import type { CompressorParams, NumericCompressorParamKey } from '@/shared/compressor-params';
import { PARAM_LABELS, PARAM_RANGES } from '@/shared/compressor-params';
import { ParameterSlider } from './ParameterSlider';
import { AutoMakeupToggle } from './AutoMakeupToggle';

type ParameterPanelProps = {
  params: CompressorParams;
  disabled?: boolean;
  // 現在の自動ゲイン (dB)。自動 Makeup が動作していないときは null
  autoMakeupDb: number | null;
  onChange: (params: CompressorParams) => void;
};

const PRECISION: Record<NumericCompressorParamKey, number> = {
  threshold: 1,
  knee: 1,
  ratio: 1,
  attackMs: 0,
  releaseMs: 0,
  manualMakeupGainDb: 1,
};

export const ParameterPanel = ({
  params,
  disabled = false,
  autoMakeupDb,
  onChange,
}: ParameterPanelProps) => {
  const keys = Object.keys(PARAM_RANGES) as NumericCompressorParamKey[];
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
      <AutoMakeupToggle
        checked={params.autoMakeup}
        disabled={disabled}
        autoMakeupDb={autoMakeupDb}
        onChange={(next) => onChange({ ...params, autoMakeup: next })}
      />
    </div>
  );
};
