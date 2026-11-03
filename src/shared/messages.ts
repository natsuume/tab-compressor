import type { CompressorParams } from './compressor-params';
import type { MixerSettings } from './mixer-settings';

// SET_STREAM でグラフと一緒に渡す、そのタブの手動オフセットと全タブ共通のミキサー設定。
export type MixerStreamState = { offsetDb: number; settings: MixerSettings };

export type Msg =
  | { type: 'ENABLE_TAB'; tabId: number; params: CompressorParams }
  | { type: 'DISABLE_TAB'; tabId: number }
  | { type: 'UPDATE_PARAMS'; tabId: number; params: CompressorParams }
  | { type: 'SET_STREAM'; tabId: number; streamId: string; params: CompressorParams; enabled: boolean; mixer: MixerStreamState }
  | { type: 'SET_ENABLED'; tabId: number; enabled: boolean; params: CompressorParams }
  | { type: 'MONITOR_TAB'; tabId: number; params: CompressorParams }
  // 自動有効化設定を ON にした直後に popup から送る。未操作のタブなら設定に従って ON にする
  | { type: 'APPLY_AUTO_ENABLE'; tabId: number }
  | { type: 'STOP_MONITOR'; tabId: number }
  | { type: 'DESTROY_GRAPH'; tabId: number }
  | { type: 'GRAPH_LOST'; tabId: number }
  // popup → SW: 手動オフセットを storage に保存した後に送る。SW → Offscreen: 同じ型でグラフに反映させる
  | { type: 'UPDATE_MIXER_OFFSET'; tabId: number; offsetDb: number }
  // popup → SW: ミキサー設定 (保存時刻付き) を storage に保存した後に送る
  | { type: 'UPDATE_MIXER_SETTINGS'; settings: MixerSettings }
  // SW → Offscreen: ミキサー設定を全タブのミキサーに反映させる。Offscreen は保存時刻の新しい方だけを採る
  | { type: 'SET_MIXER_SETTINGS'; settings: MixerSettings }
  | { type: 'PING_OFFSCREEN' };

export type MsgType = Msg['type'];

export const isMsg = (value: unknown): value is Msg => {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as { type?: unknown };
  return typeof obj.type === 'string';
};

export const OFFSCREEN_TARGET = 'offscreen' as const;
export const BACKGROUND_TARGET = 'background' as const;

// Offscreen が「指定 tabId のグラフが存在しない」状態を示すために返す error 文字列。
// SW 側はこの値で missing-graph を識別し、cache 不整合の修復に限定して扱う。
export const OFFSCREEN_NO_GRAPH_ERROR = 'no graph for tab' as const;

export type TargetedMsg = Msg & { target: typeof OFFSCREEN_TARGET | typeof BACKGROUND_TARGET };
