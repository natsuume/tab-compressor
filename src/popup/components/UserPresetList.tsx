import type { UserPreset, UserPresetId } from '@/shared/user-presets';

type UserPresetListProps = {
  presets: readonly UserPreset[];
  activeId: string;
  disabled?: boolean;
  onSelect: (preset: UserPreset) => void;
  onRemove: (id: UserPresetId) => void;
  onSaveCurrent: () => void;
};

export const UserPresetList = ({
  presets,
  activeId,
  disabled = false,
  onSelect,
  onRemove,
  onSaveCurrent,
}: UserPresetListProps) => (
  <>
    <div className="user-preset-toolbar">
      <button
        type="button"
        className="save-preset-button"
        disabled={disabled}
        onClick={onSaveCurrent}
      >
        + 現在の設定を保存
      </button>
    </div>
    {presets.length === 0 ? (
      <p className="info-text">保存したプリセットはまだありません。</p>
    ) : (
      <div className="user-preset-list">
        {presets.map((preset) => (
          <div
            key={preset.id}
            className="user-preset-item"
            data-active={activeId === preset.id}
          >
            <button
              type="button"
              className="user-preset-item__select"
              title={preset.name}
              disabled={disabled}
              onClick={() => onSelect(preset)}
            >
              {preset.name}
            </button>
            <button
              type="button"
              className="user-preset-item__remove"
              title="このプリセットを削除"
              aria-label={`${preset.name} を削除`}
              onClick={() => onRemove(preset.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    )}
  </>
);
