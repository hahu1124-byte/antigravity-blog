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

### 1. 記事コンテンツHTML作成

`src/articles/YYYYMM/記事スラッグ.html` に記事の本文HTMLフラグメントを作成する。
`<p>`, `<h2>`, `<ul>` 等の本文タグのみを書く（`<html>`・`<head>`・`<style>`は不要。head/OGP/広告/ナビはbuild.mjs側のテンプレートが付与する）。

### 2. blog-data.json 更新 ⚠️重要

`src/blog-data.json` の配列先頭に新しい記事のエントリを追加する。
このファイルはブログ一覧・ポータルTOPの「最新記事」・タグページ・関連記事選定すべての元データ。

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

### 3. ヒーロー画像（使う場合のみ）

記事本文にヒーロー画像を入れる場合：

1. 画像をWebP形式で `src/images/` に配置する。PNG/JPEGから変換する場合:
```bash
ffmpeg -i "元画像.png" -quality 85 "h:/gravity/projects/antigravity-blog/src/images/画像名.webp" -y
```
2. 記事ソース（`src/articles/`）の先頭に画像タグを追加:
```html
<p><img src="/blog/images/画像名.png" alt="説明"></p>
```
> **注意**: 記事ソースでは`.png`のまま書いてOK。`build.mjs`がビルド時に自動で`.webp`へ変換し、相対パスにも変換する。

ヒーロー画像を使わない記事は、次のステップでOGP画像がタイトルから自動生成される。

### 4. OGP画像の自動生成 ⚠️重要

**画像生成ツールでの手動作成は不要。** sharpによる自動生成CLI（LLM/外部API不使用、CJKフォント対応）を実行する:

// turbo
```bash
bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog node scripts/generate-og-images.mjs --slug YYYYMM/記事スラッグ
```

タイトル・タグからカード画像を動的生成して `src/images/og/YYYYMM/記事スラッグ.webp` に保存し、`src/blog-data.json`の該当エントリへ`ogImage`フィールドを自動追記する。
ヒーロー画像がある記事（ステップ3を使った記事）は`hasHeroImage()`判定で自動スキップされるため、このコマンドを実行しても上書きされない。

複数記事のOGP画像をまとめて生成したい場合は `--slug` の代わりに `--missing` を使う（新規かつヒーロー画像なし・OGP未生成の記事を一括処理）。

### 5. ローカルビルドで確認

// turbo
```bash
bash h:/gravity/.agent/scripts/hrun.sh h:/gravity/projects/antigravity-blog node build.mjs
```

出力の `🔗 内部リンクチェックOK` を確認する（リンク切れがあるとビルド失敗扱いになる）。
`::warning::重複の疑いがある記事ペア` が新記事について出た場合は、タイトル・タグの重複度が高いということなので見直しを検討する（他の既存警告は無視してよい）。

### 6. Git コミット＋プッシュ（hgit.sh 経由、個別実行）

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

### 7. GitHub Pagesデプロイ確認

プッシュ後、GitHub Actions完了を待ってからSNS投稿する（デプロイ前に投稿するとOGPカードが「Page not found」になる）。

確認URL: `https://www.antigravity-portal.com/blog/YYYYMM/記事スラッグ/`

### 8. SNS投稿（手動）

- **X**: `https://twitter.com/intent/tweet?text=...` のURLエンコードリンクを生成
- **Bluesky**: コピペ用テキストを用意（`https://bsky.app/` から投稿）

### 9. Obsidian保存（weekly_trend記事のみ・週1回手動指示）

`週刊テックトレンド記事自動生成`ワークフロー（gravity-portal）が日曜22:00 JSTに実行されると、`scripts/generate-weekly-trend.mjs` が記事生成と同時に `antigravity-blog/src/obsidian/weekly-trends/weekly-trend-wNN.md` も自動生成してantigravity-blogにpushする（2026-07-06〜対応）。

ローカルの `H:/gravity` にはGitHub Actions側の変更は自動反映されないため、ユーザーから週1回「Obsidianに保存して」等の指示があったら以下を実行する。

#### 9a. antigravity-blogをpullして新規ノートを取得

```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity/projects/antigravity-blog pull
```

#### 9b. 同期スクリプト実行

```bash
pwsh -File h:/gravity/.agent/scripts/sync-weekly-trend-obsidian.ps1
```

このスクリプトが `antigravity-blog/src/obsidian/weekly-trends/` の未取り込みファイルを `docs/knowledge/projects/weekly-trends/` にコピーし、`INDEX.md` を更新し、gravityリポジトリへcommit（hgit.sh経由）まで行う。**pushは含まれないため、実行後に手動でpushすること：**

```bash
bash h:/gravity/.agent/scripts/hgit.sh h:/gravity push
```

> [!NOTE]
> `src/obsidian/weekly-trends/` フォルダが存在しない場合（＝該当週のGitHub Actions実行がまだ新スクリプトを反映していない場合）は「同期元フォルダが存在しません」と出力してスキップする。その場合は該当週の記事を手動でMarkdown化する（旧手順は git履歴の本ファイル過去版を参照）。
