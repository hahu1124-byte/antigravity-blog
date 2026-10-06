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
bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog node scripts/generate-uber-daily.mjs
```

2. dry-run で内容確認（ファイル出力なし）
```bash
bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog node scripts/generate-uber-daily.mjs --dry-run
```

3. ビルドして確認用 URL を提示（見た目の確認はユーザーが行う）
```bash
bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog node build.mjs
```
```bash
bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog --bg npx serve dist/blog -l 3456
# → http://localhost:3456/YYYYMM/YYYYMMDD_uber_daily/
```
ユーザーの確認が済んだら、`hrun.sh --list` で名前を確かめて `--stop` で止める。

4. コミット＆プッシュ（`dist/` は git 管理外なので `src/` だけを add する）
```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity/projects/antigravity-blog add src/
```
```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity/projects/antigravity-blog commit -m "🚴 Uber daily: YYYYMMDD"
```
```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity/projects/antigravity-blog push
```

---

## ガソリン価格の更新（独立した週次ワークフロー・自動）

- 独立したGitHub Actionsワークフロー `.github/workflows/update-gas-price.yml` が**毎週水・木 JST 18:00**（UTC 9:00。経産省の公表は原則水曜14:00で、木曜にずれる週のために木曜も再実行する。前週と同じならコミットはスキップ）に自動実行され、**`gas-price-cache.json`（価格データ）のみ**更新してcommit/pushする
  - `generate-uber-daily.mjs`（日次記事生成）は `scripts/gas-price-cache.json` を読むだけで、外部の経産省サイトへは一切アクセスしない（日次実行のたびにWAF/レート制限にかかる危険を増やさないため）
  - **xlsx実体のアーカイブはこのワークフローでは機能しない**（後述）。GitHub Actionsのクラウドランナーには `G:\マイドライブ` が存在せず、`update-gas-price.cjs` 側のアーカイブ先判定（`G:/マイドライブ/gas` への書き込み試行）がLinux上では単なる文字列パスとしてランナーの一時ディレクトリ内に作成されて「成功」してしまうため、ジョブ終了と同時に消える。xlsxのアーカイブはローカル側が担う
- 実体: `scripts/fetch-gas-price.py`
  - 経産省の結果ページ（results.html）を `curl_cffi`（TLS fingerprintをChromeに偽装）で取得 → 最新xlsxのURLを抽出 → xlsxをダウンロード
    （素のcurl/node fetch/PlaywrightヘッドレスはAWS WAFのボット判定で弾かれるが、TLS fingerprint偽装は通過する）
  - `update-gas-price.cjs` がxlsxをパースしてキャッシュ更新し、`update-gas-price.yml` ワークフロー内で git commit/push される
- **前提**: 実行環境にPython 3 + `curl_cffi`（`pip install curl_cffi`）が必要。`update-gas-price.yml` ワークフローには `actions/setup-python` + インストールステップ済み。ローカルWindows環境は導入済み確認済み
- 取得失敗時（WAF強化・ネットワークエラー等）は既存キャッシュを使い続ける。8日以上更新が無いとログに警告が出る
- 手動で即時更新したい場合:
```bash
bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog node scripts/update-gas-price.cjs
```

### xlsx実体のアーカイブ（ローカルWindowsタスクスケジューラ・独立系統）

- xlsx実体を `G:\マイドライブ\gas\` に保存する処理は、上記GitHub Actionsとは完全に別系統として **ローカルPC側のWindowsタスクスケジューラ**が担う
  - タスク名: `AntigravityBlog_GasPriceArchive`（PowerShellの `Register-ScheduledTask` で登録済み、管理者権限不要）
  - トリガー: 毎週水曜 18:30、現在ユーザー権限で実行。`StartWhenAvailable` 設定済みのため、その時刻にPCが起動していなくても次回起動時に実行される
  - 実行内容: `node scripts/local-gas-archive.cjs`（作業ディレクトリ `H:\gravity\projects\antigravity-blog`）
  - `scripts/local-gas-archive.cjs` は `fetch-gas-price.py` を呼んでxlsxを `G:\マイドライブ\gas\` に保存するだけで、`gas-price-cache.json` の更新は行わない（それはGitHub Actions側の責務のまま）
- **保持期間**: 直近1年分（365日）。それより古いxlsxはアーカイブ時に自動削除される（`local-gas-archive.cjs` / `update-gas-price.cjs` 双方の `pruneOldFiles`）
- 手動実行:
```bash
bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog node scripts/local-gas-archive.cjs
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

- `generate-uber-daily.mjs` は同日の記事フラグメント（`src/articles/YYYYMM/YYYYMMDD_uber_daily.html`）を常に上書きし、`src/blog-data.json` の同日エントリも置き換える（冪等）。同日に再実行すれば最新データで更新される
- それでも一覧に重複が出る場合は、`src/articles/` に同日の別名ファイルが残っていないか確認する（`dist/` はビルドのたびに作り直されるので消しても直らない）

### ガソリン価格が表示されない

- `scripts/gas-price-cache.json` が存在するか確認
- `node scripts/update-gas-price.cjs` を単体実行し、標準出力のエラーを確認（`curl_cffi` 未インストールならまずそれを疑う）
- 経産省サイト側のWAF強化で取得できなくなった場合は既存キャッシュのまま表示される（記事生成自体は止まらない）

### xlsxアーカイブがG:\マイドライブ\gas\に保存されていない

- ローカルタスクスケジューラのタスク `AntigravityBlog_GasPriceArchive` が有効か確認（`Get-ScheduledTask -TaskName AntigravityBlog_GasPriceArchive`）
- 水曜18:30にPCが起動していなかった場合は `StartWhenAvailable` により次回起動時に実行される。それでも反映されない場合は `node scripts/local-gas-archive.cjs` を手動実行
- GitHub Actions側（`update-gas-price.yml`）はxlsx実体の保存を担当しないため、Actionsの実行成功はxlsxアーカイブの成功を意味しない

---

## ファイル一覧

| ファイル | 役割 |
|---------|------|
| `scripts/generate-uber-daily.mjs` | メイン生成スクリプト |
| `scripts/uber-daily-config.json` | ルール・キーワード・テンプレート設定 |
| `scripts/gas-price-cache.json` | ガソリン価格キャッシュ |
| `scripts/update-gas-price.cjs` | fetch-gas-price.py呼び出し＋xlsxパース→キャッシュ更新（GitHub Actions側） |
| `scripts/local-gas-archive.cjs` | fetch-gas-price.py呼び出し＋xlsx実体をG:\マイドライブ\gas\へ保存（ローカルタスクスケジューラ側、cache.json更新なし） |
| `scripts/fetch-gas-price.py` | curl_cffiでAWS WAFを回避しxlsxを直接取得 |
| `.github/workflows/uber-daily-report.yml` | 毎朝自動実行ワークフロー（記事生成） |
| `.github/workflows/update-gas-price.yml` | 毎週水・木自動実行ワークフロー（ガソリン価格キャッシュ更新のみ。xlsx実体のクラウド保存は機能しない） |
