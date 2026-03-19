# Uber配達デイリーレポート — 自動投稿システム実装計画

## 概要

毎朝GitHub Actionsで名古屋のUber配達に役立つ情報を収集し、ブログ記事として自動生成・公開するシステム。
**コスト: $0**（全て無料API/RSS + GitHub Actions + GitHub Pages）。

## 方針

- **LLM API 不使用** — キーワードマッチングによるルールベースフィルタリング
- **GitHub Actions** で毎朝自動実行（JST 6:00 頃）
- `antigravity-blog` に記事生成 → git push → GitHub Pages 自動デプロイ
- データ取得不可時は各セクションで適切なフォールバック表示

---

## 記事構成（全10セクション）

| # | セクション | データソース | フォールバック |
|---|-----------|-------------|---------------|
| 1 | 🌤️ 天気予報（当日 大・翌日翌々日 小） | 気象庁API | 「取得できませんでした」 |
| 2 | ⏰ 時間帯別天気（降水確率） | 気象庁API（T00_06, T06_12, T12_18, T18_24） | 表示省略 |
| 3 | 🚗 道路交通情報 | 国交省 道路規制情報 or JARTIC | 「特に無し」 |
| 4 | 📰 配達に影響しそうなニュース | Google News RSS + NHK News RSS | 「特に無し」 |
| 5 | ⛽ ガソリン価格 | gogo.gs（セルフ甚目寺SS）→ 名古屋平均 | 経産省週次データ |
| 6 | 🎯 ピーク予測 | 天気×曜日×イベントのルールベース判定 | 「データ不足」 |
| 7 | 📍 名古屋イベント情報 | Walker Plus RSS or Nagoya市公式 | 「特に無し」 |
| 8 | 🌡️ 体感指数・配達アドバイス | 気象庁API（気温+天気）のルール適用 | 省略 |
| 9 | 📈 曜日別傾向メモ | 静的ルール（JSON定義） | 常に表示 |
| 10 | 💬 今日の一言 | 天気+曜日からテンプレ生成 | 常に表示 |

---

## ユーザー確認事項

> [!IMPORTANT]
> ### 確認が必要な点
>
> 1. **公開先**: ブログ記事として `antigravity-blog`（GitHub Pages）に配置でOK？
>    - 記事パス案: `/blog/uber-daily/YYYYMMDD/`
>    - ブログ一覧に混ぜる？ or 専用ページを別途設ける？
>
> 2. **実行時刻**: 毎朝 JST 6:00 でOK？（GitHub Actions の cron は UTC なので 21:00 UTC）
>
> 3. **gogo.gs スクレイピング**: 利用規約上グレーゾーン。代替案として **経産省の週次データ**（精度△）or **ユーザー手動入力**（別JSON管理）もあり。どうする？
>
> 4. **道路交通情報**: 自動取得が最も不安定なセクション。JARTIC/国交省のWebページ構造に依存するため、変更時に壊れる可能性あり。初期は「情報なし」フォールバック多め、安定したら充実させる方針でOK？
>
> 5. **タイトル生成ロジック**: LLMなしだと天気ベースのテンプレートになる  
>    例: `20260319 ☀️ 配達日和` / `20260319 🌧️ 雨の日は需要UP` / `20260319 🌤️ まずまずの1日`  
>    これでOK？

---

## 提案する変更

### データ収集・記事生成スクリプト

#### [NEW] [generate-uber-daily.mjs](file:///h:/gravity/antigravity-blog/scripts/generate-uber-daily.mjs)

メイン実行スクリプト（約400-500行）。以下の処理を順次実行：

1. **天気データ取得** — `https://weather.tsukumijima.net/api/forecast/city/230010`
2. **ニュースRSS取得** — NHK主要ニュース RSS + Google News 名古屋関連
   - キーワードフィルタ: `交通規制|通行止め|台風|地震|イベント|マラソン|大会|WBC|五輪|祭り`
   - 名古屋/愛知/東海 をキーワードに含むもの優先
3. **ガソリン価格取得** — gogo.gs のセルフ甚目寺SSページ or 名古屋平均ページをfetch
4. **イベント情報取得** — Walker Plus 名古屋 RSS or スクレイピング
5. **ピーク予測** — ルールエンジン（JSON設定ファイル）
6. **HTML生成** — テンプレートにデータを注入
7. **ファイル出力** — `dist/blog/uber-daily/YYYYMMDD/index.html`
8. **blog-data.json 更新** — 記事エントリ追加
9. **ブログ一覧 更新** — `dist/blog/index.html` にカード追加

