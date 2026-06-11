export const METER_HZ = 30;
export const METER_INTERVAL_MS = Math.round(1000 / METER_HZ);

export const BROADCAST_CHANNEL_METERS = 'tab-compressor/meters';

// popup 生存検知用 Port の名前接頭辞。`monitor:<tabId>` 形式で接続する。
export const MONITOR_PORT_PREFIX = 'monitor:';

export const STORAGE_KEY_PREFIX = 'tab_';

export const OFFSCREEN_DOCUMENT_URL = 'src/offscreen/offscreen.html';

export const PARAM_SMOOTHING_TIME_CONSTANT = 0.02;

export const DB_FLOOR = -100;
