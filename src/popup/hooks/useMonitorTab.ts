import { useEffect, useRef } from 'react';
import type { CompressorParams } from '@/shared/compressor-params';

// popup マウント時に MONITOR_TAB を service-worker へ送信し、OFF 状態でも
// タブキャプチャと bypass モードのメーター計測を開始させる。アンマウント時は STOP_MONITOR。
// service-worker 側で enabled=true のタブや既に monitor 中のタブは無視されるため、冪等。
//
// auto-OFF 仕様では graph が破棄されると SW 側で enabled=false に降格される。
// popup を開いた状態で graph 破棄が起きた場合 LEVEL メーターは止まるが、
// popup を再オープンすれば MONITOR_TAB が再送されて bypass attach が復活する。
// あえて GRAPH_LOST listener を持たないことで「popup の MONITOR_TAB が SW の demote
// より先着して storage の enabled=true で graph を復活させ auto-OFF を skip する」
// race を構造的に塞ぐ。
export const useMonitorTab = (tabId: number | null, params: CompressorParams): void => {
  // params は MONITOR_TAB の初期値 fallback として使う。SW 側は storage の値を優先するので
  // 古い closure 値でも問題ないが、念のため最新を保持しておく。
  const paramsRef = useRef(params);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    if (tabId === null) return;

    void chrome.runtime.sendMessage({
      type: 'MONITOR_TAB',
      tabId,
      params: paramsRef.current,
    });

    return () => {
      void chrome.runtime.sendMessage({ type: 'STOP_MONITOR', tabId });
    };
  }, [tabId]);
};
