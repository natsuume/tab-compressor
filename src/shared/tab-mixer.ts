import { clampDb } from './level-math';

// タブごとのミキサーの状態。どちらも chrome.storage.session にタブごとの別キーで保存する
// (手動オフセットは popup、タイトルは SW が書くため、キーを分けて読み込み→書き込みの競合を避ける)。
// tabStorageKey の接頭辞 'tab_' と混ざらないよう、'mixer_' で始まるキーにする。

// 手動オフセットのスライダーの範囲。
export const MIXER_OFFSET_RANGE = { min: -12, max: 12, step: 0.5, unit: 'dB' } as const;

export const mixerOffsetStorageKey = (tabId: number): string => `mixer_offset_${tabId}`;

export const mixerTitleStorageKey = (tabId: number): string => `mixer_title_${tabId}`;

// storage から読んだ手動オフセットを dB 値に整える。
// - 有限の number なら MIXER_OFFSET_RANGE の min / max の範囲に収める
// - それ以外 (未保存の undefined・NaN・Infinity・文字列など) は 0 (音量を変えない)
export const normalizeMixerOffsetDb = (raw: unknown): number => {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return clampDb(raw, MIXER_OFFSET_RANGE.min, MIXER_OFFSET_RANGE.max);
};

// chrome.storage.session からタブの手動オフセット (dB) を読み込む。未保存なら 0。
export const loadMixerOffsetDb = async (tabId: number): Promise<number> => {
  const key = mixerOffsetStorageKey(tabId);
  const result = await chrome.storage.session.get(key);
  return normalizeMixerOffsetDb(result[key]);
};

// chrome.storage.session にタブの手動オフセット (dB) を保存する。
export const saveMixerOffsetDb = async (tabId: number, offsetDb: number): Promise<void> => {
  await chrome.storage.session.set({ [mixerOffsetStorageKey(tabId)]: offsetDb });
};

// chrome.storage.session から記録済みのタブのタイトルを読み込む。未記録 (または文字列以外) なら null。
export const loadTabTitle = async (tabId: number): Promise<string | null> => {
  const key = mixerTitleStorageKey(tabId);
  const result = await chrome.storage.session.get(key);
  const title = result[key];
  return typeof title === 'string' ? title : null;
};

// chrome.storage.session にタブのタイトルを記録する。
export const saveTabTitle = async (tabId: number, title: string): Promise<void> => {
  await chrome.storage.session.set({ [mixerTitleStorageKey(tabId)]: title });
};
