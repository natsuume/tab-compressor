import { PRESETS, type PresetId } from '@/shared/presets';

type PresetSelectorProps = {
  activeId: PresetId | 'custom';
  onSelect: (id: PresetId) => void;
};

export const PresetSelector = ({ activeId, onSelect }: PresetSelectorProps) => (
  <div className="preset-selector">
    {PRESETS.map((preset) => (
      <button
        key={preset.id}
        type="button"
        className="preset-button"
        data-active={activeId === preset.id}
        title={preset.description}
        onClick={() => onSelect(preset.id)}
      >
        {preset.name}
      </button>
    ))}
  </div>
);
