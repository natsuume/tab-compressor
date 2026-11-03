# tab-compressor

タブ単位でコンプレッサーを適用する Chrome 拡張。YouTube 配信動画などで配信者の絶叫が過剰に大きい場合、上限を抑えて視聴しやすくする。

## 特徴

- **タブ単位**: 視聴中のタブだけに DynamicsCompressor を挿入。他タブ・他アプリの音量には影響しない
- **複数タブ同時 ON 対応**: 同時に複数タブでコンプレッサーを有効化できる
- **ページ遷移を跨いで維持**: 同一タブ内で別ページへ遷移 (SPA 遷移・リロード・通常のリンク遷移) しても ON のまま維持される。キャプチャが失われて再取得もできない場合のみ自動で OFF になり、ツールバーバッジ「OFF」で通知する
- **リアルタイム可視化**: 入力/出力/リダクションの各レベルメーター＋入出力カーブグラフ
- **自動 Makeup**: ON にすると、入力と出力の音量が一致するように Makeup をリアルタイムに自動調整する。手動の Makeup スライダーは、入出力一致を 0 dB としたオフセットとして加算される。時間平均したゲイン低減量に追従するため、短い絶叫に対する抑圧はそのまま残る。ON / OFF はタブごと・プリセットごとに保存する
- **セーフティリミッター**: コンプレッサーが ON のタブでは経路の末尾に -1 dBFS のリミッターを常設し、Makeup で持ち上げた音のクリップを抑える
- **プリセット**: 組み込みの「静音」に加え、現在の設定を My Presets として保存できる
- **自動有効化**: 設定を ON にすると、まだ操作していないタブで popup を開いた時点で、選んだプリセット (組み込み / My Presets) でコンプレッサーが ON になる。設定を ON にしたときに popup を開いているタブも、未操作ならその場で ON になる。一度 OFF にしたタブには適用しない。設定は `chrome.storage.local` に保存し、ブラウザを再起動しても保持する
- **タブ単位の設定永続化**: `chrome.storage.session` により、ブラウザセッション中のみ保持（タブを閉じると破棄）

## 技術スタック

- React 19 + TypeScript (strict)
- Vite 8 + `@crxjs/vite-plugin` + `@vitejs/plugin-react-swc`
- ESLint 9 Flat Config (`typescript-eslint` strict + `@stylistic`)
- Vitest (`src/shared/` の純粋関数の単体テスト)
- Manifest V3 / Offscreen Document / `chrome.tabCapture`

## 開発

```bash
pnpm install
pnpm dev            # vite dev + HMR
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm test           # vitest run (単体テスト)
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
- **Offscreen Document**: `getUserMedia` で MediaStream を取得し、ON のタブでは `source → inputAnalyser → compressor → compressorOutputAnalyser → makeupGain → autoMakeupGain → limiter → limiterCompensationGain → outputAnalyser → destination` を構築。30Hz の処理ループで、各タブの自動 Makeup の更新とメーター配信を行う
- **Popup**: `chrome.storage.session` を真実の情報源として購読・更新。メーターは `BroadcastChannel` 経由で受信

## ディレクトリ構成

```
src/
├── background/   # Service Worker：メッセージハブ、Offscreen 管理、tabs ライフサイクル
├── offscreen/    # AudioGraph：tabId ごとの source/compressor/limiter/analyser、自動 Makeup の更新とメーター配信を行う処理ループ
├── popup/        # React UI：トグル、プリセット、スライダー、グラフ、メーター
└── shared/       # 型定義、デフォルト値、プリセット、純粋関数（圧縮カーブ・dB変換・自動 Makeup の制御則・リミッター設定）
```

## 制限事項

- Chrome 116 以降が必要（Offscreen Document の USER_MEDIA reason が必要なため）
- `chrome.storage.session` を使用するため、ブラウザ再起動で設定は破棄される（仕様）
- アイコン画像は未同梱。必要に応じて `public/icons/` に配置し、`manifest.config.ts` の `icons` を復活させてください
- 別オリジンのページへ遷移した後にキャプチャが失われた場合は、activeTab の付与が切れているため自動復旧できず OFF に戻る (popup から再度 ON にする)
- 自動有効化では、タブを開いただけでは ON にならない。`chrome.tabCapture` はユーザーが拡張を呼び出した (アイコンのクリック等) タブでしか使えないため、各タブで 1 回 popup を開く必要がある
