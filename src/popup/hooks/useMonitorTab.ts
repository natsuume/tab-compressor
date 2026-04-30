import { useEffect, useRef } from 'react';
import type { CompressorParams } from '@/shared/compressor-params';
import { isMsg } from '@/shared/messages';

// popup マウント時に MONITOR_TAB を service-worker へ送信し、OFF 状態でも
// タブキャプチャと bypass モードのメーター計測を開始させる。アンマウント時は STOP_MONITOR。
// service-worker 側で enabled=true のタブや既に monitor 中のタブは無視されるため、冪等。
//
// タブ内ナビゲーション (YouTube の SPA video 切替を含む) で MediaStream の audio track が
// ended になったとき、Offscreen が GRAPH_LOST を broadcast する。popup が開いていれば
// それを受けて再度 MONITOR_TAB を送り、新しい streamId で graph を作り直させる。
export const useMonitorTab = (tabId: number | null, params: CompressorParams): void => {
  // params は MONITOR_TAB の初期値 fallback として使う。SW 側は storage の値を優先するので
  // GRAPH_LOST 後の再送では古い closure 値でも問題ないが、念のため最新を保持しておく。
  const paramsRef = useRef(params);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    if (tabId === null) return;

    const sendMonitor = (): void => {
      void chrome.runtime.sendMessage({
        type: 'MONITOR_TAB',
        tabId,
        params: paramsRef.current,
      });
    };

    sendMonitor();

    const onMessage = (raw: unknown): undefined => {
      if (!isMsg(raw)) return undefined;
      if (raw.type !== 'GRAPH_LOST') return undefined;
      if (raw.tabId !== tabId) return undefined;
      sendMonitor();
      return undefined;
    };
    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      void chrome.runtime.sendMessage({ type: 'STOP_MONITOR', tabId });
    };
  }, [tabId]);
};
