// 手動で OFF にしたタブの記録。自動有効化の対象から外すために使う。
//
// タブごとの状態 (TabState) を置く chrome.storage.session は、拡張の更新・再読み込みでも消える。
// この記録は chrome.storage.local に置き、拡張を更新した後も「手動で OFF にしたタブ」を覚えておく。
// - 手動で ON にしたとき・タブを閉じたときに、そのタブの記録を消す
// - タブ ID はブラウザを起動し直すと振り直されるため、ブラウザ起動時にまとめて消す
// - 拡張が無効化されている間に閉じたタブの記録は残るが、タブ ID は同じブラウザセッション内で
//   再利用されないため、次のブラウザ起動で消えるまで他のタブには影響しない
//
// 複数タブの OFF / ON が同時に起きても読み込み→書き込みが競合しないよう、
// 1 つの配列ではなくタブごとに別のキーで保存する。
//
// 記録は自動有効化を補うためのものなので、書き込みに失敗しても例外は投げずログだけ出す
// (ON / OFF の操作そのものをエラーにしない)。

const MANUALLY_DISABLED_TAB_KEY_PREFIX = 'manual_off_tab_';

const manuallyDisabledTabKey = (tabId: number): string =>
  `${MANUALLY_DISABLED_TAB_KEY_PREFIX}${tabId}`;

export const markTabManuallyDisabled = async (tabId: number): Promise<void> => {
  try {
    await chrome.storage.local.set({ [manuallyDisabledTabKey(tabId)]: true });
  } catch (err) {
    console.warn('[tab-compressor] failed to record manual OFF', err);
  }
};

export const unmarkTabManuallyDisabled = async (tabId: number): Promise<void> => {
  try {
    await chrome.storage.local.remove(manuallyDisabledTabKey(tabId));
  } catch (err) {
    console.warn('[tab-compressor] failed to clear manual OFF record', err);
  }
};

export const clearManuallyDisabledTabs = async (): Promise<void> => {
  try {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((key) => key.startsWith(MANUALLY_DISABLED_TAB_KEY_PREFIX));
    if (keys.length > 0) await chrome.storage.local.remove(keys);
  } catch (err) {
    console.warn('[tab-compressor] failed to clear manual OFF records', err);
  }
};

// 読み込みの失敗は呼び出し側 (自動有効化の判定) で「自動有効化しない」として扱うため、そのまま投げる。
export const isTabManuallyDisabled = async (tabId: number): Promise<boolean> => {
  const key = manuallyDisabledTabKey(tabId);
  const result = await chrome.storage.local.get(key);
  return result[key] === true;
};
