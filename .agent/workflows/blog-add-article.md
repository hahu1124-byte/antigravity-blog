---
description: ブログ記事の新規追加手順（記事HTML作成→OGP自動生成→ビルド確認→プッシュ）
---

# ブログ記事追加ワークフロー

新しいブログ記事を追加する際は、以下の手順に従う。

## 前提

- 記事のHTMLデータは `src/articles/YYYYMM/記事スラッグ.html` に格納（プロジェクトルート: `h:/gravity/projects/antigravity-blog`）
- 記事メタデータは `src/blog-data.json` に集約する。一覧ページ・タグページ・OGPメタタグ・関連記事・前後ナビは全てここと`src/articles/`から`node build.mjs`が自動生成する
- **`dist/` を手動編集・手動addする必要はない。** `node build.mjs`がsrc/配下から毎回全ページを再生成し、push後はGitHub Actionsの`deploy.yml`が同じビルドを実行してデプロイする
- `/blog/*` はGravity PortalのNext.js rewriteで `https://hahu1124-byte.github.io/antigravity-blog/blog/*` にプロキシ

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

### 2. ヒーロー画像／OGPアイキャッチ画像 ⚠️Antigravity最重要ルール

**【Antigravity（Gemini）での執筆時・絶対厳守】**
Antigravityでブログ記事を作成する際は、必ず `generate_image` ツール（Nanobanana）を用いて記事の世界観・テーマに合わせたハイクオリティなアイキャッチ（16:9）を生成する。

1. **Nanobanana画像生成**: `generate_image` ツールで画像を生成。
2. **WebP変換と配置**:
   ```bash
   ffmpeg -i "元画像.jpg" -quality 85 "h:/gravity/projects/antigravity-blog/src/images/画像名.webp" -y
   ```
3. **記事ソースへの連携**:
   * 記事HTMLの先頭に画像タグを追加:
     ```html
     <p><img src="/blog/images/画像名.png" alt="説明"></p>
     ```
   * **Frontmatterにも必ず `ogImage: 画像名.webp` を明記する**（サムネイル・OGP・Twitter CardがすべてNanobanana画像に統一される）。

### 3. OGP画像の自動生成（日次レポート等・画像生成不要な場合のみ）

Uber日次レポートなど定型記事で画像生成を行わない場合のみ、sharpによる自動生成CLI（`scripts/generate-og-images.mjs`）を実行する:

```bash
bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog node scripts/generate-og-images.mjs --slug YYYYMM/記事スラッグ
```

### 4. ローカルビルドで確認

// turbo
```bash
bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog node build.mjs
```

出力の `🔗 内部リンクチェックOK` を確認する（リンク切れがあるとビルド失敗扱いになる）。
`::warning::重複の疑いがある記事ペア` が新記事について出た場合は、タイトル・タグの重複度が高いということなので見直しを検討する（他の既存警告は無視してよい）。

### 5. Git コミット＋プッシュ（hgit.sh 経由、個別実行）

// turbo
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

`週刊テックトレンド記事自動生成`ワークフロー（gravity-portal）が日曜22:00 JSTに実行されると、`scripts/generate-weekly-trend.mjs` が記事生成と同時に `antigravity-blog/src/obsidian/weekly-trends/weekly-trend-wNN.md` も自動生成してantigravity-blogにpushする（2026-07-06〜対応）。

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

> [!NOTE]
> `src/obsidian/weekly-trends/` フォルダが存在しない場合（＝該当週のGitHub Actions実行がまだ新スクリプトを反映していない場合）は「同期元フォルダが存在しません」と出力してスキップする。その場合は該当週の記事を手動でMarkdown化する（旧手順は git履歴の本ファイル過去版を参照）。
