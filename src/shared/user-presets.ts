import type { CompressorParams } from './compressor-params';

export const USER_PRESET_ID_PREFIX = 'user_';

export type UserPresetId = `${typeof USER_PRESET_ID_PREFIX}${string}`;

export type UserPreset = {
  id: UserPresetId;
  name: string;
  params: CompressorParams;
  createdAt: number;
};

export const USER_PRESETS_STORAGE_KEY = 'user_presets';

export const isUserPresetId = (id: string): id is UserPresetId =>
  id.startsWith(USER_PRESET_ID_PREFIX);

export const generateUserPresetId = (): UserPresetId =>
  `${USER_PRESET_ID_PREFIX}${crypto.randomUUID()}`;

export const loadUserPresets = async (): Promise<UserPreset[]> => {
  const result = await chrome.storage.local.get(USER_PRESETS_STORAGE_KEY);
  const stored = result[USER_PRESETS_STORAGE_KEY];
  return Array.isArray(stored) ? (stored as UserPreset[]) : [];
};

export const saveUserPresets = async (presets: readonly UserPreset[]): Promise<void> => {
  await chrome.storage.local.set({ [USER_PRESETS_STORAGE_KEY]: presets });
};

export const createUserPreset = (name: string, params: CompressorParams): UserPreset => ({
  id: generateUserPresetId(),
  name,
  params,
  createdAt: Date.now(),
});
