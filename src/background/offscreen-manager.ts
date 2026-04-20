import { OFFSCREEN_DOCUMENT_URL } from '@/shared/constants';

let creating: Promise<void> | null = null;

export const ensureOffscreenDocument = async (): Promise<void> => {
  const exists = await chrome.offscreen.hasDocument();
  if (exists) return;

  if (creating !== null) {
    await creating;
    return;
  }

  creating = chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_URL,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'タブ音声をキャプチャしてコンプレッサーを適用するため',
  });

  try {
    await creating;
  } finally {
    creating = null;
  }
};

export const closeOffscreenDocument = async (): Promise<void> => {
  const exists = await chrome.offscreen.hasDocument();
  if (!exists) return;
  await chrome.offscreen.closeDocument();
};
