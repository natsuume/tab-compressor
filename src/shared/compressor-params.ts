export type CompressorParams = {
  threshold: number;
  knee: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
};

export const PARAM_RANGES = {
  threshold: { min: -60, max: 0, step: 0.5, unit: 'dB' },
  knee: { min: 0, max: 40, step: 0.5, unit: 'dB' },
  ratio: { min: 1, max: 20, step: 0.1, unit: ':1' },
  attackMs: { min: 0, max: 1000, step: 1, unit: 'ms' },
  releaseMs: { min: 0, max: 1000, step: 1, unit: 'ms' },
} as const satisfies Record<
  keyof CompressorParams,
  { min: number; max: number; step: number; unit: string }
>;

export const DEFAULT_PARAMS: CompressorParams = {
  threshold: -20,
  knee: 30,
  ratio: 6,
  attackMs: 5,
  releaseMs: 100,
};

export const PARAM_LABELS: Record<keyof CompressorParams, string> = {
  threshold: 'Threshold',
  knee: 'Knee',
  ratio: 'Ratio',
  attackMs: 'Attack',
  releaseMs: 'Release',
};
