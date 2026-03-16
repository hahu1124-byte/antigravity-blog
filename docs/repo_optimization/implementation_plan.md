# リポジトリ最適化計画 — antigravity-blog & gravity-portal

## 概要

両リポジトリの現状を調査し、**UIを一切変更せず**に容量削減・パフォーマンス向上を行う。

## 現状分析

### antigravity-blog

| 項目 | 値 |
|---|---|
| Git管理ファイル数 | 175件 |
| **src/images（PNG）** | **45枚 / 約32MB** ← 最大の削減対象 |
| dist内HTMLファイル数 | 2,222件（machine-db 1,069件含む） |
| src/HTML | 約896KB |
| src/JSON | 約872KB |
| src/CSS | 約192KB |
| src/JS | 約564KB |
| 不要ファイル(.bak等) | 0件 |

**最大の画像（上位3件）**:
- `Gemini_Generated_Image_pnzp5ppnzp5ppnzp.png` → **2.5MB**
- `Gemini_Uber_217_Tuesday_Recovery.png` → **862KB**
- `Gemini_Uber_213_Efficiency.png` → **861KB**

### gravity-portal

| 項目 | 値 |
|---|---|
| Git管理ファイル数 | 206件 |
| public/ | 約4.6MB |
| OGP画像（PNG） | 6枚 / 約2.8MB |
| PWAアイコン（PNG） | 2枚 / 約980KB |
| node_modules/ | 439MB（gitignore済） |
| .next/ | 197MB（gitignore済） |

---

## 提案する最適化（3フェーズ）

### Phase 1: 画像のWebP変換（効果: 最大）

> [!IMPORTANT]
> 推定削減量: **32MB → 約8〜10MB（60〜70%削減）**

#### 対象: antigravity-blog/src/images/ の全45枚のPNG

**方針**:
1. `sharp` (Node.js) を使ったWebP変換スクリプトを作成
2. 品質80でWebPに変換（OGP用途なので画質は十分）
3. **build.mjs を修正**: `src="/blog/images/xxx.png"` → `src="/blog/images/xxx.webp"` に自動変換
4. OGPメタタグも `.webp` に変更
5. 元のPNGファイルは削除

> [!WARNING]
> **OGP互換性の注意**: 一部のSNS（特にBlueskyのリンクカード）はWebPに対応していない可能性があります。そのため **OGP画像だけはPNGを残す** or フォールバック用のPNGを1枚だけ残すという選択肢もあります。ただし、X/BlueskyともにWebP対応済みの報告が多いため、WebP統一でも問題ない可能性が高いです。

#### 対象: gravity-portal/public/ のOGP画像6枚 + PWAアイコン2枚

**方針**:
1. OGP画像（og-image.png等）をWebPに変換
2. PWAアイコンは **PNGのまま維持**（PWA仕様でPNG推奨）
3. Next.jsの `<meta>` タグ内のパスを更新

---

### Phase 2: 不要ファイル・コードの整理（効果: 中）

#### [antigravity-blog]

##### ファイル名の統一
- 画像ファイル名が `Gemini_Generated_Image_pnzp5ppnzp5ppnzp.png` のように**AI生成時のデフォルト名のまま**残っているケースあり
- スラッグベースのリネーム（例: `uber_0212_consistency.webp`）で管理しやすくなるが、**記事HTMLとの参照整合** があるため副作用が大きい。今回は見送り推奨

##### dist/machine-db の最適化
- machine-dbは **1,069件の静的HTML** を生成している
- 各ファイルにインラインCSSが埋め込まれているため、共通CSSに外出し可能（ただしこれはUI変更ではなくソース整理）
- **即効性は低い**ため今回は対象外推奨

#### [gravity-portal]

##### public/data/ の確認
- `public/data/` 内に不要なキャッシュデータがあるかを確認
- `machines.json` が大きい場合、gzip圧縮を検討

---

### Phase 3: ビルド最適化（効果: 小〜中）

#### CSS/JS最適化
- **blog:** `styles.css` をminify化（192KB → 推定150KB）
- **blog:** `build.mjs` で生成されるHTMLのminify化（空白・改行削除）
- **portal:** Next.jsの本番ビルドは既にminify済みのため不要

#### Git履歴の最適化
- 画像の削除・変換後に `git gc --aggressive` を実行
- 大きなPNGファイルがGit履歴に残るため、 `git filter-branch` や `BFG Repo-Cleaner` での履歴書き換えも検討可能（破壊的変更のため慎重に）

---

## 優先順位と工数見積もり

| Phase | 内容 | 推定削減量 | 工数 | リスク |
|---|---|---|---|---|
| **1** | **画像WebP変換** | **約22〜24MB減** | 中（1時間） | OGP互換性の確認必要 |
| 2 | 不要ファイル整理 | 僅か | 小（15分） | 低 |
| 3 | CSS/JS minify | 約50KB減 | 小（30分） | 低 |
| 3b | Git履歴整理 | リポサイズ大幅減 | 中（30分） | **高（force push必要）** |

## 実施推奨

> [!TIP]
> **Phase 1（画像WebP変換）だけで全効果の90%以上を得られます。**
> 32MB → 約8MBで、GitHub Pages配信の帯域・速度も改善。
> Phase 2/3は任意の追加最適化です。

---

## 検証計画

### 自動検証
1. WebP変換スクリプト実行後: ファイルサイズ比較ログ出力
2. `node build.mjs` が正常完了すること
3. OGPメタタグが正しいパスを参照していること（grep検証）

### 手動検証（ユーザー確認）
1. `npx http-server dist/ -p 4000` でローカル起動
2. 以下のURLで画像が正しく表示されることを確認:
   - ブログ記事ページ（v3/v4/v5）のヒーロー画像
   - ブログ一覧ページ
3. push後にSNS共有でOGP画像が表示されることを確認
