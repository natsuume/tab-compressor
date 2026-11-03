import { describe, expect, it } from 'vitest';
import {
  AUTO_MAKEUP_CONFIG,
  INITIAL_AUTO_MAKEUP_STATE,
  stepAutoMakeup,
  updateExponentialAverage,
  type AutoMakeupMeasurement,
  type AutoMakeupState,
} from './auto-makeup';

describe('updateExponentialAverage', () => {
  it('前回値が null (未計測) なら今回のサンプルをそのまま返す', () => {
    expect(updateExponentialAverage(null, 0.3, 1 / 30, 3)).toBe(0.3);
  });

  it('経過秒が 0 以下なら前回値を返す', () => {
    expect(updateExponentialAverage(0.1, 0.3, 0, 3)).toBe(0.1);
    expect(updateExponentialAverage(0.1, 0.3, -1, 3)).toBe(0.1);
  });

  it('経過秒が時定数と等しいとき、前回値からサンプルへ約 63.2% 進む', () => {
    // 1 + (2 - 1) * (1 - e^-1) ≈ 1.632
    expect(updateExponentialAverage(1, 2, 3, 3)).toBeCloseTo(1.632, 3);
  });
});

describe('stepAutoMakeup', () => {
  // 入力 0.01 (-20 dB)、compressor 出力 0.0025 (約 -26.02 dB) を 0.1 秒間隔で計測した 1 ブロック。
  // 静的補正 0 なら残差は約 +6.02 dB になる。
  const createMeasurement = (
    overrides: Partial<AutoMakeupMeasurement> = {},
  ): AutoMakeupMeasurement => ({
    inputMeanSquare: 0.01,
    compressedMeanSquare: 0.0025,
    staticCompensationDb: 0,
    dtSec: 0.1,
    ...overrides,
  });

  // 同じ計測値を count 回続けて与えたあとの状態を返す。
  const runSteps = (
    initialState: AutoMakeupState,
    measurement: AutoMakeupMeasurement,
    count: number,
  ): AutoMakeupState => {
    let state = initialState;
    for (let i = 0; i < count; i += 1) {
      state = stepAutoMakeup(state, measurement);
    }
    return state;
  };

  it('同じ計測値が続くと、compressor で下がった分 (約 6.02 dB) に収束する', () => {
    const next = runSteps(INITIAL_AUTO_MAKEUP_STATE, createMeasurement(), 1000);
    expect(next.gainDb).toBeCloseTo(6.02, 1);
  });

  it('makeupGain に掛かっている静的補正 (-2 dB) の分も補った値 (約 8.02 dB) に収束する', () => {
    const next = runSteps(
      INITIAL_AUTO_MAKEUP_STATE,
      createMeasurement({ staticCompensationDb: -2 }),
      1000,
    );
    expect(next.gainDb).toBeCloseTo(8.02, 1);
  });

  it('時定数と同じ経過秒の 1 ブロックでは、残差 (約 6.02 dB) の約 63.2% だけ進む', () => {
    const next = stepAutoMakeup(
      INITIAL_AUTO_MAKEUP_STATE,
      createMeasurement({ dtSec: AUTO_MAKEUP_CONFIG.timeConstantSec }),
    );
    // 6.02 × (1 - e^-1) ≈ 3.81
    expect(next.gainDb).toBeCloseTo(3.81, 1);
  });

  it('入力がゲート未満 (-60 dB) ならゲインを更新しない', () => {
    const state: AutoMakeupState = { gainDb: 3 };
    const next = stepAutoMakeup(state, createMeasurement({ inputMeanSquare: 1e-6 }));
    expect(next).toEqual(state);
  });

  it('compressor 出力が入力より 40 dB 低い状態が続くと、上限に収束する', () => {
    const next = runSteps(
      INITIAL_AUTO_MAKEUP_STATE,
      createMeasurement({ compressedMeanSquare: 1e-6 }),
      1000,
    );
    expect(next.gainDb).toBe(AUTO_MAKEUP_CONFIG.maxGainDb);
  });

  it('compressor 出力が入力より 40 dB 高い状態が続くと、下限に収束する', () => {
    const next = runSteps(
      INITIAL_AUTO_MAKEUP_STATE,
      createMeasurement({ compressedMeanSquare: 100 }),
      1000,
    );
    expect(next.gainDb).toBe(AUTO_MAKEUP_CONFIG.minGainDb);
  });

  it('上限に張り付いた後に残差 0 dB を与えると、すぐに上限から下がり始める', () => {
    const saturated = runSteps(
      INITIAL_AUTO_MAKEUP_STATE,
      createMeasurement({ compressedMeanSquare: 1e-6 }),
      1000,
    );
    expect(saturated.gainDb).toBe(AUTO_MAKEUP_CONFIG.maxGainDb);

    // 入力と compressor 出力が等しく静的補正 0 なので、残差は 0 dB
    const next = stepAutoMakeup(saturated, createMeasurement({ compressedMeanSquare: 0.01 }));
    expect(next.gainDb).toBeLessThan(AUTO_MAKEUP_CONFIG.maxGainDb);
  });

  it('compressor 出力の平均二乗が 0 ならゲインを更新しない', () => {
    const state: AutoMakeupState = { gainDb: 3 };
    const next = stepAutoMakeup(state, createMeasurement({ compressedMeanSquare: 0 }));
    expect(next).toEqual(state);
  });

  it('引数の state と measurement を変更せず、新しい state を返す', () => {
    const state: AutoMakeupState = { gainDb: 1 };
    const measurement = createMeasurement();
    const stateBefore = { ...state };
    const measurementBefore = { ...measurement };

    const next = stepAutoMakeup(state, measurement);

    expect(state).toEqual(stateBefore);
    expect(measurement).toEqual(measurementBefore);
    expect(next).not.toBe(state);
  });
});
