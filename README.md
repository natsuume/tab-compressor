# tab-compressor

タブ単位でコンプレッサーを適用する Chrome 拡張。YouTube 配信動画などで配信者の絶叫が過剰に大きい場合、上限を抑えて視聴しやすくする。

## 特徴

- **タブ単位**: 視聴中のタブだけに DynamicsCompressor を挿入。他タブ・他アプリの音量には影響しない
- **複数タブ同時 ON 対応**: 同時に複数タブでコンプレッサーを有効化できる
- **リアルタイム可視化**: 入力/出力/リダクションの各レベルメーター＋入出力カーブグラフ
- **プリセット**: 「絶叫抑制(弱/強)」「配信向け」「バイパス相当」
- **タブ単位の設定永続化**: `chrome.storage.session` により、ブラウザセッション中のみ保持（タブを閉じると破棄）

## 技術スタック

- React 19 + TypeScript (strict)
- Vite 8 + `@crxjs/vite-plugin` + `@vitejs/plugin-react-swc`
- ESLint 9 Flat Config (`typescript-eslint` strict + `@stylistic`)
- Manifest V3 / Offscreen Document / `chrome.tabCapture`

## 開発

```bash
pnpm install
pnpm dev            # vite dev + HMR
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm build          # 本番ビルド → dist/
```

### 拡張を Chrome に読み込む

1. `pnpm build` で `dist/` を生成
2. `chrome://extensions` を開き、右上の「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」→ `dist/` を選択
4. YouTube 配信タブを開き、ツールバーの拡張アイコンから Popup を起動

## アーキテクチャ

```
┌──────────┐  sendMessage   ┌────────────────┐  sendMessage   ┌──────────────┐
│  Popup   │ ─────────────▶ │ Service Worker │ ─────────────▶ │   Offscreen  │
│ (React)  │ ◀───────────── │  (background)  │                │ (AudioGraph) │
└──────────┘ storage.session └────────────────┘  getMediaStream└──────────────┘
       ▲                                                              │
       │              BroadcastChannel (30Hz meters)                  │
       └──────────────────────────────────────────────────────────────┘
```

- **Service Worker**: `chrome.tabCapture.getMediaStreamId({ targetTabId })` で streamId を発行し Offscreen に引き渡す
- **Offscreen Document**: `getUserMedia` で MediaStream を取得し `source → analyser → compressor → analyser → destination` を構築
- **Popup**: `chrome.storage.session` を真実の情報源として購読・更新。メーターは `BroadcastChannel` 経由で受信

## ディレクトリ構成

```
src/
├── background/   # Service Worker：メッセージハブ、Offscreen 管理、tabs ライフサイクル
├── offscreen/    # AudioGraph：tabId ごとの source/compressor/analyser、メーター配信
├── popup/        # React UI：トグル、プリセット、スライダー、グラフ、メーター
└── shared/       # 型定義、デフォルト値、プリセット、純粋関数（圧縮カーブ・dB変換）
```

## 制限事項

- Chrome 116 以降が必要（Offscreen Document の USER_MEDIA reason が必要なため）
- `chrome.storage.session` を使用するため、ブラウザ再起動で設定は破棄される（仕様）
- アイコン画像は未同梱。必要に応じて `public/icons/` に配置し、`manifest.config.ts` の `icons` を復活させてください
