# Uber配達デイリーレポート 自動投稿システム

## タスク一覧

- [x] 設定ファイル作成（`uber-daily-config.json`）
- [x] メインスクリプト実装（`generate-uber-daily.mjs`）
  - [x] 天気データ取得（気象庁API）
  - [x] ニュースRSS取得（NHK + Google News）
  - [x] ガソリン価格取得（経産省週次データ → JSONキャッシュ方式）
  - [x] ピーク予測（ルールベース）
  - [x] 体感指数・アドバイス生成
  - [x] 曜日別傾向・一言コメント
  - [x] HTML生成・ファイル出力
  - [x] blog-data.json 更新
  - [x] ブログ一覧ページ更新
- [x] GitHub Actions ワークフロー作成
- [x] ローカルテスト（通常実行 + dry-run）
- [x] 生成記事の検証（HTML構造・コンテンツ・ブログ一覧カード）
- [ ] 実際のデプロイ確認（pushはユーザーが実行）
