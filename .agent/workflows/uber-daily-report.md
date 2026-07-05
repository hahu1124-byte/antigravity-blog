---
description: Uber配達デイリーレポートの手動生成・ガソリン価格更新・トラブルシュート手順
---
// turbo-all

# Uber配達デイリーレポート ワークフロー

## 自動実行

- GitHub Actions `uber-daily-report.yml` が **毎朝 JST 6:00**（UTC 21:00）に自動実行
- `main` ブランチに push → `deploy.yml` が GitHub Pages にデプロイ

---

## 手動で記事を生成する場合

1. デイリーレポートを生成
```bash
node scripts/generate-uber-daily.mjs
```

2. dry-run で内容確認（ファイル出力なし）
```bash
node scripts/generate-uber-daily.mjs --dry-run
```

3. 生成結果をローカルで確認
```bash
npx serve dist/blog -l 3456
# → http://localhost:3456/YYYYMM/YYYYMMDD_uber_daily/
```

4. コミット＆プッシュ
```bash
git add -f dist/ src/ scripts/gas-price-cache.json
git commit -m "🚴 Uber daily: YYYYMMDD"
git push
```

---

## ガソリン価格を更新する場合（毎週水曜推奨）

1. 経産省サイトから最新の xlsx をダウンロード
   - https://www.enecho.meti.go.jp/statistics/petroleum_and_lpgas/pl007/results.html
   - `G:\マイドライブ\gas\` に保存

2. キャッシュ更新スクリプトを実行（xlsxパスを直接指定）
```bash
node scripts/update-gas-price.cjs "G:/マイドライブ/gas/260701.xlsx"
```
   - 実行後、スクリプトが自動で `git add / commit / push` まで行う（コミット忘れ防止のため v2 で追加）
   - 失敗した場合のみ手動で `git add scripts/gas-price-cache.json && git commit && git push`

⚠️ **経産省サイトの直接ダウンロードは自動化不可**: enecho.meti.go.jp は AWS WAF のボット判定があり、
curl/node fetch/GitHub Actions からの直接ダウンロードは 202 challenge で弾かれ不安定。
必ず実ブラウザで手動ダウンロードすること（自動フェッチのコードは組み込まない）。

---

## 生成される記事の構成

| セクション | データソース | 自動/手動 |
|-----------|------------|----------|
| 天気予報（名古屋3日分） | weather.tsukumijima.net API | 自動 |
| 需要予測 | 天気＋曜日ルール | 自動 |
| 体感指数・アドバイス | 最高気温ルール | 自動 |
| 曜日別傾向 | uber-daily-config.json | 自動 |
| 道路交通情報 | JARTIC リンク | 固定 |
| ニュース | NHK + Google News RSS | 自動 |
| イベント情報 | Walker Plus リンク | 固定 |
| ガソリン価格 | gas-price-cache.json | 週次手動 |
| Amazon アフィリエイト | uber-daily-config.json | 固定 |

---

## 設定を変更する場合

- `scripts/uber-daily-config.json` を編集
  - ニュースキーワード追加/削除
  - ピーク予測ルールの倍率変更
  - 曜日別一言メッセージ変更
  - タイトルテンプレート変更
  - Amazon 検索キーワード変更

---

## トラブルシュート

### GitHub Actions が動かない
- `.github/workflows/uber-daily-report.yml` の cron 設定を確認
- Actions タブ → 「Generate Uber Daily Report」→ 「Run workflow」で手動実行テスト

### 記事が重複した
- `generate-uber-daily.mjs` は同日スキップ機能あり（blog-data.json + index.html 両方チェック）
- 重複した場合は `dist/blog/YYYYMM/YYYYMMDD_uber_daily/` を削除して再実行

### ガソリン価格が表示されない
- `scripts/gas-price-cache.json` が存在するか確認
- `node scripts/update-gas-price.cjs` で再取得

### xlsx 読み取りでフリーズする
- bash ワンライナーで xlsx を扱う場合 `!` がヒストリ展開される → スクリプトファイル経由で実行すること
- `process.exit(0)` を末尾に必ず入れる

---

## ファイル一覧

| ファイル | 役割 |
|---------|------|
| `scripts/generate-uber-daily.mjs` | メイン生成スクリプト |
| `scripts/uber-daily-config.json` | ルール・キーワード・テンプレート設定 |
| `scripts/gas-price-cache.json` | ガソリン価格キャッシュ |
| `scripts/update-gas-price.cjs` | 経産省 xlsx → キャッシュ更新 |
| `.github/workflows/uber-daily-report.yml` | 毎朝自動実行ワークフロー |
