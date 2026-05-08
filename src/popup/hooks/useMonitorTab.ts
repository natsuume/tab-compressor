import { useEffect, useRef } from 'react';
import type { CompressorParams } from '@/shared/compressor-params';
import { isMsg } from '@/shared/messages';

// popup マウント時に MONITOR_TAB を service-worker へ送信し、OFF 状態でも
// タブキャプチャと bypass モードのメーター計測を開始させる。アンマウント時は STOP_MONITOR。
// service-worker 側で enabled=true のタブや既に monitor 中のタブは無視されるため、冪等。
//
// auto-OFF 仕様では navigation で graph が破棄されると enabled=true タブは
// enabled=false に降格される。popup を開いて bypass meter を見ているケースでは
// graph 破棄通知 (GRAPH_LOST) を受けて再 MONITOR_TAB を送り、bypass attach を
// 作り直してメーターを継続させる。SW 側 GRAPH_LOST handler に probe があるため、
// 並行 ENABLE_TAB と stale GRAPH_LOST の race は SW 内で塞がれている。
export const useMonitorTab = (tabId: number | null, params: CompressorParams): void => {
  // params は MONITOR_TAB の初期値 fallback として使う。SW 側は storage の値を優先するので
  // 古い closure 値でも問題ないが、念のため最新を保持しておく。
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
