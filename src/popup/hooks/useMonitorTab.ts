import { useEffect, useRef } from 'react';
import type { CompressorParams } from '@/shared/compressor-params';

// popup マウント時に MONITOR_TAB を service-worker へ送信し、OFF 状態でも
// タブキャプチャと bypass モードのメーター計測を開始させる。アンマウント時は STOP_MONITOR。
// service-worker 側で enabled=true のタブや既に monitor 中のタブは無視されるため、冪等。
//
// auto-OFF 仕様 (navigation 時に enabled=false に降格) では graph 破棄イベントは
// storage.onChanged 経由で popup の TabState に反映され UI が OFF 表示に切り替わる。
// そのため GRAPH_LOST broadcast を受けた popup 側で MONITOR_TAB を再送する仕組みは
// 必要なく、ユーザーが意図的に ON を押すまで graph は再構築されない。
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
