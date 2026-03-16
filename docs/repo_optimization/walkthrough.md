# リポジトリ最適化 ウォークスルー

実施日: 2026-03-17

## 概要

antigravity-blog と gravity-portal の画像最適化・不要ファイル削除・CSS/JS minifyを実施。UIに一切変更なし。

## 結果サマリー

| フェーズ | 対象 | 削減量 |
|---|---|---|
| Phase 1 | 画像WebP変換（51枚） | **29.9 MB** |
| Phase 2 | 不要ファイル削除 | 7.4 KB |
| Phase 3 | CSS/JS minify | **164.3 KB** |
| **合計** | | **~30 MB** |

## Phase 1: 画像WebP変換

### antigravity-blog（45枚: 30.6MB → 3.2MB, 89.6%削減）

- `scripts/convert-to-webp.mjs` を作成（sharp, 品質80）
- `build.mjs` に `.png→.webp` 自動変換ロジックを追加
  - ソースHTML内の `.png` 参照をビルド時に `.webp` に自動置換
  - OGP画像のmetaタグも自動変換
- `DEFAULT_OG_IMAGE` を `.webp` に変更
- 元PNG 45枚を削除

### gravity-portal（6枚: 2.7MB → 0.2MB, 94.3%削減）

- `scripts/convert-ogp-to-webp.mjs` を作成
- 3ファイルのOGP画像参照を更新:
  - `src/app/layout.tsx`
  - `src/components/JsonLd.tsx`
  - `src/app/game/pachinko-idle/layout.tsx`
- PWAアイコン（icon-192/512）はPNG仕様のため変換せず

## Phase 2: 不要ファイル整理

- `scripts/edit-day4.mjs` 削除（一度きりのDay4記事編集スクリプト）
- `scripts/fix-day4-newlines.mjs` 削除（一度きりの改行修正スクリプト）

## Phase 3: CSS/JS minify

- `esbuild` をdevDependencyとして導入
- `build.mjs` 末尾にminify後処理を追加
  - dist内の全CSS/JSファイルを再帰的に収集
  - esbuildのtransform APIでminify
  - 失敗時はスキップ（元ファイルを維持）
- **30ファイル中24ファイルをminify化、164.3KB削減**
- gravity-portalはNext.jsが本番ビルド時に自動minifyするため追加対応不要
