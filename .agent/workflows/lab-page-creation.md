---
description: LABシリーズ（ai-tools/ai-developers/ai-trends + まとめ記事）を新規追加する手順
---

# LABページ作成ワークフロー

---

## バージョン法則

- LABページ版数: `v{N}`
- まとめ記事の「回」: `第{N+1}回`
- まとめ記事ファイル名: `YYYYMMDD_ai_lab_update_v{N+1}.html`

---

## 事前調査（必須）

作業開始前に最新版を確認する。

```
最新LABページ版数の確認: src/lab/ai-tools/ 内の最大バージョン番号
最新まとめ記事の確認: src/articles/ 内の最新 ai_lab_update_*.html
```

---

## Step 1：コンテンツ調査

前回LABページ公開日以降のAI開発ニュースを調査する。

基盤モデル自体の動向とツールのアップデートは別の観点として、両方を調べる（ツールだけ調べると新モデルのリリースを見落とす）。

調査観点：
- **基盤モデル自体の動向（最重要・見落としやすい）**: 各社フロンティアモデルの新リリース・規制解除／発動・ベンチマーク更新（Anthropic Claude / OpenAI GPT / xAI Grok / Google Gemini / Moonshot Kimi 等）
- 主要ツールのアップデート（Claude Code / Cursor / Copilot / Devin 等）
- 注目OSSプロジェクト（Stars数、新機能）
- 業界トレンド（規制・価格・設計思想の変化）

---

## Step 2：4つの新規ファイル作成

以下を **並列** で作成する（全て独立）。

| ファイル | 種別 | 形式 |
|---------|------|------|
| `src/lab/ai-tools/v{N}/index.html` | 完全HTML | styles.css読み込み（相対パス `../../styles.css`。GitHub Pages の絶対 URL にしない）・テーマ切替・lab-header・lab-footer |
| `src/lab/ai-developers/v{N}/index.html` | 完全HTML | 同上 |
| `src/lab/ai-trends/v{N}/index.html` | 完全HTML | 同上 |
| `src/articles/YYYYMM/YYYYMMDD_ai_lab_update_v{N+1}.html` | 本文のHTMLフラグメント | 先頭に blog-add-article §1 と同じ Frontmatter コメント（title・`date: YYYY-MM-DD HH:mm`・excerpt・tags）を必ず付け、その後に `<p>`, `<h2>`, `<ul>`, `<table>` の本文。`<html>/<head>` 不要 |

参照テンプレート（前回版）：
- `src/lab/ai-tools/v{N-1}/index.html`
- `src/articles/YYYYMM/（前回まとめ記事）.html`

---

## Step 3：カテゴリ一覧ページ更新 ← ★最も忘れやすい★

**3ファイル全て**の先頭に新エントリを追加する。

### src/lab/ai-tools/index.html

```html
<a href="/lab/ai-tools/v{N}/" class="tool-card" style="text-decoration:none;display:block">
    <div class="tool-card-header">
        <span class="tool-card-icon">🆕</span>
        <div class="tool-card-info">
            <h3>第{N}回 — {サブタイトル}</h3>
            <span class="tool-maker">{YYYY年M月D日}</span>
        </div>
    </div>
    <div class="tool-card-body"><p>{説明}</p></div>
    <div class="tool-card-badges">
        <span class="badge badge-hot">🔥 最新</span>
        <span class="badge badge-type">{キーワード}</span>
    </div>
</a>
```

### src/lab/ai-developers/index.html

```html
<a href="/lab/ai-developers/v{N}/" class="dev-card" style="text-decoration:none;display:block">
    <div class="dev-card-header">
        <div class="dev-avatar">🆕</div>
        <div class="dev-info">
            <h3>第{N}回 — {サブタイトル}</h3>
            <span class="dev-role">{YYYY年M月D日}</span>
        </div>
    </div>
    <p style="font-size:0.88rem;color:var(--lab-text-muted)">{説明}</p>
    <div class="tool-card-badges" style="margin-top:0.75rem">
        <span class="badge badge-hot">🔥 最新</span>
        <span class="badge badge-type">{キーワード}</span>
    </div>
</a>
```

### src/lab/ai-trends/index.html

```html
<a href="/lab/ai-trends/v{N}/" class="trend-card" style="text-decoration:none;display:block">
    <div class="trend-card-header">
        <span class="trend-number">{NN}</span><!-- N を 2 桁ゼロ埋め（09, 12） -->
        <div class="trend-info">
            <h3>第{N}回 — {サブタイトル}</h3>
            <span class="trend-subtitle">{YYYY年M月D日}</span>
        </div>
    </div>
    <div class="trend-card-body"><p>{説明}</p></div>
    <div class="tool-card-badges" style="margin-top:0.75rem">
        <span class="badge badge-hot">🔥 最新</span>
        <span class="badge badge-type">{キーワード}</span>
    </div>
</a>
```

**追加後：旧エントリのアイコン `🆕→📋`、`badge-hot` バッジを削除すること。**

### 各 v{N} ページからまとめ記事へのリンク

Step 2 で作った 3 ページ（ai-tools・ai-developers・ai-trends の v{N}）それぞれの、本文末尾（まとめセクションの最後）とフッターナビの先頭に、まとめ記事 `/blog/YYYYMM/YYYYMMDD_ai_lab_update_v{N+1}/` へのリンクを足す。文言は前回版（v{N-1}）のページにそろえる。

---

## Step 4：LABハブ・メタデータ更新

| ファイル | 変更内容 |
|---------|---------|
| `src/lab/index.html` | バッジ「全N-1回」→「全N回」、ツール数も更新 |
| `src/static-pages/updates/updates-data.json` | 配列先頭に更新エントリを追加 |

---

## Step 5：ビルド

```bash
bash /h/gravity/.agent/scripts/hrun.sh /h/gravity/projects/antigravity-blog node build.mjs
```

開発サーバーをバックグラウンドで起動して確認用 URL を提示し、まとめ記事と 3 ページの仕上がりをユーザーに見てもらう。**ユーザーの明示的な承認を得るまで Step 7 の push に進まない**（ブログ記事の公開なので blog-add-article §4・§5 と同じ扱い）。

```bash
bash /h/gravity/.agent/scripts/hrun.sh /h/gravity/projects/antigravity-blog --bg npx serve dist -p 4000
```

確認が済んだら `hrun.sh --list` で名前を確かめて `--stop` で止める。

---

## Step 6：Obsidian保存

1. `docs/knowledge/projects/lab-ai-tools-history.md` に第{N+1}回（v{N}）の節を追記（レポートサマリー）
2. `docs/knowledge/INDEX.md` の lab-ai-tools-history の説明（対象の版の範囲）を更新

---

## Step 7：Git コミット＋プッシュ（AB）

```bash
bash /h/gravity/.agent/scripts/hgit.sh /h/gravity/projects/antigravity-blog add src/lab/ src/articles/ src/blog-data.json src/static-pages/updates/updates-data.json
bash /h/gravity/.agent/scripts/hgit.sh /h/gravity/projects/antigravity-blog commit -m "add: LAB第{N+1}回公開 — {タイトル}"
bash /h/gravity/.agent/scripts/hgit.sh /h/gravity/projects/antigravity-blog push origin main
```

## Step 8：gravity リポジトリコミット

```bash
bash /h/gravity/.agent/scripts/hgit.sh /h/gravity add docs/knowledge/projects/lab-ai-tools-history.md docs/knowledge/INDEX.md
bash /h/gravity/.agent/scripts/hgit.sh /h/gravity commit -m "save: LAB第{N+1}回レポートをObsidianに保存"
```
