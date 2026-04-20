import { isMsg, OFFSCREEN_TARGET } from '@/shared/messages';
import {
  removeTab,
  setStreamForTab,
  setTabEnabled,
  stopMonitoringTab,
  updateTabParams,
} from './graph-registry';
import { startBroadcasting } from './meter-broadcaster';

type TargetedEnvelope = { target?: unknown };

const hasOffscreenTarget = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const target = (value as TargetedEnvelope).target;
  return target === OFFSCREEN_TARGET;
};

chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
  if (!hasOffscreenTarget(raw) || !isMsg(raw)) {
    return false;
  }

  const handle = async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      switch (raw.type) {
        case 'SET_STREAM':
          await setStreamForTab(raw.tabId, raw.streamId, raw.params, raw.enabled);
          startBroadcasting();
          return { ok: true };
        case 'SET_ENABLED':
          setTabEnabled(raw.tabId, raw.enabled, raw.params);
          return { ok: true };
        case 'UPDATE_PARAMS':
          updateTabParams(raw.tabId, raw.params);
          return { ok: true };
        case 'STOP_MONITOR':
          stopMonitoringTab(raw.tabId);
          return { ok: true };
        case 'DESTROY_GRAPH':
          removeTab(raw.tabId);
          return { ok: true };
        case 'PING_OFFSCREEN':
          return { ok: true };
        default:
          return { ok: false, error: `unhandled: ${raw.type}` };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  };

  handle().then(sendResponse).catch((err: unknown) => {
    sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
  });
  return true;
});
