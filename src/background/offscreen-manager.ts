import { OFFSCREEN_DOCUMENT_URL } from '@/shared/constants';

let creating: Promise<void> | null = null;

// created=true は今回の呼び出しで新規作成したことを示す。
// 呼び出し側はこれを契機に Offscreen 側の状態を保持する SW 側キャッシュ
// (例: monitoredTabs) をリセットするのに使う。
export const ensureOffscreenDocument = async (): Promise<{ created: boolean }> => {
  const exists = await chrome.offscreen.hasDocument();
  if (exists) return { created: false };

  if (creating !== null) {
    await creating;
    return { created: false };
  }

  creating = chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_URL,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'タブ音声をキャプチャしてコンプレッサーを適用するため',
  });

  try {
    await creating;
    return { created: true };
  } finally {
    creating = null;
  }
};

export const closeOffscreenDocument = async (): Promise<void> => {
  const exists = await chrome.offscreen.hasDocument();
  if (!exists) return;
  await chrome.offscreen.closeDocument();
};
