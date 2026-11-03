import type { AutoEnableSettings } from '@/shared/auto-enable-settings';
import type { UserPreset } from '@/shared/user-presets';

type AutoEnableSettingsPanelProps = {
  settings: AutoEnableSettings;
  userPresets: readonly UserPreset[];
  // settings と userPresets の読み込みが終わったか。終わるまでは操作を受け付けない
  isReady: boolean;
  onChange: (next: AutoEnableSettings) => void;
};

// 全タブ共通の自動有効化設定を編集する。
// - チェックボックス: 自動有効化の ON / OFF
// - セレクト: 適用するプリセット (組み込み / My Presets のグループに分けて表示)。
//   チェックボックスの状態に関係なく選択でき、選んだ値は ON にしたときに使われる
// - 参照先の My Preset が削除済みの場合は、その旨を示す選択不可の option を選択状態で表示する
//   (自動有効化は行われないため、選び直しを促す)
export const AutoEnableSettingsPanel = (_props: AutoEnableSettingsPanelProps) => null;
