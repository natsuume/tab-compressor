export const getTabMediaStreamId = (tabId: number): Promise<string> =>
  new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      const err = chrome.runtime.lastError;
      if (err !== undefined) {
        reject(new Error(err.message ?? 'tabCapture.getMediaStreamId failed'));
        return;
      }
      if (typeof streamId !== 'string' || streamId.length === 0) {
        reject(new Error('streamId is empty'));
        return;
      }
      resolve(streamId);
    });
  });
