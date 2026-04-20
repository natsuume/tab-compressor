import type { CompressorParams } from './compressor-params';

export type Msg =
  | { type: 'ENABLE_TAB'; tabId: number; params: CompressorParams }
  | { type: 'DISABLE_TAB'; tabId: number }
  | { type: 'UPDATE_PARAMS'; tabId: number; params: CompressorParams }
  | { type: 'SET_STREAM'; tabId: number; streamId: string; params: CompressorParams }
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

export type TargetedMsg = Msg & { target: typeof OFFSCREEN_TARGET | typeof BACKGROUND_TARGET };
