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
export const normalizeMixerOffsetDb = (_raw: unknown): number => {
  throw new Error('not implemented');
};

// chrome.storage.session からタブの手動オフセット (dB) を読み込む。未保存なら 0。
export const loadMixerOffsetDb = async (_tabId: number): Promise<number> => {
  throw new Error('not implemented');
};

// chrome.storage.session にタブの手動オフセット (dB) を保存する。
export const saveMixerOffsetDb = async (_tabId: number, _offsetDb: number): Promise<void> => {
  throw new Error('not implemented');
};

// chrome.storage.session から記録済みのタブのタイトルを読み込む。未記録なら null。
export const loadTabTitle = async (_tabId: number): Promise<string | null> => {
  throw new Error('not implemented');
};

// chrome.storage.session にタブのタイトルを記録する。
export const saveTabTitle = async (_tabId: number, _title: string): Promise<void> => {
  throw new Error('not implemented');
};
