# リポジトリ最適化タスク

## Phase 1: 画像WebP変換
- [x] antigravity-blog の画像をWebPに変換（45枚, 30.6MB → 3.2MB, 89.6%削減）
  - [x] sharp インストール & 変換スクリプト作成
  - [x] WebP変換実行 & サイズ比較ログ
  - [x] build.mjs を修正（画像パス .png → .webp 自動変換）
  - [x] 元のPNGファイルを削除
  - [x] ビルド確認 & ローカルテスト
  - [x] コミット & プッシュ
- [ ] gravity-portal のOGP画像をWebPに変換（6枚, 2.8MB）
  - [ ] 変換実行
  - [ ] メタタグのパス更新
  - [ ] コミット & プッシュ

## Phase 2: 不要ファイル整理
- [ ] 不要ファイル・コードの確認と整理

## Phase 3: CSS/JS minify + Git整理
- [ ] CSS minify
- [ ] HTML minify検討
- [ ] Git gc実行
