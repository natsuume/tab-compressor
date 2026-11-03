import { useCallback } from 'react';
import type { AutoEnableSettings } from '@/shared/auto-enable-settings';
import type { CompressorParams } from '@/shared/compressor-params';
import { findPreset, type PresetId } from '@/shared/presets';
import type { UserPreset, UserPresetId } from '@/shared/user-presets';
import { useCurrentTabId } from './hooks/useCurrentTabId';
import { useTabState } from './hooks/useTabState';
import { useMeterStream } from './hooks/useMeterStream';
import { useMonitorTab } from './hooks/useMonitorTab';
import { useUserPresets } from './hooks/useUserPresets';
import { useAutoEnableSettings } from './hooks/useAutoEnableSettings';
import { useMixerSettings } from './hooks/useMixerSettings';
import { useMixerTabs } from './hooks/useMixerTabs';
import { useTabMeters } from './hooks/useTabMeters';
import { PowerToggle } from './components/PowerToggle';
import { PresetSelector } from './components/PresetSelector';
import { ParameterPanel } from './components/ParameterPanel';
import { LevelMeters } from './components/LevelMeters';
import { CompressorCurveChart } from './components/CompressorCurveChart';
import { AutoEnableSettingsPanel } from './components/AutoEnableSettingsPanel';
import { MixerPanel } from './components/MixerPanel';

export const App = () => {
  const tabId = useCurrentTabId();
  const { state, isReady, enable, disable, applyAutoEnable, setState } = useTabState(tabId);
  const meters = useMeterStream(tabId);
  const userPresets = useUserPresets();
  const {
    settings: autoEnableSettings,
    isReady: isAutoEnableReady,
    update: updateAutoEnableSettings,
  } = useAutoEnableSettings();
  const {
    settings: mixerSettings,
    isReady: isMixerSettingsReady,
    update: updateMixerSettings,
  } = useMixerSettings();
  const { status: mixerStatus, tabs: mixerTabs, setOffset: setMixerOffset } = useMixerTabs();
  const tabMeters = useTabMeters();
  useMonitorTab(tabId, state.params);

  const handleToggle = useCallback(() => {
    if (state.enabled) {
      void disable();
    } else {
      void enable();
    }
  }, [state.enabled, enable, disable]);

  // setState が storage 書き込みと UPDATE_PARAMS 送信 (enabled 時) の両方を担う。
  // ここで別途 updateParams を呼ぶと同一 params の UPDATE_PARAMS が二重送信される。
  const handleParamsChange = useCallback(
    (params: CompressorParams) => {
      void setState({ ...state, presetId: 'custom', params });
    },
    [state, setState],
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

  // 設定を ON にしたときは、いま popup を開いているタブにもその場で適用する
  // (popup を開いた時点の自動判定は、まだ設定が OFF だったため何もしていない)。
  // SW は storage の設定を読んで判定するので、保存が終わってから依頼する。
  const handleAutoEnableChange = useCallback(
    (next: AutoEnableSettings) => {
      const turnedOn = next.enabled && !autoEnableSettings.enabled;
      void updateAutoEnableSettings(next).then(() => {
        if (turnedOn) void applyAutoEnable();
      });
    },
    [autoEnableSettings.enabled, updateAutoEnableSettings, applyAutoEnable],
  );

  const handleAutoBalanceChange = useCallback(
    (autoBalance: boolean) => {
      void updateMixerSettings({ ...mixerSettings, autoBalance });
    },
    [mixerSettings, updateMixerSettings],
  );

  const handleMixerOffsetChange = useCallback(
    (targetTabId: number, offsetDb: number) => {
      void setMixerOffset(targetTabId, offsetDb);
    },
    [setMixerOffset],
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

      <section className="section">
        <span className="section__heading">Presets</span>
        <PresetSelector
          userPresets={userPresets.presets}
          activeId={state.presetId}
          disabled={controlsDisabled}
          onSelectBuiltin={handleBuiltinPresetSelect}
          onSelectUser={handleUserPresetSelect}
          onRemoveUser={handleUserPresetRemove}
          onSaveCurrent={handleSaveCurrent}
        />
        {/* 全タブ共通の設定でタブの ON / OFF とは無関係なので、controlsDisabled では無効化しない */}
        <AutoEnableSettingsPanel
          settings={autoEnableSettings}
          userPresets={userPresets.presets}
          isReady={isAutoEnableReady && userPresets.isReady}
          onChange={handleAutoEnableChange}
        />
      </section>

      {/* 同じ行の 2 枚は高さを揃える (Parameters 側がスライダーの間隔で吸収する) */}
      <div className="app__body">
        <section className="section">
          <span className="section__heading">Monitor</span>
          <CompressorCurveChart params={state.params} inputDb={meters.inRmsDb} />
          <LevelMeters values={meters} />
        </section>

        <section className="section">
          <span className="section__heading">Parameters</span>
          <ParameterPanel
            params={state.params}
            disabled={controlsDisabled}
            autoMakeupDb={meters.autoMakeupDb}
            onChange={handleParamsChange}
          />
        </section>
      </div>

      {/* 全タブ共通の設定とコンプレッサー ON の全タブの一覧で、このタブの ON / OFF とは無関係なので
          controlsDisabled では無効化しない */}
      <section className="section">
        <span className="section__heading">Mixer</span>
        <MixerPanel
          status={mixerStatus}
          tabs={mixerTabs}
          currentTabId={tabId}
          meters={tabMeters}
          settings={mixerSettings}
          isSettingsReady={isMixerSettingsReady}
          onAutoBalanceChange={handleAutoBalanceChange}
          onOffsetChange={handleMixerOffsetChange}
        />
      </section>
    </div>
  );
};
