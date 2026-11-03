import { useId } from 'react';
import type { MixerSettings } from '@/shared/mixer-settings';
import type { MeterValues } from '../hooks/useMeterStream';
import type { MixerTab, MixerTabsStatus } from '../hooks/useMixerTabs';
import { MixerTabRow } from './MixerTabRow';

type MixerPanelProps = {
  status: MixerTabsStatus;
  tabs: readonly MixerTab[];
  // popup を開いているタブ。一覧で「このタブ」と示すために使う
  currentTabId: number | null;
  meters: ReadonlyMap<number, MeterValues>;
  settings: MixerSettings;
  // 設定の読み込みが終わったか。終わるまでは自動追従の切り替えを受け付けない
  isSettingsReady: boolean;
  onAutoBalanceChange: (next: boolean) => void;
  onOffsetChange: (tabId: number, offsetDb: number) => void;
};

type MixerTabListProps = Pick<
  MixerPanelProps,
  'status' | 'tabs' | 'currentTabId' | 'meters' | 'onOffsetChange'
>;

// 一覧の読み込み中・エラー・空のときは、行 1 つ分の高さの枠に表示してレイアウトを跳ねさせない。
const MixerTabList = ({ status, tabs, currentTabId, meters, onOffsetChange }: MixerTabListProps) => {
  if (status === 'loading') {
    return (
      <div className="mixer-panel__placeholder" aria-busy="true">
        <span className="mixer-panel__skeleton" aria-hidden="true" />
        <span className="visually-hidden">ミキサーの状態を読み込んでいます</span>
      </div>
    );
  }
  if (status === 'error') {
    return <p className="mixer-panel__placeholder">ミキサーの状態を読み込めませんでした</p>;
  }
  if (tabs.length === 0) {
    return <p className="mixer-panel__placeholder">コンプレッサーが ON のタブはありません</p>;
  }
  return (
    <ul className="mixer-panel__rows">
      {tabs.map((tab) => (
        <MixerTabRow
          key={tab.tabId}
          tab={tab}
          isCurrent={tab.tabId === currentTabId}
          meter={meters.get(tab.tabId)}
          onOffsetChange={(offsetDb) => onOffsetChange(tab.tabId, offsetDb)}
        />
      ))}
    </ul>
  );
};

// コンプレッサー ON のタブの音量バランスを揃えるミキサー。
// 先頭行は全タブ共通の自動追従の切り替え、その下にタブごとの行を並べる。
// 設定の読み込み中もフォーカスできるよう native の disabled は使わず aria-disabled で表し、
// 変更できない理由を aria-describedby で読み上げられるようにする。
export const MixerPanel = ({
  status,
  tabs,
  currentTabId,
  meters,
  settings,
  isSettingsReady,
  onAutoBalanceChange,
  onOffsetChange,
}: MixerPanelProps) => {
  const disabledReasonId = useId();
  const toggleDisabled = !isSettingsReady;

  return (
    <div className="mixer-panel">
      <label
        className="mixer-panel__toggle"
        data-disabled={toggleDisabled}
        title="音が出ているタブの音量の中央値に、各タブの音量を寄せます。オフセットはその上に加算されます"
      >
        <input
          type="checkbox"
          checked={settings.autoBalance}
          aria-disabled={toggleDisabled}
          aria-describedby={toggleDisabled ? disabledReasonId : undefined}
          onChange={(e) => {
            if (toggleDisabled) return;
            onAutoBalanceChange(e.target.checked);
          }}
        />
        音量バランスを自動で揃える
      </label>
      <span id={disabledReasonId} className="visually-hidden">
        設定を読み込んでいます
      </span>
      <MixerTabList
        status={status}
        tabs={tabs}
        currentTabId={currentTabId}
        meters={meters}
        onOffsetChange={onOffsetChange}
      />
    </div>
  );
};
