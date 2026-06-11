import { useEffect, useRef } from 'react';
import type { CompressorParams } from '@/shared/compressor-params';
import { MONITOR_PORT_PREFIX } from '@/shared/constants';

// popup マウント時に MONITOR_TAB を service-worker へ送信し、OFF 状態でも
// タブキャプチャと bypass モードのメーター計測を開始させる。
//
// 解放 (bypass グラフの破棄) の契機はメッセージではなく Port の切断にする。
// popup が閉じると document ごと破棄され React の effect cleanup は実行されない
// ため、cleanup からの STOP_MONITOR 送信では通常クローズ経路で一度も解放されない。
// Port の切断は document 破棄で確実に発火し、休止中の SW も起こすので、
// SW 側の port.onDisconnect を解放契機にする。
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

    // SW が休止すると SW 側の port が消えて切断イベントが popup に届く。
    // popup が開いている間は張り直して「popup 生存 = port 接続あり」の
    // 不変条件を維持する (再接続が SW を起こし、onConnect で再登録される)。
    let closed = false;
    let port: chrome.runtime.Port | null = null;
    const connect = (): void => {
      if (closed) return;
      port = chrome.runtime.connect({ name: `${MONITOR_PORT_PREFIX}${String(tabId)}` });
      port.onDisconnect.addListener(() => {
        if (!closed) connect();
      });
    };
    // MONITOR_TAB より先に接続する: SW 側で port 登録が attach 処理より先に
    // 完了しやすくなり、直前の popup クローズ由来の解放処理が lock 内の
    // port 再確認で新 popup の存在に気づけるようにする。
    connect();

    void chrome.runtime.sendMessage({
      type: 'MONITOR_TAB',
      tabId,
      params: paramsRef.current,
    });

    return () => {
      closed = true;
      port?.disconnect();
    };
  }, [tabId]);
};
