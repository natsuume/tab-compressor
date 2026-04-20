import type { CompressorParams } from './compressor-params';
import type { PresetId } from './presets';
import { STORAGE_KEY_PREFIX } from './constants';

export type TabState = {
  enabled: boolean;
  presetId: PresetId | 'custom';
  params: CompressorParams;
};

export const tabStorageKey = (tabId: number): string => `${STORAGE_KEY_PREFIX}${tabId}`;

export const parseTabStorageKey = (key: string): number | null => {
  if (!key.startsWith(STORAGE_KEY_PREFIX)) return null;
  const id = Number.parseInt(key.slice(STORAGE_KEY_PREFIX.length), 10);
  return Number.isFinite(id) ? id : null;
};
