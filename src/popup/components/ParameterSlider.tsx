import type { ChangeEvent } from 'react';

type ParameterSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  precision?: number;
  onChange: (value: number) => void;
};

const formatValue = (value: number, precision: number, unit: string): string => {
  const formatted = value.toFixed(precision);
  return `${formatted}${unit}`;
};

export const ParameterSlider = ({
  label,
  value,
  min,
  max,
  step,
  unit,
  precision = 1,
  onChange,
}: ParameterSliderProps) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = Number.parseFloat(e.target.value);
    if (Number.isFinite(next)) onChange(next);
  };

  return (
    <label className="parameter-slider">
      <span className="parameter-slider__label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={handleChange} />
      <span className="parameter-slider__value">{formatValue(value, precision, unit)}</span>
    </label>
  );
};
