import { useId } from 'react';
import { resolvePresetRef, type AutoEnableSettings } from '@/shared/auto-enable-settings';
import { isPresetId, PRESETS } from '@/shared/presets';
import { isUserPresetId, type UserPreset } from '@/shared/user-presets';

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
export const AutoEnableSettingsPanel = ({
  settings,
  userPresets,
  isReady,
  onChange,
}: AutoEnableSettingsPanelProps) => {
  const selectId = useId();
  const hintId = useId();
  const isMissingPreset = isReady && resolvePresetRef(settings.presetId, userPresets) === null;

  return (
    <div className="auto-enable-panel">
      <label className="auto-enable-panel__toggle">
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={!isReady}
          aria-describedby={hintId}
          onChange={(e) => onChange({ ...settings, enabled: e.target.checked })}
        />
        popup を開いたタブを自動で ON にする
      </label>
      <div className="auto-enable-panel__preset">
        <label htmlFor={selectId} className="auto-enable-panel__label">
          プリセット
        </label>
        <select
          id={selectId}
          className="auto-enable-panel__select"
          value={settings.presetId}
          disabled={!isReady}
          aria-invalid={isMissingPreset}
          aria-describedby={hintId}
          onChange={(e) => {
            const value = e.target.value;
            if (isPresetId(value) || isUserPresetId(value)) {
              onChange({ ...settings, presetId: value });
            }
          }}
        >
          {isMissingPreset && (
            <option value={settings.presetId} disabled>
              削除済みのプリセット (選び直してください)
            </option>
          )}
          <optgroup label="組み込み">
            {PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </optgroup>
          {userPresets.length > 0 && (
            <optgroup label="My Presets">
              {userPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <p id={hintId} className="info-text">
        未操作のタブで popup を開いたとき (またはチェックを入れたとき) に、選んだプリセットで ON になります。一度 OFF にしたタブには適用されません。
      </p>
    </div>
  );
};
