import { useCallback } from 'react';
import type { CompressorParams } from '@/shared/compressor-params';
import { findPreset, type PresetId } from '@/shared/presets';
import type { UserPreset, UserPresetId } from '@/shared/user-presets';
import { useCurrentTabId } from './hooks/useCurrentTabId';
import { useTabState } from './hooks/useTabState';
import { useMeterStream } from './hooks/useMeterStream';
import { useMonitorTab } from './hooks/useMonitorTab';
import { useUserPresets } from './hooks/useUserPresets';
import { PowerToggle } from './components/PowerToggle';
import { PresetSelector } from './components/PresetSelector';
import { UserPresetList } from './components/UserPresetList';
import { ParameterPanel } from './components/ParameterPanel';
import { LevelMeters } from './components/LevelMeters';
import { CompressorCurveChart } from './components/CompressorCurveChart';

export const App = () => {
  const tabId = useCurrentTabId();
  const { state, isReady, enable, disable, updateParams, setState } = useTabState(tabId);
  const meters = useMeterStream(tabId);
  const userPresets = useUserPresets();
  useMonitorTab(tabId, state.params);

  const handleToggle = useCallback(() => {
    if (state.enabled) {
      void disable();
    } else {
      void enable();
    }
  }, [state.enabled, enable, disable]);

  const handleParamsChange = useCallback(
    (params: CompressorParams) => {
      void setState({ ...state, presetId: 'custom', params });
      if (state.enabled) void updateParams(params);
    },
    [state, setState, updateParams],
  );

  const handleBuiltinPresetSelect = useCallback(
    (id: PresetId) => {
      const preset = findPreset(id);
      if (preset === undefined) return;
      void setState({ ...state, presetId: id, params: preset.params });
    },
    [state, setState],
  );

  const handleUserPresetSelect = useCallback(
    (preset: UserPreset) => {
      void setState({ ...state, presetId: preset.id, params: preset.params });
    },
    [state, setState],
  );

  const handleSaveCurrent = useCallback(() => {
    const input = window.prompt('プリセット名を入力してください');
    if (input === null) return;
    const name = input.trim();
    if (name.length === 0) return;

    void userPresets.add(name, state.params).then((preset) => {
      void setState({ ...state, presetId: preset.id, params: preset.params });
    });
  }, [state, setState, userPresets]);

  const handleUserPresetRemove = useCallback(
    (id: UserPresetId) => {
      if (!window.confirm('このプリセットを削除しますか？')) return;
      void userPresets.remove(id).then(() => {
        if (state.presetId === id) {
          void setState({ ...state, presetId: 'custom' });
        }
      });
    },
    [state, setState, userPresets],
  );

  const controlsDisabled = !state.enabled;

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Tab Compressor</h1>
        <PowerToggle
          enabled={state.enabled}
          disabled={tabId === null || !isReady}
          onToggle={handleToggle}
        />
      </header>

      {tabId === null && <p className="warning-text">アクティブなタブを取得できません。</p>}

      <div className="app__presets">
        <section className="section">
          <span className="section__heading">Preset</span>
          <PresetSelector
            activeId={state.presetId}
            disabled={controlsDisabled}
            onSelect={handleBuiltinPresetSelect}
          />
        </section>

        <section className="section">
          <span className="section__heading">My Presets</span>
          <UserPresetList
            presets={userPresets.presets}
            activeId={state.presetId}
            disabled={controlsDisabled}
            onSelect={handleUserPresetSelect}
            onRemove={handleUserPresetRemove}
            onSaveCurrent={handleSaveCurrent}
          />
        </section>
      </div>

      <div className="app__body">
        <div className="app__visual">
          <section className="section">
            <span className="section__heading">Curve</span>
            <CompressorCurveChart params={state.params} inputDb={meters.inRmsDb} />
          </section>

          <section className="section">
            <span className="section__heading">Levels</span>
            <LevelMeters values={meters} />
            {!state.enabled && (
              <p className="info-text">OFF 中は入力レベルのみ計測しています (コンプレッサー無効)。</p>
            )}
          </section>
        </div>

        <div className="app__settings">
          <section className="section">
            <span className="section__heading">Parameters</span>
            <ParameterPanel
              params={state.params}
              disabled={controlsDisabled}
              onChange={handleParamsChange}
            />
          </section>
        </div>
      </div>
    </div>
  );
};
