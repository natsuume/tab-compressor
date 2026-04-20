type PowerToggleProps = {
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
};

export const PowerToggle = ({ enabled, disabled, onToggle }: PowerToggleProps) => (
  <button
    type="button"
    className="power-toggle"
    data-enabled={enabled}
    disabled={disabled}
    onClick={onToggle}
  >
    {enabled ? 'ON' : 'OFF'}
  </button>
);
