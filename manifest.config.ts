import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'Tab Compressor',
  description: 'タブ単位でコンプレッサーを適用し、配信動画などの絶叫音声の上限を抑える',
  version: pkg.version,
  minimum_chrome_version: '116',
  action: {
    default_popup: 'src/popup/popup.html',
    default_title: 'Tab Compressor',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  permissions: ['tabCapture', 'offscreen', 'storage', 'activeTab', 'webNavigation'],
  web_accessible_resources: [
    {
      resources: ['src/offscreen/offscreen.html'],
      matches: ['<all_urls>'],
    },
  ],
});
