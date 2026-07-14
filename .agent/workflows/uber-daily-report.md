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
git add -f dist/ src/
git commit -m "🚴 Uber daily: YYYYMMDD"
git push
```

---

## ガソリン価格の更新（独立した週次ワークフロー・自動）

- 独立したGitHub Actionsワークフロー `.github/workflows/update-gas-price.yml` が**毎週水曜 JST 18:00**（UTC 9:00、経産省の公表は水曜14:00なので余裕を持たせて設定）に自動実行され、キャッシュを更新する
  - `generate-uber-daily.mjs`（日次記事生成）は `scripts/gas-price-cache.json` を読むだけで、外部の経産省サイトへは一切アクセスしない（責務分離。日次実行のたびにWAF/レート制限リスクを高めていた旧設計を解消）
- 実体: `scripts/fetch-gas-price.py`
  - 経産省の結果ページ（results.html）を `curl_cffi`（TLS fingerprintをChromeに偽装）で取得 → 最新xlsxのURLを抽出 → xlsxをダウンロード
    （素のcurl/node fetch/PlaywrightヘッドレスはAWS WAFのボット判定で弾かれるが、TLS fingerprint偽装は通過する）
  - `update-gas-price.cjs` がxlsxをパースしてキャッシュ更新し、`update-gas-price.yml` ワークフロー内で git commit/push される
  - xlsx実体は `G:\マイドライブ\gas\`（不可の場合 `scripts/gas-archive\`）に最大5世代アーカイブ
- **前提**: 実行環境にPython 3 + `curl_cffi`（`pip install curl_cffi`）が必要。`update-gas-price.yml` ワークフローには `actions/setup-python` + インストールステップ済み。ローカルWindows環境は導入済み確認済み
- 取得失敗時（WAF強化・ネットワークエラー等）は既存キャッシュを使い続ける。8日以上更新が無いとログに警告が出る
- 手動で即時更新したい場合:
```bash
node scripts/update-gas-price.cjs
```

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
| ガソリン価格 | gas-price-cache.json（週次ワークフローがcurl_cffiで自動取得） | 自動 |
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
- `node scripts/update-gas-price.cjs` を単体実行し、標準出力のエラーを確認（`curl_cffi` 未インストールならまずそれを疑う）
- 経産省サイト側のWAF強化で取得できなくなった場合は既存キャッシュのまま表示される（記事生成自体は止まらない）

---

## ファイル一覧

| ファイル | 役割 |
|---------|------|
| `scripts/generate-uber-daily.mjs` | メイン生成スクリプト |
| `scripts/uber-daily-config.json` | ルール・キーワード・テンプレート設定 |
| `scripts/gas-price-cache.json` | ガソリン価格キャッシュ |
| `scripts/update-gas-price.cjs` | fetch-gas-price.py呼び出し＋xlsxパース→キャッシュ更新 |
| `scripts/fetch-gas-price.py` | curl_cffiでAWS WAFを回避しxlsxを直接取得 |
| `.github/workflows/uber-daily-report.yml` | 毎朝自動実行ワークフロー（記事生成） |
| `.github/workflows/update-gas-price.yml` | 毎週水曜自動実行ワークフロー（ガソリン価格キャッシュ更新） |
