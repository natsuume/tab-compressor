// 全タブ共通のミキサー設定。chrome.storage.local に保存し、ブラウザ再起動後も保持する。
// autoBalance=true のとき、コンプレッサー ON で音が出ているタブの音量の中央値に、各タブの音量を
// 自動で寄せる。false のときは各タブの手動オフセットだけを掛ける。
export type MixerSettings = {
  autoBalance: boolean;
};

export const MIXER_SETTINGS_STORAGE_KEY = 'mixer_settings';

export const DEFAULT_MIXER_SETTINGS: MixerSettings = {
  autoBalance: false,
};

// storage から読んだ値を MixerSettings に整える。
// - object でなければ DEFAULT_MIXER_SETTINGS を返す
// - autoBalance が boolean でなければ DEFAULT_MIXER_SETTINGS.autoBalance を使う
export const normalizeMixerSettings = (_raw: unknown): MixerSettings => {
  throw new Error('not implemented');
};

// chrome.storage.local から設定を読み込む。未保存なら DEFAULT_MIXER_SETTINGS。
export const loadMixerSettings = async (): Promise<MixerSettings> => {
  throw new Error('not implemented');
};

// chrome.storage.local に設定を保存する。
export const saveMixerSettings = async (_settings: MixerSettings): Promise<void> => {
  throw new Error('not implemented');
};
