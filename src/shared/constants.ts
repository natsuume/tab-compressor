export const METER_HZ = 30;
export const METER_INTERVAL_MS = Math.round(1000 / METER_HZ);

export const BROADCAST_CHANNEL_METERS = 'tab-compressor/meters';

// popup 生存検知用 Port の名前接頭辞。`monitor:<tabId>` 形式で接続する。
export const MONITOR_PORT_PREFIX = 'monitor:';

export const STORAGE_KEY_PREFIX = 'tab_';

export const OFFSCREEN_DOCUMENT_URL = 'src/offscreen/offscreen.html';

export const PARAM_SMOOTHING_TIME_CONSTANT = 0.02;

// 自動 Makeup のゲインを GainNode に反映するときの時定数 (秒)。
// 処理ループの tick ごとに目標値が変わるため、tick 間の段差を均す。
export const AUTO_MAKEUP_APPLY_SMOOTHING_SEC = 0.1;

// ミキサーのゲインを GainNode に反映するときの時定数 (秒)。
// 音が出ているタブが増減して中央値が変わったときの、ゲインの段差を均す。
export const MIXER_APPLY_SMOOTHING_SEC = 0.5;

export const DB_FLOOR = -100;
