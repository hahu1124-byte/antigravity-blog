---
description: ブログ記事の新規追加手順（記事HTML作成→OGP自動生成→ビルド確認→プッシュ）
---

# ブログ記事追加ワークフロー

新しいブログ記事を追加する際は、以下の手順に従う。

## 前提

- 記事のHTMLデータは `src/articles/YYYYMM/記事スラッグ.html` に格納（プロジェクトルート: `h:/gravity/projects/antigravity-blog`）
- 記事メタデータは `src/blog-data.json` に集約する。一覧ページ・タグページ・OGPメタタグ・関連記事・前後ナビは全てここと`src/articles/`から`node build.mjs`が自動生成する
- **`dist/` を手動編集・手動addする必要はない。** `node build.mjs`がsrc/配下から毎回全ページを再生成し、push後はGitHub Actionsの`deploy.yml`が同じビルドを実行してデプロイする
- `/blog/*` はGravity Portalの rewrite（本番は`vercel.json`）で `https://hahu1124-byte.github.io/antigravity-blog/blog/*` にプロキシ
- **【重要・個人情報＆内部実務のマスキング方針】**:
  - 記事内で扱う個人情報、プライベートなローカルパス（`G:/...`, `H:/...` 等）、特定クライアント・案件の生々しい固有名詞や内情は**必ず抽象化・マスキングして記述すること**。
  - 「読者が自身の環境で模倣・再現できる汎用的なベストプラクティス・設計パターン」としてクリーンに昇華して記事化する。

## 手順

### 1. 記事コンテンツHTML作成（Frontmatter付き）

`src/articles/YYYYMM/記事スラッグ.html` に記事ファイルを作成する。
先頭にHTMLコメント形式でメタデータ（Frontmatter）を記述し、その後に本文を書く（`<html>`・`<head>`・`<style>`等は不要。テンプレートが自動付与する）。

```html
<!--
title: 🚀 絵文字 タイトル
date: YYYY-MM-DD
excerpt: 記事の概要（120文字程度）
tags: [タグ1, タグ2]
-->
<p><img src="/blog/images/画像名.png" alt="説明"></p>
<p>
  本文...
</p>
```

> **ポイント**: `blog-data.json` の手動編集は不要です！`node build.mjs` が各記事HTMLの先頭コメントからメタデータを自動収集し、`dist/blog-data.json` を生成します。

### 2. ヒーロー画像／OGPアイキャッチ画像 ⚠️最重要ルール

> [!CAUTION]
> **手で書く記事（自動投稿以外）のアイキャッチは、必ず画像生成 AI で作った絵＋日本語の見出しの合成にする。`generate-og-images.mjs`（sharp で文字だけの OGP を作る自動生成）は使わない。** 自動生成は Uber 日次レポート・週刊テックトレンドなど自動投稿の記事だけ（2026-10-06 ユーザー指示「自動生成スクリプトで作らないでくれ。それは自動投稿での自動生成だけにしてくれ」）。ゲームの図柄など手持ちの素材を並べただけの画像でもなく、ほかの記事のアイキャッチ（AI の絵に見出しを重ねたもの）にそろえる（同日「ゲーム図柄のデザインじゃなくて普通に他のブログ記事のOGP画像みたいな感じで」）。

**【Antigravity（Gemini）での執筆時】** `generate_image` ツール（Nanobanana）で記事の世界観・テーマに合わせたアイキャッチ（16:9）を生成する。

**【Claude Code での執筆時】** `generate_image` が無いので、Canva の `generate-image`（`aspectRatio: LANDSCAPE_16_9`）で絵を生成し、`get-generate-image-job` で受け取る。プロンプトは下の `--suggest` の案をもとに、見出しを置く左側を暗く空けるよう指定し、`no text, no letters, no logos` を付ける。実在の機種・メーカーのロゴや筐体に似せない。
- **元の大きさの画像の受け取り方**: `get-generate-image-job`・`get-assets` で受け取れるのは 200×112 の縮小版だけで、縮小版 URL の大きさ指定を書き換えても署名で 403 になる。Canva のリンク（`canva.com/M/...`）はログインなしの `curl` では「Unsupported client」になる。**ユーザーの手を借りずに取る方法（2026-10-07 確認）**: `create-design`（format `YouTube Thumbnail` → 1920×1080 のページ）で作業用デザインを作る → `read-design`（`open_transaction: true`）→ `edit-design` の `insert_fill`（`asset_id` に生成画像の media id、`top/left 0`・`width 1920`・`height 1080`）で全面に貼る。複数枚は `add_page`（1920×1080）でページを足して 1 ページ 1 枚 → `commit` → `export-design`（`jpg`・`quality 95`・`width 1920`・`height 1080`・`pages`）で返る URL を `curl` で保存する。作業用デザインはユーザーの Canva に残る。
- 見出しの合成は `overlay-typography.mjs` と同じ作り（sharp ＋ SVG。左を暗くするグラデーション・バッジ・グラデーションの見出し・副題・GRAVITY PORTAL）。合成した PNG を下の `import-article-image.mjs` に渡す。例: 2026-10-06 の目押しチャレンジ記事（`20261006_meoshi_challenge.webp`）。