#### [NEW] [uber-daily-config.json](file:///h:/gravity/antigravity-blog/scripts/uber-daily-config.json)

設定ファイル（ルールエンジン）：

```json
{
  "weather": {
    "cityCode": "230010",
    "apiUrl": "https://weather.tsukumijima.net/api/forecast/city/230010"
  },
  "gasStation": {
    "primaryUrl": "https://gogo.gs/shop/XXXXXXXXXX",
    "fallbackUrl": "https://gogo.gs/ranking/23/23100/"
  },
  "news": {
    "sources": [
      "https://www.nhk.or.jp/rss/news/cat0.xml",
      "https://news.google.com/rss/search?q=名古屋+OR+愛知+交通+OR+イベント&hl=ja&gl=JP&ceid=JP:ja"
    ],
    "keywords": ["交通規制", "通行止め", "台風", "地震", "マラソン", "大会", "祭り", "名古屋", "愛知"]
  },
  "peakRules": {
    "rain": { "multiplier": 1.5, "message": "🌧️ 雨の日は注文増の傾向" },
    "friday_night": { "multiplier": 1.3, "message": "🍻 金曜夜は需要UP" },
    "weekend_lunch": { "multiplier": 1.2, "message": "🍽️ 週末ランチは稼ぎ時" }
  },
  "dayOfWeekTips": {
    "monday": "月曜ランチは企業需要多め",
    "tuesday": "火曜は比較的穏やか",
    "wednesday": "水曜はノー残業デーで夜も出る",
    "thursday": "木曜は週末前の谷間",
    "friday": "金曜夜は最大ピーク帯",
    "saturday": "土曜はランチ〜夕方が狙い目",
    "sunday": "日曜夜は注文増の傾向"
  },
  "titleTemplates": {
    "sunny": "☀️ 配達日和",
    "cloudy": "🌤️ まずまずの1日",
    "rainy": "🌧️ 雨の日は需要UP",
    "storm": "⛈️ 荒天注意！安全第一",
    "hot": "🥵 暑さ対策必須",
    "cold": "🥶 防寒して出発"
  }
}
```

#### [NEW] [uber-daily-template.html](file:///h:/gravity/antigravity-blog/scripts/uber-daily-template.html)

記事HTMLテンプレート。既存ブログ記事と同じレイアウト（パンくず、テーマ切替、広告スロット等を含む）。
プレースホルダー `{{WEATHER_TODAY}}`, `{{NEWS_SECTION}}`, `{{GAS_PRICES}}` 等を使用。

---

### GitHub Actions ワークフロー

#### [NEW] [uber-daily-report.yml](file:///h:/gravity/antigravity-blog/.github/workflows/uber-daily-report.yml)

```yaml
name: Generate Uber Daily Report
on:
  schedule:
    - cron: '0 21 * * *'   # JST 6:00
  workflow_dispatch:         # 手動トリガーも可能
permissions:
  contents: write
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: node scripts/generate-uber-daily.mjs
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -f dist/ src/
          git commit -m "🚴 Uber daily: $(date +%Y%m%d)" || echo "No changes"
          git push
```

> push 後、既存の `deploy.yml`（on: push → main）が自動発動して GitHub Pages にデプロイされる。

---

### ブログ統合

#### [MODIFY] [index.html](file:///h:/gravity/antigravity-blog/dist/blog/index.html)

- スクリプトで動的にカード追加（`generate-uber-daily.mjs` が直接編集）
- 「Uber配達」タグをフィルターボタンに追加

#### [MODIFY] [blog-data.json](file:///h:/gravity/antigravity-blog/src/blog-data.json)

- スクリプトが配列先頭にエントリを自動追加

---

## 検証計画

### 自動テスト

```bash
# ローカルで記事生成テスト（ドライラン）
cd h:/gravity/antigravity-blog
node scripts/generate-uber-daily.mjs --dry-run

# 出力ファイルの存在確認
ls dist/blog/uber-daily/$(date +%Y%m%d)/index.html

# HTML構造チェック（パンくず、OGP、広告スロットの存在確認）
grep -c "breadcrumb\|og:title\|admax" dist/blog/uber-daily/$(date +%Y%m%d)/index.html
```

### 手動検証

1. `--dry-run` で生成されたHTMLをブラウザで開いて表示確認
2. 各データソースが取得不可の場合のフォールバック表示を確認
3. GitHub Actions の `workflow_dispatch` で手動実行して動作確認
4. デプロイ後 `https://www.antigravity-portal.com/blog/uber-daily/YYYYMMDD/` でアクセス確認
