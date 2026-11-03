// 全タブ共通のミキサー設定。chrome.storage.local に保存し、ブラウザ再起動後も保持する。
// autoBalance=true のとき、コンプレッサー ON で音が出ているタブの音量の中央値に、各タブの音量を
// 自動で寄せる。false のときは各タブの手動オフセットだけを掛ける。
export type MixerSettings = {
  autoBalance: boolean;
  // 保存のたびに増える版数 (nextMixerSettingsUpdatedAt で決める)。同じ設定の値が複数の経路で
  // 届いたときに、新しい方を採るために使う
  updatedAt: number;
};

export const MIXER_SETTINGS_STORAGE_KEY = 'mixer_settings';

export const DEFAULT_MIXER_SETTINGS: MixerSettings = {
  autoBalance: false,
  updatedAt: 0,
};

// storage から読んだ値を MixerSettings に整える。
// - object でなければ DEFAULT_MIXER_SETTINGS を返す
// - autoBalance が boolean でなければ DEFAULT_MIXER_SETTINGS.autoBalance を使う
// - updatedAt が有限かつ 0 以上の number でなければ 0 を使う
export const normalizeMixerSettings = (raw: unknown): MixerSettings => {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_MIXER_SETTINGS;
  const autoBalance = 'autoBalance' in raw ? raw.autoBalance : undefined;
  const updatedAt = 'updatedAt' in raw ? raw.updatedAt : undefined;
  return {
    autoBalance:
      typeof autoBalance === 'boolean' ? autoBalance : DEFAULT_MIXER_SETTINGS.autoBalance,
    updatedAt:
      typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt >= 0
        ? updatedAt
        : DEFAULT_MIXER_SETTINGS.updatedAt,
  };
};

// 手元の設定 current と、届いた設定 incoming のうち、保存時刻が新しい方を返す。
// 保存時刻が同じなら incoming を採る。
export const pickNewerMixerSettings = (
  current: MixerSettings,
  incoming: MixerSettings,
): MixerSettings => (incoming.updatedAt >= current.updatedAt ? incoming : current);

// 次に保存する設定の updatedAt を返す。基本は現在時刻 nowMs だが、保存済みの値 previousUpdatedAt
// 以下にはしない (前回 + 1 以上にする)。システムの時計が過去に戻っても、新しい保存が
// pickNewerMixerSettings で古い値として捨てられないようにするため。
export const nextMixerSettingsUpdatedAt = (previousUpdatedAt: number, nowMs: number): number =>
  Math.max(nowMs, previousUpdatedAt + 1);

// chrome.storage.local から設定を読み込む。未保存なら DEFAULT_MIXER_SETTINGS。
export const loadMixerSettings = async (): Promise<MixerSettings> => {
  const result = await chrome.storage.local.get(MIXER_SETTINGS_STORAGE_KEY);
  return normalizeMixerSettings(result[MIXER_SETTINGS_STORAGE_KEY]);
};

// chrome.storage.local に設定を保存する。
export const saveMixerSettings = async (settings: MixerSettings): Promise<void> => {
  await chrome.storage.local.set({ [MIXER_SETTINGS_STORAGE_KEY]: settings });
};
