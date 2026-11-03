import type { UserPreset, UserPresetId } from '@/shared/user-presets';

type UserPresetChipProps = {
  preset: UserPreset;
  active: boolean;
  disabled: boolean;
  onSelect: (preset: UserPreset) => void;
  onRemove: (id: UserPresetId) => void;
};

// My Presets の 1 件を表すチップ。名前ボタン (選択) と × ボタン (削除) を 1 つの枠に収める。
// - 名前が長い場合は省略表示し、title で全文を表示する
// - disabled は名前ボタンだけに効く。削除はタブの ON / OFF に関係なく行える
export const UserPresetChip = (_props: UserPresetChipProps) => null;
