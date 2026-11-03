import { describe, expect, it } from 'vitest';
import { formatSignedDb } from './format-db';

describe('formatSignedDb', () => {
  it('null は「—」と表示する', () => {
    expect(formatSignedDb(null)).toBe('—');
  });

  it('0 は符号を付けずに表示する', () => {
    expect(formatSignedDb(0)).toBe('0.0 dB');
  });

  it('丸めて 0.0 になる負の値も、符号を付けずに表示する', () => {
    expect(formatSignedDb(-0.04)).toBe('0.0 dB');
  });

  it('正の値は + を付けて小数 1 桁に丸める', () => {
    expect(formatSignedDb(3.25)).toBe('+3.3 dB');
  });

  it('負の値は - を付けて小数 1 桁で表示する', () => {
    expect(formatSignedDb(-1)).toBe('-1.0 dB');
  });
});
