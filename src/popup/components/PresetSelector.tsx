import { PRESETS, type PresetId } from '@/shared/presets';

type PresetSelectorProps = {
  activeId: string;
  disabled?: boolean;
  onSelect: (id: PresetId) => void;
};

export const PresetSelector = ({ activeId, disabled = false, onSelect }: PresetSelectorProps) => (
  <div className="preset-selector">
    {PRESETS.map((preset) => (
      <button
        key={preset.id}
        type="button"
        className="preset-button"
        data-active={activeId === preset.id}
        title={preset.description}
        disabled={disabled}
        onClick={() => onSelect(preset.id)}
      >
        {preset.name}
      </button>
    ))}
  </div>
);
