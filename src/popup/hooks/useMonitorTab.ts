import { useEffect } from 'react';
import type { CompressorParams } from '@/shared/compressor-params';

// popup マウント時に MONITOR_TAB を service-worker へ送信し、OFF 状態でも
// タブキャプチャと bypass モードのメーター計測を開始させる。アンマウント時は STOP_MONITOR。
// service-worker 側で enabled=true のタブや既に monitor 中のタブは無視されるため、冪等。
export const useMonitorTab = (tabId: number | null, params: CompressorParams): void => {
  useEffect(() => {
    if (tabId === null) return;

    void chrome.runtime.sendMessage({ type: 'MONITOR_TAB', tabId, params });

    return () => {
      void chrome.runtime.sendMessage({ type: 'STOP_MONITOR', tabId });
    };
    // params は MONITOR_TAB 初回送信時の初期値として使う。以降の変更は UPDATE_PARAMS で反映される。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);
};
