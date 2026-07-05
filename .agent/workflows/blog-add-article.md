---
description: ブログ記事の新規追加手順（記事HTML作成→一覧ページ更新→プッシュ）
---

# ブログ記事追加ワークフロー

新しいブログ記事を追加する際は、以下の手順に従う。

## 前提

- 記事のHTMLデータは `src/articles/YYYYMM/` に格納（プロジェクトルート: `h:/gravity/projects/antigravity-blog`）
- 最終的な公開ページは `dist/blog/YYYYMM/記事スラッグ/index.html` に配置
- ブログ一覧ページは `dist/blog/index.html`（静的HTML、手動更新が必要）
- `/blog/*` はGravity PortalのNext.js rewriteで `https://hahu1124-byte.github.io/antigravity-blog/blog/*` にプロキシ
- OGP画像は `dist/blog/images/` に配置

## 手順

### 1. 記事コンテンツHTML作成

`src/articles/YYYYMM/` に記事の本文HTMLフラグメントを作成する。
これはBlogger投稿用フォーマット（`<p>`, `<h2>`, `<ul>` 等のHTMLタグのみ、`<html>`や`<head>`は不要）。

### 2. OGP画像の配置 ⚠️重要

**`build.mjs` は記事内の画像拡張子を `.png`/`.jpg` → `.webp` に自動変換する。**
そのため画像は **WebP 形式で `src/images/` に配置** する必要がある。

手順:
1. OGP画像を生成（generate_image ツール等）
2. PNG → WebP に変換して `src/images/` に配置:

```bash
ffmpeg -i "元画像.png" -quality 85 "h:/gravity/projects/antigravity-blog/src/images/画像名.webp" -y
```

3. 記事ソース（`src/articles/`）の先頭に画像タグを追加:

```html
<p><img src="/blog/images/画像名.png" alt="説明"></p>
```

> **注意**: 記事ソースでは `.png` で書いてOK。`build.mjs` がビルド時に自動で `.webp` に変換し、相対パスにも変換する。

### 3. 公開用ページ作成

`dist/blog/YYYYMM/記事スラッグ/index.html` に完全なHTMLページを作成する。

テンプレートとして `dist/blog/202603/20260311_ai_lab_update_v2/index.html` を参照。
以下の要素を必ず含める：

- `<head>`: OGPメタタグ、Twitter Cardメタタグ、styles.css読み込み
- テーマ切替ボタン + スクリプト
- パンくずナビゲーション（トップ → ブログ → 記事タイトル）
- 記事ヘッダー（日付、タグ、タイトル）
- 記事本文（`src/articles/` のHTMLをそのまま埋め込み）
- 忍者AdMaxの広告スロット（本文中 + 記事後）
- Amazon検索ボックス + アフィリエイトリンク（tag=gravity063-22）
- 前後の記事ナビゲーション
- 広告の課金チェックスクリプト（/api/subscription-status）

### 4. ブログ一覧ページ更新 ⚠️重要

`dist/blog/index.html` を編集して新しい記事カードを追加する。

**必ず行うこと：**
1. 記事カードを日付順の正しい位置に挿入（最新が先頭）
2. `data-tags` 属性に適切なタグをカンマ区切りで設定
3. `data-index` を全カードで連番に更新
4. ヘッダーのタグフィルターボタンのカウントを更新（「すべて」の件数を+1、該当タグの件数を+1）
5. 新しいタグカテゴリがあれば、フィルターボタンを追加

記事カードのHTMLテンプレート：
```html
<a href="YYYYMM/記事スラッグ/" class="article-card" data-tags="タグ1,タグ2" data-index="0">
    <div class="card-header">
        <time class="date">YYYY-MM-DD</time>
        <div class="tags">
            <span class="tag">タグ1</span><span class="tag">タグ2</span>
        </div>
    </div>
    <h2 class="card-title">絵文字 タイトル</h2>
    <p class="card-excerpt">記事の概要（120文字程度）</p>
</a>
```

### 5. blog-data.json 更新 ⚠️重要

`src/blog-data.json` の配列先頭に新しい記事のエントリを追加する。
このファイルはポータルTOPページの「最新記事」セクションのデータソース。
**更新しないとポータルTOPに記事が表示されない。**

エントリのフォーマット:
```json
{
  "slug": "YYYYMM/記事スラッグ",
  "title": "絵文字 タイトル",
  "date": "YYYY-MM-DD",
  "excerpt": "記事の概要（120文字程度）",
  "tags": ["タグ1", "タグ2"]
}
```

追加後、distにもコピーする:
```
cp src/blog-data.json dist/blog-data.json
```

### 6. 前の記事の「次の記事」ナビ更新

直前の記事の `dist/blog/YYYYMM/前記事スラッグ/index.html` の `post-nav-next` セクションを更新して、新しい記事へのリンクを追加する。

### 7. Git コミット＋プッシュ（hgit.sh 経由、個別実行）

// turbo
```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity/projects/antigravity-blog add -f dist/ src/
```

```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity/projects/antigravity-blog commit -m "blog: タイトル"
```

```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity/projects/antigravity-blog push
```

> [!CAUTION]
> **`&&` チェーンは絶対禁止。** 必ず個別の `run_command` に分割する。
> `dist/` はgitignore対象のため `-f` で強制追加する。

### 8. GitHub Pagesデプロイ確認

プッシュ後、GitHub Actions完了を待ってからSNS投稿する（デプロイ前に投稿するとOGPカードが「Page not found」になる）。

確認URL: `https://www.antigravity-portal.com/blog/YYYYMM/記事スラッグ/`

### 9. SNS投稿（手動）

- **X**: `https://twitter.com/intent/tweet?text=...` のURLエンコードリンクを生成
- **Bluesky**: コピペ用テキストを用意（`https://bsky.app/` から投稿）

### 10. Obsidian保存（weekly_trend記事のみ・週1回手動指示）

`週刊テックトレンド記事自動生成`ワークフロー（gravity-portal）が日曜22:00 JSTに実行されると、`scripts/generate-weekly-trend.mjs` が記事生成と同時に `antigravity-blog/src/obsidian/weekly-trends/weekly-trend-wNN.md` も自動生成してantigravity-blogにpushする（2026-07-06〜対応）。

ローカルの `H:/gravity` にはGitHub Actions側の変更は自動反映されないため、ユーザーから週1回「Obsidianに保存して」等の指示があったら以下を実行する。

#### 10a. antigravity-blogをpullして新規ノートを取得

```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity/projects/antigravity-blog pull
```

#### 10b. 同期スクリプト実行

```bash
pwsh -File h:/gravity/.agent/scripts/sync-weekly-trend-obsidian.ps1
```

このスクリプトが `antigravity-blog/src/obsidian/weekly-trends/` の未取り込みファイルを `docs/knowledge/projects/weekly-trends/` にコピーし、`INDEX.md` を更新し、gravityリポジトリへcommit（hgit.sh経由）まで行う。**pushは含まれないため、実行後に手動でpushすること：**

```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity push
```

> [!NOTE]
> `src/obsidian/weekly-trends/` フォルダが存在しない場合（＝該当週のGitHub Actions実行がまだ新スクリプトを反映していない場合）は「同期元フォルダが存在しません」と出力してスキップする。その場合は該当週の記事を手動でMarkdown化する（旧手順は git履歴の本ファイル過去版を参照）。
