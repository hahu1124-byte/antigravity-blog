---
name: antigravity-blog-overview
description: antigravity-blog プロジェクトの概要・技術スタック・フォルダ構造・ビルド手順
---

# Antigravity Blog — プロジェクト概要

## プロジェクト概要

- **リポジトリ**: `h:/gravity/projects/antigravity-blog`
- **種別**: 静的サイトジェネレーター（Node.js カスタムビルド）
- **公開先**: GitHub Pages（`https://www.antigravity-portal.com`）
- **デプロイ**: `main` ブランチへの push → GitHub Actions が自動ビルド＆デプロイ
- **目的**: ブログ記事・静的ツール・Uber日次レポートの配信

> [!IMPORTANT]
> **gravity-portal（Vercel）との役割分担:**
> - ここ（antigravity-blog）= **静的コンテンツ**（記事・ツール・ゲーム）
> - gravity-portal = **インタラクティブ機能**（認証・決済・API）
> - antigravity-blog への `git push` は無料（GitHub Pages）

---

## 技術スタック

| 技術 | 用途 |
|------|------|
| Node.js（ESM） | ビルドスクリプト |
| `esbuild` | JS ミニファイ（devDependency） |
| `sharp` | 画像変換 PNG→WebP（devDependency） |
| `xlsx` | ガソリン価格 xlsx 読み取り（dependency） |
| GitHub Actions | 自動デプロイ・Uber日次レポート生成 |

---

## フォルダ構造

```
antigravity-blog/
├── build.mjs                  # メインビルドスクリプト（HTML 生成）
├── package.json               # npm スクリプト・依存関係
├── src/
│   ├── blog-data.json         # ブログ記事メタデータ一覧
│   ├── articles/              # 記事本文 HTML（slug.html）
│   ├── images/                # ブログ用画像（WebP推奨）
│   ├── styles.css             # 共通スタイル
│   ├── scripts/               # クライアント側 JS
│   ├── static-pages/          # 更新履歴等の静的ページ
│   │   └── updates/
│   │       └── updates-data.json  # 更新履歴（GP Load 時に反映）
│   ├── convergence/           # 収束計算ツール
│   ├── simulator/             # シミュレーター
│   ├── machine-db/            # 機種データベース
│   ├── idle-game/             # パチンコアイドルゲーム（PI）
│   ├── pachinko-sim/          # パチンコシミュレーター
│   ├── lab/                   # LABページ（AI開発ツール比較等）
│   ├── quiz/                  # クイズ
│   ├── general-quiz/          # 一般クイズ
│   ├── bgm-maker/             # BGMメーカー
│   ├── image-tools/           # 画像ツール
│   ├── qr-tools/              # QRコードツール
│   ├── pdf-tools/             # PDFツール
│   └── data/                  # 静的データファイル
├── dist/                      # ビルド成果物（.gitignore、GitHub Actions が生成）
├── scripts/
│   ├── generate-uber-daily.mjs  # Uber日次レポート生成
│   ├── uber-daily-config.json   # Uber日次レポート設定
│   ├── gas-price-cache.json     # ガソリン価格キャッシュ
│   ├── update-gas-price.cjs     # ガソリン価格更新（経産省xlsx→キャッシュ）
│   ├── convert-to-webp.mjs      # PNG/JPG → WebP 変換（sharp使用）
│   ├── generate-feed.mjs        # RSS/Atomフィード生成
│   ├── post-to-bluesky.mjs      # Bluesky 自動投稿
│   └── post-to-x.mjs            # X（Twitter）自動投稿
├── .github/
│   └── workflows/
│       ├── deploy.yml           # main push → GitHub Pages デプロイ
│       ├── uber-daily-report.yml  # 毎朝 JST 6:00 自動実行
│       └── bluesky-auto-post.yml  # Bluesky 自動投稿
└── posted-items.json            # 投稿済み記事トラッキング
```

---

## ビルドコマンド

```bash
# 通常ビルド
npm run build
# = node build.mjs

# 画像変換（PNG/JPG → WebP）
node scripts/convert-to-webp.mjs

# Uber日次レポート手動生成
node scripts/generate-uber-daily.mjs

# dry-run（ファイル出力なし）
node scripts/generate-uber-daily.mjs --dry-run

# ガソリン価格更新
node scripts/update-gas-price.cjs
```

---

## GitHub Actions ワークフロー

| ファイル | トリガー | 内容 |
|---------|---------|------|
| `deploy.yml` | `main` push / 手動 | ビルド → GitHub Pages デプロイ |
| `uber-daily-report.yml` | 毎朝 JST 6:00（UTC 21:00） | Uber日次レポート生成・commit・push |
| `bluesky-auto-post.yml` | スケジュール / 手動 | 新記事を Bluesky に自動投稿 |

---

## 環境変数（GitHub Actions Secrets）

| 変数名 | 用途 |
|--------|------|
| `BLUESKY_IDENTIFIER` | Bluesky ログイン ID |
| `BLUESKY_APP_PASSWORD` | Bluesky アプリパスワード |
| `X_API_KEY` 等 | X（Twitter）API キー群 |

> [!NOTE]
> ローカルで Bluesky 投稿やX投稿スクリプトを実行する場合は `.env` が必要だが、
> 通常の記事作成・ビルド作業では環境変数不要。

---

## 重要ルール

- **`git push` はエージェントが実行してよい**（GitHub Pages = コスト不要）
- **`dist/` は gitignore**。`git add -A` ではなく `git add src/` を使う
- **build.mjs を直接編集する場合は行数が多い**（~500行）。offset/limit で分割して読むこと
- `updates-data.json` は GP Load 時にハンドオーバーデータが自動で書き込まれる（直接編集注意）
