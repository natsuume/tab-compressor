import { useCallback } from 'react';
import type { CompressorParams } from '@/shared/compressor-params';
import { findPreset, type PresetId } from '@/shared/presets';
import { useCurrentTabId } from './hooks/useCurrentTabId';
import { useTabState } from './hooks/useTabState';
import { useMeterStream } from './hooks/useMeterStream';
import { PowerToggle } from './components/PowerToggle';
import { PresetSelector } from './components/PresetSelector';
import { ParameterPanel } from './components/ParameterPanel';
import { LevelMeters } from './components/LevelMeters';
import { CompressorCurveChart } from './components/CompressorCurveChart';

export const App = () => {
  const tabId = useCurrentTabId();
  const { state, isReady, enable, disable, updateParams, setState } = useTabState(tabId);
  const meters = useMeterStream(tabId);

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

  const handlePresetSelect = useCallback(
    (id: PresetId) => {
      const preset = findPreset(id);
      if (preset === undefined) return;
      void setState({ ...state, presetId: id, params: preset.params });
    },
    [state, setState],
  );

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

      <section className="section">
        <span className="section__heading">Preset</span>
        <PresetSelector activeId={state.presetId} onSelect={handlePresetSelect} />
      </section>

      <section className="section">
        <span className="section__heading">Parameters</span>
        <ParameterPanel params={state.params} onChange={handleParamsChange} />
      </section>

      <section className="section">
        <span className="section__heading">Curve</span>
        <CompressorCurveChart params={state.params} inputDb={meters.inRmsDb} />
      </section>

      <section className="section">
        <span className="section__heading">Levels</span>
        <LevelMeters values={meters} />
        {!state.enabled && (
          <p className="info-text">ON にするとタブ音声を計測し、メーターが動き始めます。</p>
        )}
      </section>
    </div>
  );
};
