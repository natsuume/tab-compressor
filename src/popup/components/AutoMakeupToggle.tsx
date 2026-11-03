import { useId } from 'react';
import { formatSignedDb } from '../format-db';

type AutoMakeupToggleProps = {
  checked: boolean;
  disabled: boolean;
  // 現在の自動ゲイン (dB)。自動 Makeup が動作していないときは null
  autoMakeupDb: number | null;
  onChange: (next: boolean) => void;
};

// 自動 Makeup の ON / OFF を切り替える行。ParameterSlider と同じ 3 列 (ラベル / 操作 / 値) で並ぶ。
// 無効時もフォーカスできるよう native の disabled は使わず aria-disabled で表し、
// 変更できない理由を aria-describedby で読み上げられるようにする。
export const AutoMakeupToggle = ({
  checked,
  disabled,
  autoMakeupDb,
  onChange,
}: AutoMakeupToggleProps) => {
  const disabledReasonId = useId();
  return (
    <div className="parameter-toggle" data-disabled={disabled}>
      <span className="parameter-slider__label">Auto</span>
      <label
        className="parameter-toggle__control"
        title="入力と出力の音量が一致するように Makeup を自動で調整します。Makeup スライダーの値はこの基準に加算されます"
      >
        <input
          type="checkbox"
          checked={checked}
          aria-disabled={disabled}
          aria-describedby={disabled ? disabledReasonId : undefined}
          onChange={(e) => {
            if (disabled) return;
            onChange(e.target.checked);
          }}
        />
        入出力の音量を一致させる
      </label>
      <span className="parameter-slider__value">{formatSignedDb(autoMakeupDb)}</span>
      <span id={disabledReasonId} className="visually-hidden">
        コンプレッサーを ON にすると変更できます
      </span>
    </div>
  );
};
