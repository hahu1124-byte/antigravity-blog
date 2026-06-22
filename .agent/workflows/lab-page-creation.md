---
description: LABシリーズ（ai-tools/ai-developers/ai-trends + まとめ記事）を新規追加する手順
---

# LABページ作成ワークフロー

## ⚠️ 教訓（2026-06-22）

v9ページ作成時に **カテゴリ一覧ページ（ai-tools/index.html 等）の更新を忘れた**。
このワークフローを必ず読んでから作業を開始すること。

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

調査観点：
- 主要ツールのアップデート（Claude Code / Cursor / Copilot / Devin 等）
- 注目OSSプロジェクト（Stars数、新機能）
- 業界トレンド（規制・価格・設計思想の変化）

---

## Step 2：4つの新規ファイル作成

以下を **並列** で作成する（全て独立）。

| ファイル | 種別 | 形式 |
|---------|------|------|
| `src/lab/ai-tools/v{N}/index.html` | 完全HTML | styles.css読み込み・テーマ切替・lab-header・lab-footer |
| `src/lab/ai-developers/v{N}/index.html` | 完全HTML | 同上 |
| `src/lab/ai-trends/v{N}/index.html` | 完全HTML | 同上 |
| `src/articles/YYYYMM/YYYYMMDD_ai_lab_update_v{N+1}.html` | body-only HTMLフラグメント | `<p>`, `<h2>`, `<ul>`, `<table>` のみ。`<html>/<head>` 不要 |

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
        <span class="trend-number">0{N}</span>
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

---

## Step 4：LABハブ・メタデータ更新

| ファイル | 変更内容 |
|---------|---------|
| `src/lab/index.html` | バッジ「全N-1回」→「全N回」、ツール数も更新 |
| `src/blog-data.json` | 配列先頭にまとめ記事エントリを追加 |
| `src/static-pages/updates/updates-data.json` | 配列先頭に更新エントリを追加 |

---

## Step 5：ビルド

```bash
bash /h/gravity/.agent/scripts/hrun.sh /h/gravity/projects/antigravity-blog node build.mjs
```

---

## Step 6：Obsidian保存

1. `docs/knowledge/projects/lab-ai-tools-v{N}.md` を作成（レポートサマリー）
2. `docs/knowledge/INDEX.md` にエントリを追加

---

## Step 7：Git コミット＋プッシュ（AB）

```bash
bash /h/gravity/.agent/scripts/hgit.sh /h/gravity/projects/antigravity-blog add src/lab/ src/articles/ src/blog-data.json src/static-pages/updates/updates-data.json
bash /h/gravity/.agent/scripts/hgit.sh /h/gravity/projects/antigravity-blog commit -m "add: LAB第{N+1}回公開 — {タイトル}"
bash /h/gravity/.agent/scripts/hgit.sh /h/gravity/projects/antigravity-blog push origin main
```

## Step 8：gravity リポジトリコミット

```bash
bash /h/gravity/.agent/scripts/hgit.sh /h/gravity add docs/knowledge/projects/lab-ai-tools-v{N}.md docs/knowledge/INDEX.md
bash /h/gravity/.agent/scripts/hgit.sh /h/gravity commit -m "save: LAB第{N+1}回レポートをObsidianに保存"
```
