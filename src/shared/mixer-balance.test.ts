import { describe, expect, it } from 'vitest';
import {
  computeAutoBalanceGains,
  computeMedian,
  computeMixerGainDb,
  estimateBalanceLevelDb,
  INITIAL_TAB_LOUDNESS_STATE,
  isTabSounding,
  MIXER_CONFIG,
  stepTabLoudness,
  type TabLoudnessMeasurement,
  type TabLoudnessState,
} from './mixer-balance';

// warm-up を過ぎた未計測の状態 (ON にしてから十分時間が経ち、まだ音が出ていないタブ)。
const WARMED_UP_INITIAL_STATE: TabLoudnessState = {
  ...INITIAL_TAB_LOUDNESS_STATE,
  elapsedSec: MIXER_CONFIG.warmupSec,
};

describe('stepTabLoudness', () => {
  it('warm-up を過ぎた未計測の状態にゲート以上のブロックを与えると、その音量で平均を始めて無音の経過秒を 0 にする', () => {
    const next = stepTabLoudness(WARMED_UP_INITIAL_STATE, {
      inputDb: -20,
      balanceLevelDb: -24,
      dtSec: 0.1,
    });
    expect(next.loudnessDb).toBe(-24);
    expect(next.silentSec).toBe(0);
    expect(next.elapsedSec).toBeCloseTo(MIXER_CONFIG.warmupSec + 0.1);
  });

  it('初期化から warm-up (0.2 秒) 未満のブロックは、ゲート以上でも平均に使わない', () => {
    const next = stepTabLoudness(INITIAL_TAB_LOUDNESS_STATE, {
      inputDb: -20,
      balanceLevelDb: -90,
      dtSec: 0.1,
    });
    expect(next.loudnessDb).toBeNull();
    expect(next.silentSec).toBe(Number.POSITIVE_INFINITY);
    expect(next.elapsedSec).toBeCloseTo(0.1);
  });

  it('warm-up を過ぎた最初のブロックから平均に使う', () => {
    const afterWarmup = stepTabLoudness(
      { ...INITIAL_TAB_LOUDNESS_STATE, elapsedSec: 0.15 },
      { inputDb: -20, balanceLevelDb: -24, dtSec: 0.1 },
    );
    expect(afterWarmup.loudnessDb).toBe(-24);
  });

  it('入力がゲート未満なら、音量の平均は据え置き、無音の経過秒が dtSec だけ増える', () => {
    const state: TabLoudnessState = { loudnessDb: -24, silentSec: 1, elapsedSec: 10 };
    const next = stepTabLoudness(state, { inputDb: -60, balanceLevelDb: -70, dtSec: 0.1 });
    expect(next.loudnessDb).toBe(-24);
    expect(next.silentSec).toBeCloseTo(1.1);
  });

  it('バランス基準の音量が計測できない (null) ブロックでは、音量の平均と無音の経過秒を据え置く', () => {
    const state: TabLoudnessState = { loudnessDb: -24, silentSec: 1, elapsedSec: 10 };
    const next = stepTabLoudness(state, { inputDb: -20, balanceLevelDb: null, dtSec: 0.1 });
    expect(next.loudnessDb).toBe(-24);
    expect(next.silentSec).toBe(1);
    expect(next.elapsedSec).toBeCloseTo(10.1);
  });

  it('時定数と同じ経過秒の 1 ブロックでは、前回の平均から今回の音量へ約 63.2% 進む', () => {
    const state: TabLoudnessState = { loudnessDb: -24, silentSec: 0, elapsedSec: 10 };
    const next = stepTabLoudness(state, {
      inputDb: -20,
      balanceLevelDb: -14,
      dtSec: MIXER_CONFIG.loudnessTimeConstantSec,
    });
    // -24 + 10 × (1 - e^-1) ≈ -17.68
    expect(next.loudnessDb).toBeCloseTo(-17.68, 2);
    expect(next.silentSec).toBe(0);
  });

  it('引数の state と measurement を変更せず、ゲートの有無に関わらず新しい state を返す', () => {
    const state: TabLoudnessState = { loudnessDb: -24, silentSec: 1, elapsedSec: 10 };
    const sounding: TabLoudnessMeasurement = { inputDb: -20, balanceLevelDb: -14, dtSec: 0.1 };
    const silent: TabLoudnessMeasurement = { inputDb: -60, balanceLevelDb: -70, dtSec: 0.1 };
    const stateBefore = { ...state };
    const soundingBefore = { ...sounding };
    const silentBefore = { ...silent };

    const afterSounding = stepTabLoudness(state, sounding);
    const afterSilent = stepTabLoudness(state, silent);

    expect(state).toEqual(stateBefore);
    expect(sounding).toEqual(soundingBefore);
    expect(silent).toEqual(silentBefore);
    expect(afterSounding).not.toBe(state);
    expect(afterSilent).not.toBe(state);
  });
});

describe('isTabSounding', () => {
  it('音量が未計測なら、無音の経過秒に関わらず false', () => {
    expect(isTabSounding({ loudnessDb: null, silentSec: 0, elapsedSec: 10 })).toBe(false);
  });

  it('音が出た直後 (経過秒 0) は true', () => {
    expect(isTabSounding({ loudnessDb: -20, silentSec: 0, elapsedSec: 10 })).toBe(true);
  });

  it('無音の経過秒が保持時間 (3 秒) ちょうどまでは true', () => {
    expect(isTabSounding({ loudnessDb: -20, silentSec: 3, elapsedSec: 10 })).toBe(true);
  });

  it('無音の経過秒が保持時間 (3 秒) を超えると false', () => {
    expect(isTabSounding({ loudnessDb: -20, silentSec: 3.1, elapsedSec: 10 })).toBe(false);
  });
});

