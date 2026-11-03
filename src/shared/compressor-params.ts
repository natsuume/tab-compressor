export type CompressorParams = {
  threshold: number;
  knee: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  manualMakeupGainDb: number;
  // true のとき入出力の音量が一致するように Makeup を自動調整し、
  // manualMakeupGainDb はその基準に加算するオフセットになる。
  autoMakeup: boolean;
};

// スライダーで編集する数値パラメータのキー。
export type NumericCompressorParamKey = Exclude<keyof CompressorParams, 'autoMakeup'>;

export const PARAM_RANGES = {
  threshold: { min: -60, max: 0, step: 0.5, unit: 'dB' },
  knee: { min: 0, max: 40, step: 0.5, unit: 'dB' },
  ratio: { min: 1, max: 20, step: 0.1, unit: ':1' },
  attackMs: { min: 0, max: 1000, step: 1, unit: 'ms' },
  releaseMs: { min: 0, max: 1000, step: 1, unit: 'ms' },
  manualMakeupGainDb: { min: -12, max: 12, step: 0.5, unit: 'dB' },
} as const satisfies Record<
  NumericCompressorParamKey,
  { min: number; max: number; step: number; unit: string }
>;

// 保存データにフィールドが欠けていた場合の補完値。
// manualMakeupGainDb は 0 dB (音量を変えない)、autoMakeup は false (自動調整しない) で補う。
export const FALLBACK_PARAMS: CompressorParams = {
  threshold: -20,
  knee: 30,
  ratio: 6,
  attackMs: 5,
  releaseMs: 100,
  manualMakeupGainDb: 0,
  autoMakeup: false,
};

export const PARAM_LABELS: Record<NumericCompressorParamKey, string> = {
  threshold: 'Threshold',
  knee: 'Knee',
  ratio: 'Ratio',
  attackMs: 'Attack',
  releaseMs: 'Release',
  manualMakeupGainDb: 'Makeup',
};

// 保存データや外部入力に欠けているフィールドを FALLBACK_PARAMS の値で補う。
// dbToLinear に undefined が渡るのを防ぐ。autoMakeup は boolean 以外の値も補完値に置き換える。
export const normalizeCompressorParams = (
  raw: Partial<CompressorParams> | null | undefined,
): CompressorParams => ({
  threshold: raw?.threshold ?? FALLBACK_PARAMS.threshold,
  knee: raw?.knee ?? FALLBACK_PARAMS.knee,
  ratio: raw?.ratio ?? FALLBACK_PARAMS.ratio,
  attackMs: raw?.attackMs ?? FALLBACK_PARAMS.attackMs,
  releaseMs: raw?.releaseMs ?? FALLBACK_PARAMS.releaseMs,
  manualMakeupGainDb: raw?.manualMakeupGainDb ?? FALLBACK_PARAMS.manualMakeupGainDb,
  autoMakeup: typeof raw?.autoMakeup === 'boolean' ? raw.autoMakeup : FALLBACK_PARAMS.autoMakeup,
});