1. **プロンプト候補の取得（推奨）**:
   記事タイトルからおすすめのプロンプト案（サイバー調・シネマティック調・イラスト調）を生成可能：
   ```bash
   bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog node scripts/import-article-image.mjs --suggest "記事タイトル"
   ```
2. **Nanobanana画像生成**: `generate_image` ツール（16:9）で画像を生成。
3. **日本語の見出しの合成（必須）**:
   - `scripts/overlay-typography.mjs` は過去の 1 記事用に入力画像・出力先が固定されているので、そのまま実行しない（過去記事の画像を上書きする）。複製して入力画像・出力先・見出し・副題を今回の記事に書き換えて実行し、文字なしの絵に見出し・バッジを合成する。
   - 合成した PNG を次の手順 4 に渡す。
4. **画像の自動インポート＆記事反映（一括ワンコマンド）**:
   ```bash
   bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog node scripts/import-article-image.mjs "生成画像パス" 記事スラッグ
   ```
   - **自動実行される処理**:
     - `ffmpeg` による WebP 変換（quality 85）と `src/images/` への自動配置
     - 記事 HTML の Frontmatter（`ogImage: スラッグ.webp`）自動設定
     - 記事本文先頭への `<p><img src="/blog/images/スラッグ.webp" alt="..."></p>` の自動挿入（**※画像を変更・再生成した際も同じコマンドを実行するだけで既存タグが安全に自動差し替えされます**）
     - `node build.mjs` による自動再ビルド

### 3. OGP画像の自動生成（自動投稿の記事だけ）

Uber日次レポート・週刊テックトレンドなど**自動投稿の記事だけ**、sharpによる自動生成CLI（`scripts/generate-og-images.mjs`）を使う。**手で書く記事には使わない**（§2）:

```bash
bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog node scripts/generate-og-images.mjs --slug YYYYMM/記事スラッグ
```

### 4. ローカルビルドと表示確認（画像・OGP確認必須🚨）

```bash
bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog node build.mjs
```

- 出力の `🔗 内部リンクチェックOK` を確認する。
- 開発サーバーをバックグラウンドで起動し、確認用 URL を提示する（アイキャッチ画像・OGP・記事本文の見た目の確認はユーザーが行う）：
  ```bash
  bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog --bg npx serve dist -p 4000
  ```
- ユーザーの確認が済んだら、`hrun.sh --list` で名前を確かめて `--stop` で止める。

### 5. ユーザーへの事前提示と確認（絶対遵守🚨）

> [!CAUTION]
> **記事作成・画像反映後、勝手にプッシュ（デプロイ）まで先回り実行してはならない。**
> アイキャッチ画像（WebP）やOGPの仕上がり、記事タイトル・内容をユーザーへ提示し、**ユーザーから「これでプッシュして」「OK」等の明示的な承認を得てから**次のコミット・プッシュに進むこと。

### 6. Git コミット＋プッシュ（ユーザー承認後のみ実行・hgit.sh 経由）

```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity/projects/antigravity-blog add src/
```

```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity/projects/antigravity-blog commit -m "blog: タイトル"
```

```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity/projects/antigravity-blog push
```

> [!CAUTION]
> **`&&` チェーンは絶対禁止。** 必ず個別の `run_command` に分割する。
> `dist/` はコミット対象に含めない（push後にGitHub Actionsの`deploy.yml`が`node build.mjs`で本番分を再生成するため）。

### 6. GitHub Pagesデプロイ確認

プッシュ後、GitHub Actions完了を待ってからSNS投稿する（デプロイ前に投稿するとOGPカードが「Page not found」になる）。

確認URL: `https://www.antigravity-portal.com/blog/YYYYMM/記事スラッグ/`

### 7. SNS投稿（手動）

- **X**: `https://twitter.com/intent/tweet?text=...` のURLエンコードリンクを生成
- **Bluesky**: コピペ用テキストを用意（`https://bsky.app/` から投稿）

### 8. Obsidian保存（weekly_trend記事のみ・週1回手動指示）

`週刊テックトレンド記事自動生成`ワークフロー（gravity-portal）が日曜22:00 JSTに実行されると、`scripts/generate-weekly-trend.mjs` が記事生成と同時に `antigravity-blog/src/obsidian/weekly-trends/weekly-trend-wNN.md` も自動生成してantigravity-blogにpushする。

ローカルの `H:/gravity` にはGitHub Actions側の変更は自動反映されないため、ユーザーから週1回「Obsidianに保存して」等の指示があったら以下を実行する。

#### 8a. antigravity-blogをpullして新規ノートを取得

```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity/projects/antigravity-blog pull
```

#### 8b. 同期スクリプト実行

```bash
pwsh -File h:/gravity/.agent/scripts/sync-weekly-trend-obsidian.ps1
```

このスクリプトが `antigravity-blog/src/obsidian/weekly-trends/` の未取り込みファイルを `docs/knowledge/projects/weekly-trends/` にコピーし、`INDEX.md` を更新し、gravityリポジトリへcommit（hgit.sh経由）まで行う。**pushは含まれないため、実行後に手動でpushすること：**

```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity push
```
