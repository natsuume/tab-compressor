import type { CompressorParams } from './compressor-params';
import { DEFAULT_PRESET_ID, findPreset, isPresetId, type PresetId } from './presets';
import type { TabState } from './tab-state';
import { isUserPresetId, type UserPreset, type UserPresetId } from './user-presets';

// 自動有効化で適用するプリセットの参照。組み込みプリセットと My Presets の両方を指せる。
export type AutoEnablePresetRef = PresetId | UserPresetId;

// 全タブ共通の自動有効化設定。chrome.storage.local に保存し、ブラウザ再起動後も保持する。
// enabled=true のとき、まだ一度も操作していないタブ (TabState が無いタブ) で popup を開くと、
// presetId のプリセットでコンプレッサーを ON にする。popup で設定を ON にしたときに
// 開いているタブも、未操作ならその場で ON にする。
// tabCapture はユーザーが拡張を呼び出したタブでしか使えないため、popup を開く前
// (タブを開いただけの時点) には ON にできない。
export type AutoEnableSettings = {
  enabled: boolean;
  presetId: AutoEnablePresetRef;
};

export const AUTO_ENABLE_SETTINGS_STORAGE_KEY = 'auto_enable_settings';

export const DEFAULT_AUTO_ENABLE_SETTINGS: AutoEnableSettings = {
  enabled: false,
  presetId: DEFAULT_PRESET_ID,
};

// プリセット参照を解決した結果。TabState の presetId / params にそのまま使える。
export type ResolvedPreset = {
  presetId: AutoEnablePresetRef;
  params: CompressorParams;
};

// storage から読んだ値を AutoEnableSettings に整える。
// - enabled が boolean でなければ DEFAULT_AUTO_ENABLE_SETTINGS.enabled を使う
// - presetId が「組み込みプリセットの id」か「My Presets 形式の id (user_ 接頭辞)」でなければ
//   DEFAULT_AUTO_ENABLE_SETTINGS.presetId を使う
// My Presets 側で削除済みかどうかはここでは判定しない (resolvePresetRef が判定する)。
export const normalizeAutoEnableSettings = (raw: unknown): AutoEnableSettings => {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_AUTO_ENABLE_SETTINGS;
  const enabled = 'enabled' in raw ? raw.enabled : undefined;
  const presetId = 'presetId' in raw ? raw.presetId : undefined;
  return {
    enabled: typeof enabled === 'boolean' ? enabled : DEFAULT_AUTO_ENABLE_SETTINGS.enabled,
    presetId:
      typeof presetId === 'string' && (isPresetId(presetId) || isUserPresetId(presetId))
        ? presetId
        : DEFAULT_AUTO_ENABLE_SETTINGS.presetId,
  };
};

// chrome.storage.local から設定を読み込む。未保存なら DEFAULT_AUTO_ENABLE_SETTINGS。
export const loadAutoEnableSettings = async (): Promise<AutoEnableSettings> => {
  const result = await chrome.storage.local.get(AUTO_ENABLE_SETTINGS_STORAGE_KEY);
  return normalizeAutoEnableSettings(result[AUTO_ENABLE_SETTINGS_STORAGE_KEY]);
};

// chrome.storage.local に設定を保存する。
export const saveAutoEnableSettings = async (settings: AutoEnableSettings): Promise<void> => {
  await chrome.storage.local.set({ [AUTO_ENABLE_SETTINGS_STORAGE_KEY]: settings });
};

// プリセット参照を id と params の組に解決する。
// - 組み込みプリセットの id: PRESETS から探す
// - My Presets の id: userPresets から探す
// 参照先が見つからない (削除済みの My Preset 等) 場合は null。
export const resolvePresetRef = (
  ref: AutoEnablePresetRef,
  userPresets: readonly UserPreset[],
): ResolvedPreset | null => {
  const found = isUserPresetId(ref)
    ? userPresets.find((preset) => preset.id === ref)
    : findPreset(ref);
  if (found === undefined) return null;
  return { presetId: found.id, params: found.params };
};

// popup を開いたタブを自動で ON にするかを判断する。
// ON にする場合は保存すべき TabState (enabled=true + 解決したプリセットの presetId / params) を返し、
// ON にしない場合は null を返す。null になる条件:
// - prev が存在する (= このタブで一度でも操作した。手動 OFF・auto-OFF 後の状態を含む)。
//   ユーザーが OFF にしたタブを勝手に ON に戻さない
// - wasManuallyDisabled が true。TabState は拡張の更新・再読み込みで消えるため、
//   手動で OFF にしたタブは別途記録しておき、その記録でも対象外にする
// - settings.enabled が false
// - settings.presetId の参照先が見つからない。補完値で ON にはしない
export const decideAutoEnableState = (
  prev: TabState | undefined,
  wasManuallyDisabled: boolean,
  settings: AutoEnableSettings,
  userPresets: readonly UserPreset[],
): TabState | null => {
  if (prev !== undefined) return null;
  if (wasManuallyDisabled) return null;
  if (!settings.enabled) return null;
  const resolved = resolvePresetRef(settings.presetId, userPresets);
  if (resolved === null) return null;
  return { enabled: true, presetId: resolved.presetId, params: resolved.params };
};
