import type { CompressorParams } from './compressor-params';
import type { PresetId } from './presets';
import type { UserPresetId } from './user-presets';
import { STORAGE_KEY_PREFIX } from './constants';

export type ActivePresetRef = PresetId | UserPresetId | 'custom';

export type TabState = {
  enabled: boolean;
  presetId: ActivePresetRef;
  params: CompressorParams;
  // ナビゲーション後の自動再 attach が activeTab 不足等で失敗し、enabled=true のまま
  // graph が無い「圧縮されているはずなのに実際には素通し」状態を popup に伝えるフラグ。
  // 次回 popup を開いて MONITOR_TAB が成功すれば false に戻る。
  degraded?: boolean;
};

export const tabStorageKey = (tabId: number): string => `${STORAGE_KEY_PREFIX}${tabId}`;

export const parseTabStorageKey = (key: string): number | null => {
  if (!key.startsWith(STORAGE_KEY_PREFIX)) return null;
  const id = Number.parseInt(key.slice(STORAGE_KEY_PREFIX.length), 10);
  return Number.isFinite(id) ? id : null;
};
