import type { CompressorParams } from './compressor-params';

export type Msg =
  | { type: 'ENABLE_TAB'; tabId: number; params: CompressorParams }
  | { type: 'DISABLE_TAB'; tabId: number }
  | { type: 'UPDATE_PARAMS'; tabId: number; params: CompressorParams }
  | { type: 'SET_STREAM'; tabId: number; streamId: string; params: CompressorParams; enabled: boolean }
  | { type: 'SET_ENABLED'; tabId: number; enabled: boolean; params: CompressorParams }
  | { type: 'MONITOR_TAB'; tabId: number; params: CompressorParams }
  | { type: 'STOP_MONITOR'; tabId: number }
  | { type: 'DESTROY_GRAPH'; tabId: number }
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
