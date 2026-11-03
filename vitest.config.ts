import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// 単体テスト用の設定。vite.config.ts は拡張ビルド用の crx プラグインを含むため流用せず、
// テスト対象のコードが使う '@' エイリアスだけを同じ解決先で定義する。
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