describe('computeMedian', () => {
  it('空配列では null を返す', () => {
    expect(computeMedian([])).toBeNull();
  });

  it('1 個ならその値を返す', () => {
    expect(computeMedian([3])).toBe(3);
  });

  it('奇数個なら並べたときの中央の値を返す', () => {
    expect(computeMedian([5, 1, 3])).toBe(3);
  });

  it('偶数個なら中央 2 値の平均を返す', () => {
    expect(computeMedian([4, 1, 3, 2])).toBe(2.5);
  });

  it('文字列としてではなく数値として並べる', () => {
    // 文字列として並べると [10, 2, 3] の順になり、中央が 2 になってしまう
    expect(computeMedian([10, 2, 3])).toBe(3);
  });

  it('引数の配列の順序を変えない', () => {
    const values = [5, 1, 3];
    computeMedian(values);
    expect(values).toEqual([5, 1, 3]);
  });
});

describe('computeAutoBalanceGains', () => {
  it('音が出ているタブの中央値に、各タブを寄せる補正を返す', () => {
    const gains = computeAutoBalanceGains([
      { tabId: 1, loudnessDb: -30, sounding: true },
      { tabId: 2, loudnessDb: -20, sounding: true },
      { tabId: 3, loudnessDb: -10, sounding: true },
    ]);
    expect(gains).toEqual(new Map([[1, 10], [2, 0], [3, -10]]));
  });

  it('音が出ていないタブと未計測のタブは、Map に含めず中央値の計算にも使わない', () => {
    // 対象は -30 / -10 の 2 タブで中央値は -20。-40 のタブを含めると中央値は -30 になる
    const gains = computeAutoBalanceGains([
      { tabId: 1, loudnessDb: -30, sounding: true },
      { tabId: 2, loudnessDb: -10, sounding: true },
      { tabId: 3, loudnessDb: -40, sounding: false },
      { tabId: 4, loudnessDb: null, sounding: true },
    ]);
    expect(gains).toEqual(new Map([[1, 10], [2, -10]]));
  });

  it('中央値との差が上限・下限 (±12 dB) を超えるタブは、上限・下限に収める', () => {
    const raised = computeAutoBalanceGains([
      { tabId: 1, loudnessDb: -40, sounding: true },
      { tabId: 2, loudnessDb: -20, sounding: true },
      { tabId: 3, loudnessDb: -20, sounding: true },
    ]);
    expect(raised).toEqual(new Map([[1, MIXER_CONFIG.maxAutoGainDb], [2, 0], [3, 0]]));

    const lowered = computeAutoBalanceGains([
      { tabId: 1, loudnessDb: -20, sounding: true },
      { tabId: 2, loudnessDb: -20, sounding: true },
      { tabId: 3, loudnessDb: 0, sounding: true },
    ]);
    expect(lowered).toEqual(new Map([[1, 0], [2, 0], [3, MIXER_CONFIG.minAutoGainDb]]));
  });

  it('対象のタブが 0 件なら空の Map を返す', () => {
    expect(computeAutoBalanceGains([]).size).toBe(0);
    expect(
      computeAutoBalanceGains([
        { tabId: 1, loudnessDb: -20, sounding: false },
        { tabId: 2, loudnessDb: null, sounding: true },
      ]).size,
    ).toBe(0);
  });

  it('対象のタブが 1 件なら、そのタブの補正は 0', () => {
    const gains = computeAutoBalanceGains([
      { tabId: 1, loudnessDb: -25, sounding: true },
      { tabId: 2, loudnessDb: -10, sounding: false },
    ]);
    expect(gains).toEqual(new Map([[1, 0]]));
  });
});

describe('estimateBalanceLevelDb', () => {
  it('compressor 出力の音量に、静的補正と自動 Makeup を足す (手動 Makeup は含めない)', () => {
    // -20 + (-3) + 2 = -21
    expect(
      estimateBalanceLevelDb({
        compressedMeanSquare: 0.01,
        staticCompensationDb: -3,
        autoMakeupDb: 2,
      }),
    ).toBeCloseTo(-21);
  });

  it('自動 Makeup が動作していない (null) なら 0 dB として扱う', () => {
    // -20 + (-3) = -23
    expect(
      estimateBalanceLevelDb({
        compressedMeanSquare: 0.01,
        staticCompensationDb: -3,
        autoMakeupDb: null,
      }),
    ).toBeCloseTo(-23);
  });

  it('compressor 出力の平均二乗が 0 なら、計測できないものとして null を返す', () => {
    expect(
      estimateBalanceLevelDb({
        compressedMeanSquare: 0,
        staticCompensationDb: -3,
        autoMakeupDb: null,
      }),
    ).toBeNull();
  });
});

describe('computeMixerGainDb', () => {
  it('自動追従 ON なら、自動補正と手動オフセットを足す', () => {
    expect(computeMixerGainDb(5, -2, true)).toBe(3);
  });

  it('自動追従 OFF なら、手動オフセットだけを返す', () => {
    expect(computeMixerGainDb(5, -2, false)).toBe(-2);
  });
});
