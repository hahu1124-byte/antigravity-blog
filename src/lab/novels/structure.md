---
title: 現在のフォルダ構成
---

## 現在のフォルダ構成

<!-- このファイルは h:/gravity/.agent/scripts/novels/update-novels-structure.ps1 が自動生成します。
     直接編集しても次回のスクリプト実行で上書き消失します。
     ファイル説明の追加・修正は同スクリプトの $fileDescriptions マップに対して行ってください。 -->

```
novels/
├── world-setting/              # 共通世界観「エルダリア」
│   ├── lore/                   # 世界の法則・歴史・魔法体系
│   │   ├── calendar.md         # 暦・月名・季節区分
│   │   ├── communication.md    # 通信・連絡手段の設定
│   │   ├── gods.md             # 神々の設定
│   │   ├── heroes.md           # 歴代勇者
│   │   ├── history.md          # 歴史年表・魔王特攻スキルの真実
│   │   ├── memory-stone.md     # 遺言石の設定
│   │   └── world.md            # 世界概要・魔力体系
│   ├── geography/              # 地理・地名・マップ
│   │   ├── eldaria_world_map.md  # 世界地図（テキスト版）
│   │   ├── eldaria_world_map.png # 世界地図（画像）
│   │   ├── geography.md        # 地理・地形・気候
│   │   ├── guild.md            # 冒険者ギルド制度（支部・ランク・依頼システム）
│   │   ├── nations.md          # 国家一覧（総論・関係図。詳細は分割ファイル参照）
│   │   ├── nations-langria.md  # ラングリア王国（歴代国王・現王家・貴族階層）
│   │   ├── nations-arden.md    # アルデン大陸その他国家（東方三候国・フロスト連邦ほか）
│   │   ├── nations-vern.md     # 西方大陸「ヴェルン」の国家・勢力
│   │   └── society.md          # 社会構造・文化
│   ├── beings/                 # 種族・生物
│   │   ├── a-rank-adventurers.md # 有力Aランク冒険者・パーティー
│   │   ├── demon-kings.md      # 歴代魔王（人間時代・背景詳細）
│   │   ├── demons.md           # 魔族設定
│   │   ├── high-rank-adventurers.md # 高ランク冒険者（S・R・Zランク）
│   │   ├── monsters.md         # 魔物・存在格レベル対応表
│   │   └── races.md            # 種族一覧
│   └── rules/                  # 封石・ギフト・暦のルール
│       ├── combat.md           # 戦闘ルール
│       ├── items.md            # アイテム・道具
│       ├── kingdom-law.md      # ラングリア王国法（10本50条）
│       ├── level-system.md     # 存在格レベル体系・シーリング・突破条件
│       ├── purification-guild-regulations.md # 浄化師協会公文書管理規程
│       └── skills.md           # ギフト段階詳細（弱〜真）・全スキル一覧
│
├── multiverse-setting/         # 自作品を全てつなげるマルチバース構想（アイデア段階）
│   └── multiverse.md           # 確定5世界の設定
│
├── story-03-haijo-no-ou/       # 廃城の王
│   ├── EP-timeline.md          # 詳細タイムライン（BG暦・日付ベースの設定専用管理表）
│   ├── episodes-summary.md     # 各話あらすじ一覧
│   ├── MASTER.md               # 設定ハブ（魔王・封石・進捗）
│   ├── writing_prompt.md       # AI執筆指示書
│   ├── characters/                # キャラクター・現場データ
│   │   ├── appraisal-format.md # 鑑定眼《トゥルー・サイト》の表示フォーマット
│   │   ├── characters-npc-crowd.md # 背景キャラ名簿（冒険者パーティー群、名前と一言特徴のみ）
│   │   ├── characters.md       # キャラクター一覧
│   │   └── codex.md            # 現場データ集（封石・廃城構造・執筆注意ルール）
│   ├── plots/                     # プロット・各章設定
│   │   ├── guild-rank-chart.md 
│   │   ├── setting-ch1-2.md    # 第1章・第2章 詳細プロット
│   │   ├── setting-ch3.md      # 第3章「深淵の糸」詳細プロット
│   │   ├── setting-ch4.md      # 第4章「久遠の覚醒」詳細プロット
│   │   ├── setting-ch5.md      # 第5章「欠けた王名」詳細プロット
│   │   ├── setting-ch6.md      # 第6章「残響の王冠」詳細プロット
│   │   └── setting.md          # プロット・ブロック構成
│   └── episodes/
        ├── 1-50/               # ep01~ep50
        ├── 51-100/             # ep51~ep100
        └── 101-150/
            ├── 101-110/             # ep101~ep110
            └── 111-120/
                └── ep111A.md
```

**T版**（`ep◯◯T.md`）がカクヨムに掲載している正式版。A版・C版はT版完成後に `archive/` へ退避。

ep01〜ep22 は現在 C版のみ存在。今後 A版・T版の作成予定あり。

`story-04-yuigon-ishi/`・`story-05-maseki-musou/` は「廃城の王」に続く次回作候補。現時点では設定・プロットのみのアイデア段階で、執筆（episodes/）は未着手。

```
story-04-yuigon-ishi/       # 案4「遺言石の商人」（アイデア段階・執筆未着手）
├── setting.md               # コンセプト・プロット設定
├── characters.md            # キャラクター一覧
└── episodes/                # 執筆開始前のため空

story-05-maseki-musou/      # 「落ちこぼれ精霊憑きの魔石無双」（アイデア段階・執筆未着手）
├── MASTER.md                # 設定ハブ
├── setting.md               # コンセプト・プロット設定
├── characters.md            # キャラクター一覧
├── battle_guidelines.md     # 戦闘描写ガイドライン
├── episodes-summary.md      # 各話あらすじ一覧
└── episodes/                # 執筆開始前のため空
```

---

## 世界地図

舞台となる「エルダリア」の世界地図。Gemini にて作成。

![エルダリア世界地図](/blog/images/eldaria_world_map.webp)

---

## 第1章完結（2026年6月24日）

ep01〜ep36（全36話）で第1章「廃城の王」が完結。

| パート | 話数 | 内容 |
|--------|------|------|
| 起 | ep01〜ep10 | 廃城への流れ着き・封石との出会い |
| 承 | ep11〜ep22 | 封石解放・ギフト継承の開始 |
| 転 | ep23〜ep34 | 接収阻止・絶対結界・王権確立 |
| 結 | ep35〜ep36 | 村との同盟・第1章エピローグ「廃城の王」 |

---

## 第2章完結（2026年7月9日）

ep37〜ep59（全23話）で第2章「王の礎」が完結。episodes-summary.md上は「開幕パート」として一括りで管理されており、1章のような起承転結の細分はまだ設定されていない。

続く第3章「深淵の糸」はep60〜、ウォルガからグラウドへ舞台を移し紅月（8月）から開始予定（詳細はEP-timeline.md参照）。

---

## 第3章完結（2026年7月29日）

ep60〜ep85（全26話）で第3章「深淵の糸」が完結。episodes-summary.md上は「起」「承」「転」「結」の細分はまだ設定されていないが、ep85が第3章エピローグとして、カルン村への帰還・村人との再会、夜の廃城玉座の間での封石との対話を描いて幕を閉じた。

続く第4章「久遠の覚醒」はep86〜、遺言石の石櫃封印とCランク昇格を経て開幕し、現在執筆中。
