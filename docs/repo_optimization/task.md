# リポジトリ最適化タスク

## Phase 1: 画像WebP変換

- [x] antigravity-blog の画像をWebPに変換（45枚, 30.6MB → 3.2MB, 89.6%削減）
  - [x] sharp インストール & 変換スクリプト作成
  - [x] WebP変換実行 & サイズ比較ログ
  - [x] build.mjs を修正（画像パス .png → .webp 自動変換）
  - [x] 元のPNGファイルを削除
  - [x] ビルド確認 & ローカルテスト
  - [x] コミット & プッシュ
- [x] gravity-portal のOGP画像をWebPに変換（6枚, 2.7MB → 0.2MB, 94.3%削減）
  - [x] 変換スクリプト作成 & 実行
  - [x] メタタグのパス更新（layout.tsx, JsonLd.tsx, pachinko-idle/layout.tsx）
  - [x] 元PNGファイルを削除
  - [x] コミット & プッシュ

## Phase 2: 不要ファイル整理

- [x] antigravity-blog: 一時スクリプト2件削除（edit-day4.mjs, fix-day4-newlines.mjs）
- [x] gravity-portal: ログファイルは既に.gitignore対象で問題なし

## Phase 3: CSS/JS minify

- [x] esbuild導入（devDependency）
- [x] build.mjs にCSS/JS自動minify処理追加（30ファイル中24ファイル, 164.3KB削減）
- [x] gravity-portal はNext.jsが自動minifyするため対応不要
