import { PRESETS, type PresetId } from '@/shared/presets';
import type { UserPreset, UserPresetId } from '@/shared/user-presets';
import { UserPresetChip } from './UserPresetChip';

type PresetSelectorProps = {
  userPresets: readonly UserPreset[];
  activeId: string;
  disabled?: boolean;
  onSelectBuiltin: (id: PresetId) => void;
  onSelectUser: (preset: UserPreset) => void;
  onRemoveUser: (id: UserPresetId) => void;
  onSaveCurrent: () => void;
};

// 組み込みプリセット → My Presets → 「現在の設定を保存」ボタンの順にチップを横に並べ、
// 幅が足りなければ折り返す。disabled (タブが OFF) の間は選択と保存を受け付けない。
export const PresetSelector = ({
  userPresets,
  activeId,
  disabled = false,
  onSelectBuiltin,
  onSelectUser,
  onRemoveUser,
  onSaveCurrent,
}: PresetSelectorProps) => (
  <div className="preset-selector">
    {PRESETS.map((preset) => (
      <button
        key={preset.id}
        type="button"
        className="preset-button"
        data-active={activeId === preset.id}
        title={preset.description}
        disabled={disabled}
        onClick={() => onSelectBuiltin(preset.id)}
      >
        {preset.name}
      </button>
    ))}
    {userPresets.map((preset) => (
      <UserPresetChip
        key={preset.id}
        preset={preset}
        active={activeId === preset.id}
        disabled={disabled}
        onSelect={onSelectUser}
        onRemove={onRemoveUser}
      />
    ))}
    <button
      type="button"
      className="save-preset-button"
      disabled={disabled}
      onClick={onSaveCurrent}
    >
      + 現在の設定を保存
    </button>
  </div>
);
