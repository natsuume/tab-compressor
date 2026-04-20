import { useEffect, useState } from 'react';

export const useCurrentTabId = (): number | null => {
  const [tabId, setTabId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (cancelled) return;
      const id = tabs[0]?.id ?? null;
      setTabId(id);
    }).catch(() => {
      if (!cancelled) setTabId(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return tabId;
};
