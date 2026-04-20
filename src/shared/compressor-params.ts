export type CompressorParams = {
  threshold: number;
  knee: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  manualMakeupGainDb: number;
};

export const PARAM_RANGES = {
  threshold: { min: -60, max: 0, step: 0.5, unit: 'dB' },
  knee: { min: 0, max: 40, step: 0.5, unit: 'dB' },
  ratio: { min: 1, max: 20, step: 0.1, unit: ':1' },
  attackMs: { min: 0, max: 1000, step: 1, unit: 'ms' },
  releaseMs: { min: 0, max: 1000, step: 1, unit: 'ms' },
  manualMakeupGainDb: { min: -12, max: 12, step: 0.5, unit: 'dB' },
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
  manualMakeupGainDb: 0,
};

export const PARAM_LABELS: Record<keyof CompressorParams, string> = {
  threshold: 'Threshold',
  knee: 'Knee',
  ratio: 'Ratio',
  attackMs: 'Attack',
  releaseMs: 'Release',
  manualMakeupGainDb: 'Makeup',
};

// 旧バージョン保存データや外部入力に manualMakeupGainDb が欠けていても
// 0 dB として扱えるよう補完する。dbToLinear に undefined が渡るのを防ぐ。
export const normalizeCompressorParams = (
  raw: Partial<CompressorParams> | null | undefined,
): CompressorParams => ({
  threshold: raw?.threshold ?? DEFAULT_PARAMS.threshold,
  knee: raw?.knee ?? DEFAULT_PARAMS.knee,
  ratio: raw?.ratio ?? DEFAULT_PARAMS.ratio,
  attackMs: raw?.attackMs ?? DEFAULT_PARAMS.attackMs,
  releaseMs: raw?.releaseMs ?? DEFAULT_PARAMS.releaseMs,
  manualMakeupGainDb: raw?.manualMakeupGainDb ?? DEFAULT_PARAMS.manualMakeupGainDb,
});
