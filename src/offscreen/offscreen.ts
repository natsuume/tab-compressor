import { isMsg, OFFSCREEN_NO_GRAPH_ERROR, OFFSCREEN_TARGET } from '@/shared/messages';
import { normalizeCompressorParams } from '@/shared/compressor-params';
import { normalizeMixerSettings } from '@/shared/mixer-settings';
import { normalizeMixerOffsetDb } from '@/shared/tab-mixer';
import {
  removeTab,
  setStreamForTab,
  setTabEnabled,
  setTabMixerOffset,
  stopMonitoringTab,
  updateTabParams,
} from './graph-registry';
import { applyMixerSettings } from './mixer-controller';
import { startProcessingLoop } from './processing-loop';

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
      // 受け取った params とミキサーのオフセット・設定は、使う前に正規化する。保存済みの
      // TabState などにフィールドが無い場合でも、補完値で処理できるようにするため。
      switch (raw.type) {
        case 'SET_STREAM':
          await setStreamForTab(
            raw.tabId,
            raw.streamId,
            normalizeCompressorParams(raw.params),
            raw.enabled,
            normalizeMixerOffsetDb(raw.mixer.offsetDb),
          );
          applyMixerSettings(normalizeMixerSettings(raw.mixer.settings));
          startProcessingLoop();
          return { ok: true };
        case 'SET_ENABLED':
          if (!setTabEnabled(raw.tabId, raw.enabled, normalizeCompressorParams(raw.params))) {
            return { ok: false, error: OFFSCREEN_NO_GRAPH_ERROR };
          }
          return { ok: true };
        case 'UPDATE_PARAMS':
          if (!updateTabParams(raw.tabId, normalizeCompressorParams(raw.params))) {
            return { ok: false, error: OFFSCREEN_NO_GRAPH_ERROR };
          }
          return { ok: true };
        case 'UPDATE_MIXER_OFFSET':
          if (!setTabMixerOffset(raw.tabId, normalizeMixerOffsetDb(raw.offsetDb))) {
            return { ok: false, error: OFFSCREEN_NO_GRAPH_ERROR };
          }
          return { ok: true };
        case 'SET_MIXER_SETTINGS':
          applyMixerSettings(normalizeMixerSettings(raw.settings));
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
