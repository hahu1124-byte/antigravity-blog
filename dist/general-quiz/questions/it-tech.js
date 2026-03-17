/**
 * ITクイズ — インターネット・PC歴史・テクノロジー 100問
 * カテゴリ: IT
 */

// eslint-disable-next-line no-unused-vars
const QUESTIONS_IT_TECH = [
    // ========================================
    // インターネットの歴史（20問）
    // ========================================
    {
        category: "ネット史",
        question: "インターネットの原型となったネットワーク「ARPANET」が初めて接続されたのは？",
        choices: ["1959年", "1969年", "1979年", "1989年"],
        answer: 1,
        explanation: "ARPANETは1969年にアメリカ国防総省の研究機関ARPAによって開発され、UCLA等4つの大学間で初の接続が行われました。インターネットの原型です。"
    },
    {
        category: "ネット史",
        question: "World Wide Web（WWW）を発明したのは誰？",
        choices: ["ティム・バーナーズ＝リー", "ヴィントン・サーフ", "ラリー・ペイジ", "マーク・ザッカーバーグ"],
        answer: 0,
        explanation: "ティム・バーナーズ＝リーは1989年にCERN（欧州原子核研究機構）でWWWを考案し、1991年に世界初のウェブサイトを公開しました。HTML、URL、HTTPを設計しました。"
    },
    {
        category: "ネット史",
        question: "日本で初めてインターネット接続サービスを開始したプロバイダは？",
        choices: ["@nifty", "IIJ", "OCN", "BIGLOBE"],
        answer: 1,
        explanation: "IIJ（インターネットイニシアティブジャパン）は1993年に日本初の商用インターネット接続サービスを開始しました。当時は電話回線を使ったダイヤルアップ接続でした。"
    },
    {
        category: "ネット史",
        question: "Googleが設立された年は？",
        choices: ["1994年", "1996年", "1998年", "2000年"],
        answer: 2,
        explanation: "Googleは1998年にラリー・ペイジとセルゲイ・ブリンがスタンフォード大学の学生時代に設立しました。独自のPageRankアルゴリズムによる検索精度の高さで急成長しました。"
    },
    {
        category: "ネット史",
        question: "YouTubeが開設された年は？",
        choices: ["2003年", "2005年", "2007年", "2009年"],
        answer: 1,
        explanation: "YouTubeは2005年にチャド・ハーリー、スティーブ・チェン、ジョード・カリムの3人が設立しました。翌2006年にGoogleが約16.5億ドルで買収しています。"
    },
    {
        category: "ネット史",
        question: "Twitterが開始された年は？",
        choices: ["2004年", "2006年", "2008年", "2010年"],
        answer: 1,
        explanation: "Twitterは2006年にジャック・ドーシーらが開発したSNSで、140文字（現在は280文字）の短文投稿が特徴でした。2023年に「X」にリブランドされています。"
    },
    {
        category: "ネット史",
        question: "日本の「2ちゃんねる」が開設された年は？",
        choices: ["1997年", "1999年", "2001年", "2003年"],
        answer: 1,
        explanation: "2ちゃんねるは1999年にひろゆき（西村博之）が開設した日本最大級の匿名掲示板サイトです。日本のインターネット文化に大きな影響を与えました。"
    },
    {
        category: "ネット史",
        question: "「ブログ」という言葉の語源は？",
        choices: ["ビジネスログ", "ウェブログ", "デジタルログ", "バイオログ"],
        answer: 1,
        explanation: "ブログはWeblog（ウェブログ）の略で、ウェブ上で日記や記録を公開する形式を指します。1990年代後半にアメリカで始まり、2000年代に世界的に普及しました。"
    },
    {
        category: "ネット史",
        question: "Amazonが書籍のオンライン販売を開始した年は？",
        choices: ["1993年", "1995年", "1997年", "1999年"],
        answer: 1,
        explanation: "Amazonは1995年にジェフ・ベゾスがシアトルのガレージで創業し、最初はオンライン書店として始まりました。現在は世界最大のECサイトに成長しています。"
    },
    {
        category: "ネット史",
        question: "Wi-Fiの「Wi-Fi」は何の略？",
        choices: ["Wireless Fidelity", "Wireless Finder", "特に何の略でもない", "Wide Field"],
        answer: 2,
        explanation: "Wi-Fiは実は何の略でもありません。Hi-Fi（High Fidelity）をもじって作られたブランド名です。IEEE 802.11規格の無線LANを指す名称として使われています。"
    },
    {
        category: "ネット史",
        question: "初のスマートフォン「iPhone」が発売された年は？",
        choices: ["2005年", "2007年", "2009年", "2010年"],
        answer: 1,
        explanation: "初代iPhoneは2007年1月にスティーブ・ジョブズが発表し、同年6月にアメリカで発売されました。タッチスクリーン操作のスマートフォン市場を創出しました。"
    },
    {
        category: "ネット史",
        question: "「ニコニコ動画」のサービス開始年は？",
        choices: ["2005年", "2006年", "2007年", "2008年"],
        answer: 2,
        explanation: "ニコニコ動画は2007年にドワンゴ（現KADOKAWA）が開始した動画共有サービスです。画面上にコメントが流れる独自の機能が特徴で、日本独自のネット文化を生みました。"
    },
    {
        category: "ネット史",
        question: "Facebookを創設したのは？",
        choices: ["ジャック・ドーシー", "イーロン・マスク", "マーク・ザッカーバーグ", "ラリー・ペイジ"],
        answer: 2,
        explanation: "Facebookは2004年にハーバード大学の学生マーク・ザッカーバーグが設立しました。当初は大学生限定のSNSでしたが、現在は30億人以上のユーザーを抱えています。"
    },
    {
        category: "ネット史",
        question: "LINEがサービスを開始した年は？",
        choices: ["2009年", "2011年", "2013年", "2015年"],
        answer: 1,
        explanation: "LINEは2011年6月にサービスを開始しました。東日本大震災をきっかけに、災害時にも使える通信手段として開発されたメッセージアプリです。"
    },
    {
        category: "ネット史",
        question: "「クラウドコンピューティング」の「クラウド」は何を指す？",
        choices: [
            "処理速度が群衆（crowd）のように巨大なこと",
            "インターネット上のサーバー群を雲（cloud）に例えた表現",
            "暗号化（cloud=code）された通信",
            "クラウドファンディングの略"
        ],
        answer: 1,
        explanation: "クラウド（cloud=雲）はインターネット経由でアクセスするサーバー群を表す比喩です。ネットワーク図でインターネットを雲の形で描いていたことに由来します。"
    },
    {
        category: "ネット史",
        question: "「TikTok」を運営する会社の名前は？",
        choices: ["テンセント", "アリババ", "バイトダンス", "ファーウェイ"],
        answer: 2,
        explanation: "TikTokは中国のテクノロジー企業バイトダンス（ByteDance）が運営する短編動画プラットフォームです。中国版は「抖音（ドウイン）」として2016年にサービス開始されました。"
    },
    {
        category: "ネット史",
        question: "電子メールの送受信に使われる「@」マークを初めて使ったのは？",
        choices: ["ティム・バーナーズ＝リー", "レイ・トムリンソン", "ヴィントン・サーフ", "ビル・ゲイツ"],
        answer: 1,
        explanation: "レイ・トムリンソンは1971年にARPANET上で初の電子メールを送信し、ユーザー名とホスト名を区切るために「@」記号を採用しました。"
    },
    {
        category: "ネット史",
        question: "日本でスマートフォンが携帯電話の出荷台数を上回ったのは約何年？",
        choices: ["2010年", "2012年", "2014年", "2016年"],
        answer: 1,
        explanation: "日本ではスマートフォンの出荷台数が2012年頃にフィーチャーフォン（ガラケー）を上回りました。iPhoneの日本発売（2008年）から約4年で逆転しました。"
    },
    {
        category: "ネット史",
        question: "「ダークウェブ」にアクセスするために一般的に使われるブラウザは？",
        choices: ["Google Chrome", "Firefox", "Tor Browser", "Safari"],
        answer: 2,
        explanation: "Tor Browser（The Onion Router）は通信を複数のサーバー経由で暗号化し、匿名性を確保するブラウザです。ダークウェブの.onionドメインへのアクセスに使用されます。"
    },
    {
        category: "ネット史",
        question: "「IoT」とは何の略？",
        choices: ["Internet of Things", "Information of Technology", "Interface of Tools", "Input and Output Terminal"],
        answer: 0,
        explanation: "IoT（Internet of Things）は「モノのインターネット」と訳され、家電や自動車などあらゆるモノがインターネットに接続される概念です。スマート家電などが代表例です。"
    },

    // ========================================
    // PCの歴史（20問）
    // ========================================
    {
        category: "PC史",
        question: "世界初の商用パーソナルコンピュータとされるのは？",
        choices: ["Apple I", "Altair 8800", "IBM PC", "Commodore PET"],
        answer: 1,
        explanation: "Altair 8800は1975年に発売され、世界初の商用パーソナルコンピュータの一つとされます。ビル・ゲイツとポール・アレンがこの機種用にBASIC言語を開発しました。"
    },
    {
        category: "PC史",
        question: "Microsoft Windowsの初版が発売された年は？",
        choices: ["1981年", "1985年", "1990年", "1995年"],
        answer: 1,
        explanation: "Windows 1.0は1985年に発売されました。MS-DOS上で動くGUI環境でしたが、本格的に普及したのはWindows 3.1（1992年）やWindows 95（1995年）からです。"
    },
    {
        category: "PC史",
        question: "Apple社の共同創業者でMacintoshの開発を主導したのは？",
        choices: ["スティーブ・ウォズニアック", "スティーブ・ジョブズ", "ティム・クック", "ビル・ゲイツ"],
        answer: 1,
        explanation: "スティーブ・ジョブズはスティーブ・ウォズニアックと共にAppleを創業し、Macintosh（1984年）やiMac、iPhone等の革新的製品を主導しました。"
    },
    {
        category: "PC史",
        question: "コンピュータの処理速度を示す「GHz」の「G」は何を表す？",
        choices: ["グレート", "ギガ", "ジェネラル", "グローバル"],
        answer: 1,
        explanation: "Gはギガ（Giga）で10億を意味します。1GHz = 10億Hz = 1秒間に10億回のクロック信号。CPUの動作周波数を表す単位として使われます。"
    },
    {
        category: "PC史",
        question: "「ムーアの法則」とは？",
        choices: [
            "コンピュータの価格は毎年半分になる",
            "半導体の集積度は約2年で2倍になる",
            "インターネットの速度は毎年3倍になる",
            "ソフトウェアのバグは必ず存在する"
        ],
        answer: 1,
        explanation: "インテルの共同創業者ゴードン・ムーアが1965年に提唱した予測で、集積回路上のトランジスタ数は約2年で2倍になるというものです。半導体産業の発展を長年にわたり的確に予想しました。"
    },
    {
        category: "PC史",
        question: "「USB」は何の略？",
        choices: ["Universal System Bus", "Universal Serial Bus", "United Standard Bus", "Ultra Speed Bus"],
        answer: 1,
        explanation: "USBはUniversal Serial Bus（ユニバーサル・シリアル・バス）の略で、1996年に規格が制定されました。PCと周辺機器を接続する統一規格として世界標準になりました。"
    },
    {
        category: "PC史",
        question: "1バイトは何ビット？",
        choices: ["4ビット", "8ビット", "16ビット", "32ビット"],
        answer: 1,
        explanation: "1バイト = 8ビットです。1ビットは0か1の2値で、8ビット=1バイトで256通り（2の8乗）の値を表現できます。英数字1文字分のデータに相当します。"
    },
    {
        category: "PC史",
        question: "CPUの「CPU」は何の略？",
        choices: ["Central Processing Unit", "Computer Power Unit", "Core Program Utility", "Central Program Unit"],
        answer: 0,
        explanation: "CPUはCentral Processing Unit（中央処理装置）の略で、コンピュータの「頭脳」にあたる部品です。命令の解釈と実行を行うコンピュータの最重要部品です。"
    },
    {
        category: "PC史",
        question: "世界初のウェブブラウザの名前は？",
        choices: ["Mosaic", "Netscape", "WorldWideWeb", "Internet Explorer"],
        answer: 2,
        explanation: "世界初のウェブブラウザは1990年にティム・バーナーズ＝リーが開発した「WorldWideWeb」（後にNexusに改名）です。一般普及したのはMosaic（1993年）が最初です。"
    },
    {
        category: "PC史",
        question: "Linuxの開発者は？",
        choices: ["リチャード・ストールマン", "リーナス・トーバルズ", "デニス・リッチー", "ケン・トンプソン"],
        answer: 1,
        explanation: "Linuxは1991年にフィンランドのリーナス・トーバルズが開発したOSカーネルです。オープンソースで世界中の開発者が改良に参加し、サーバーやスマートフォン(Android)など広く使われています。"
    },
    {
        category: "PC史",
        question: "「SSD」とは何の略？",
        choices: ["Super Speed Disk", "Solid State Drive", "System Storage Device", "Serial Signal Drive"],
        answer: 1,
        explanation: "SSDはSolid State Drive（ソリッドステートドライブ）の略で、フラッシュメモリを使った記憶装置です。HDDと比べて読み書きが高速で、衝撃に強い特徴があります。"
    },
    {
        category: "PC史",
        question: "「GPU」の主な用途として最も適切なのは？",
        choices: [
            "文書の作成",
            "画像・映像の描画処理と並列計算",
            "インターネット接続",
            "音声の録音"
        ],
        answer: 1,
        explanation: "GPU（Graphics Processing Unit）は画像・映像の描画処理に特化したプロセッサです。近年はAI（機械学習）の大規模並列計算にも広く使われています。"
    },
    {
        category: "PC史",
        question: "日本で「PC-9801」シリーズで圧倒的シェアを持っていたメーカーは？",
        choices: ["富士通", "シャープ", "NEC", "東芝"],
        answer: 2,
        explanation: "NECのPC-9801シリーズは1982年から発売され、日本のPC市場で圧倒的なシェアを持っていました。「国民機」とも呼ばれ、Windows普及前の日本PCの標準機でした。"
    },
    {
        category: "PC史",
        question: "「RAM」と「ROM」の違いは？",
        choices: [
            "RAMは読み書き可能、ROMは読み込み専用",
            "RAMは保存用、ROMは表示用",
            "RAMは外部、ROMは内部",
            "違いはない"
        ],
        answer: 0,
        explanation: "RAM（Random Access Memory）は読み書き可能な一時記憶装置で電源を切るとデータが消えます。ROM（Read Only Memory）は読み込み専用で電源を切ってもデータが保持されます。"
    },
    {
        category: "PC史",
        question: "「オープンソース」の意味は？",
        choices: [
            "無料のソフトウェア",
            "ソースコードが公開され、誰でも利用・改変・再配布できるソフトウェア",
            "オンラインで使えるサービス",
            "外部接続できるハードウェア"
        ],
        answer: 1,
        explanation: "オープンソースはソースコードが公開され、誰でも自由に利用・改変・再配布できるソフトウェアのことです。Linux、Firefox、WordPress等が代表例です。"
    },
    {
        category: "PC史",
        question: "初代ファミリーコンピュータ（ファミコン）が発売された年は？",
        choices: ["1980年", "1983年", "1986年", "1989年"],
        answer: 1,
        explanation: "任天堂のファミリーコンピュータは1983年7月15日に日本で発売されました。価格14,800円で、スーパーマリオブラザーズ等の大ヒット作が家庭用ゲーム市場を確立しました。"
    },
    {
        category: "PC史",
        question: "世界初の電子計算機「ENIAC」が完成した年は？",
        choices: ["1936年", "1946年", "1956年", "1966年"],
        answer: 1,
        explanation: "ENIAC（Electronic Numerical Integrator and Computer）は1946年にペンシルベニア大学で完成した世界初の汎用電子計算機です。重さ約30トン、1万8千本の真空管を使用していました。"
    },
    {
        category: "PC史",
        question: "Appleの「Mac」の正式名称は？",
        choices: ["Macbook", "Macintosh", "Machine", "Macro"],
        answer: 1,
        explanation: "MacはMacintosh（マッキントッシュ）の略で、リンゴの品種「McIntosh」に由来します。1984年に初代Macintoshが発売され、GUIを搭載したPCとして先駆的存在でした。"
    },
    {
        category: "PC史",
        question: "「フロッピーディスク」の最も一般的なサイズは？",
        choices: ["3.5インチ", "5.25インチ", "8インチ", "2.5インチ"],
        answer: 0,
        explanation: "3.5インチフロッピーディスクが最も普及しました。容量は1.44MBで、1980〜2000年代にPCのデータ保存・受け渡しに広く使われましたが、USBメモリやCD-Rに取って代わられました。"
    },
    {
        category: "PC史",
        question: "コンピュータの「バグ」という言葉の由来は？",
        choices: [
            "Bad Under Glitch（不具合の下の問題）の略",
            "実際に蛾（bug=虫）がコンピュータに入り込んで障害を起こしたことから",
            "ドイツ語の「Bugen（曲がる）」から",
            "初期のプログラマーの名前"
        ],
        answer: 1,
        explanation: "1947年にハーバード大学のMark IIコンピュータに蛾が挟まって動作障害が起きた記録が残っています。グレース・ホッパーがこの蛾を記録に貼り付けたエピソードが有名です。"
    },

    // ========================================
    // プログラミング・Web技術（20問）
    // ========================================
    {
        category: "プログラミング",
        question: "HTMLは何の略？",
        choices: ["Hyper Text Markup Language", "High Technology Modern Language", "Home Tool Markup Language", "Hyper Transfer Mail Language"],
        answer: 0,
        explanation: "HTMLはHyper Text Markup Language（ハイパーテキスト・マークアップ・ランゲージ）の略で、ウェブページの構造を記述するための言語です。"
    },
    {
        category: "プログラミング",
        question: "プログラミング言語「Python」の名前の由来は？",
        choices: [
            "大蛇のパイソン",
            "イギリスのコメディ番組「モンティ・パイソン」",
            "開発者の名前",
            "ギリシャ神話の怪物"
        ],
        answer: 1,
        explanation: "Pythonの名前は、開発者グイド・ヴァン・ロッサムがファンだったイギリスのコメディ番組「モンティ・パイソン」に由来します。1991年にリリースされ、現在最も人気のある言語の一つです。"
    },
    {
        category: "プログラミング",
        question: "JavaScriptとJavaの関係は？",
        choices: [
            "JavaScriptはJavaの簡易版",
            "同じ言語の別名",
            "技術的にはほぼ無関係な別の言語",
            "JavaScriptはJavaの後継"
        ],
        answer: 2,
        explanation: "JavaScriptとJavaは名前こそ似ていますが、技術的にはほぼ無関係な別の言語です。JavaScriptは当時人気だったJavaの名前を借りたマーケティング的な命名でした。"
    },
    {
        category: "Web技術",
        question: "「HTTPS」のSは何を意味する？",
        choices: ["Speed", "Secure", "Server", "Standard"],
        answer: 1,
        explanation: "HTTPSのSはSecure（安全な）の略で、SSL/TLS暗号化で通信を保護するHTTPプロトコルです。URLが「https://」で始まるサイトは通信が暗号化されています。"
    },
    {
        category: "Web技術",
        question: "「cookie」とは何？",
        choices: [
            "コンピュータウイルスの一種",
            "ウェブサイトがブラウザに保存する小さなデータ",
            "プログラミング言語",
            "メールのスパムフィルター"
        ],
        answer: 1,
        explanation: "cookieはウェブサイトがユーザーのブラウザに保存する小さなデータです。ログイン状態の維持やサイトの設定の記憶などに使われます。"
    },
    {
        category: "プログラミング",
        question: "「API」は何の略？",
        choices: ["Application Programming Interface", "Advanced Program Integration", "Auto Processing Input", "Application Protocol Interchange"],
        answer: 0,
        explanation: "APIはApplication Programming Interface（アプリケーション・プログラミング・インターフェース）の略で、ソフトウェア間の連携を可能にする仕組みです。"
    },
    {
        category: "Web技術",
        question: "「SEO」とは何？",
        choices: [
            "ソフトウェアのエラー修正",
            "検索エンジンの最適化",
            "サーバーの暗号化",
            "ストリーミングの高速化"
        ],
        answer: 1,
        explanation: "SEO（Search Engine Optimization）は検索エンジン最適化のことで、Googleなどの検索結果で上位表示されるように行う施策です。"
    },
    {
        category: "プログラミング",
        question: "「Git」の開発者は？",
        choices: ["マーク・ザッカーバーグ", "リーナス・トーバルズ", "ティム・バーナーズ＝リー", "ジェフ・ベゾス"],
        answer: 1,
        explanation: "GitはLinuxの開発者リーナス・トーバルズが2005年に開発した分散型バージョン管理システムです。GitHubやGitLabなどのサービスで広く利用されています。"
    },
    {
        category: "Web技術",
        question: "「レスポンシブデザイン」とは？",
        choices: [
            "ページの読み込みが速いデザイン",
            "PC・タブレット・スマホなど画面サイズに応じて表示を最適化するデザイン",
            "ユーザーの操作に素早く反応するデザイン",
            "セキュリティに強いデザイン"
        ],
        answer: 1,
        explanation: "レスポンシブデザインは、デバイスの画面サイズに応じてレイアウトを自動的に調整するWebデザイン手法です。CSSのメディアクエリ等を使って実装します。"
    },
    {
        category: "プログラミング",
        question: "「Hello, World!」を画面に表示するプログラムの意味は？",
        choices: [
            "世界に挨拶するプログラム",
            "プログラミングの動作確認で最初に書く定番のプログラム",
            "ウイルスチェック用のコード",
            "世界時計プログラム"
        ],
        answer: 1,
        explanation: "「Hello, World!」はプログラミング学習の最初に書く定番プログラムです。1978年にブライアン・カーニハンとデニス・リッチーの書籍で広まりました。"
    },
    {
        category: "プログラミング",
        question: "プログラミングの「変数」とは？",
        choices: [
            "変化する数学の公式",
            "データを一時的に格納する名前つきの箱",
            "プログラムのエラー",
            "画面に表示される文字"
        ],
        answer: 1,
        explanation: "変数はデータを一時的に格納するための名前付きの入れ物です。プログラム中で値を保存・参照・変更するために使われるプログラミングの最も基本的な概念です。"
    },
    {
        category: "Web技術",
        question: "「DNS」の役割は？",
        choices: [
            "ウイルスの検出",
            "ドメイン名をIPアドレスに変換する",
            "データの暗号化",
            "メールの送受信"
        ],
        answer: 1,
        explanation: "DNS（Domain Name System）は「google.com」のようなドメイン名を、IPアドレス（例: 142.250.196.14）に変換するインターネットの「電話帳」のような仕組みです。"
    },
    {
        category: "プログラミング",
        question: "「オブジェクト指向プログラミング」の特徴でないのは？",
        choices: ["カプセル化", "継承", "ポリモーフィズム", "ブロックチェーン"],
        answer: 3,
        explanation: "オブジェクト指向プログラミング（OOP）の三大特徴は「カプセル化」「継承」「ポリモーフィズム（多態性）」です。ブロックチェーンは暗号技術であり、OOPとは無関係です。"
    },
    {
        category: "Web技術",
        question: "「PWA」とは何？",
        choices: [
            "Personal Web Application",
            "Progressive Web App",
            "Professional Web Architecture",
            "Private Wireless Access"
        ],
        answer: 1,
        explanation: "PWA（Progressive Web App）はウェブ技術で構築されたアプリで、ネイティブアプリのようにホーム画面に追加したりオフラインで動作したりできます。"
    },

    // ========================================
    // AI・最新テクノロジー（20問）
    // ========================================
    {
        category: "AI",
        question: "ChatGPTを開発した会社は？",
        choices: ["Google", "Meta", "OpenAI", "Microsoft"],
        answer: 2,
        explanation: "ChatGPTはOpenAI社が開発した対話型AIで、2022年11月に公開されました。GPT（Generative Pre-trained Transformer）という大規模言語モデルを使用しています。"
    },
    {
        category: "AI",
        question: "AIの「機械学習」と「ディープラーニング」の関係は？",
        choices: [
            "同じ意味",
            "ディープラーニングは機械学習の一手法",
            "機械学習はディープラーニングの一手法",
            "全く無関係"
        ],
        answer: 1,
        explanation: "ディープラーニング（深層学習）は機械学習の一手法で、多層のニューラルネットワークを使います。AI > 機械学習 > ディープラーニングという包含関係です。"
    },
    {
        category: "AI",
        question: "「チューリングテスト」とは何を判定するテスト？",
        choices: [
            "コンピュータの計算速度",
            "機械が人間と区別できない知能を持つかどうか",
            "プログラムにバグがあるかどうか",
            "インターネットの通信速度"
        ],
        answer: 1,
        explanation: "チューリングテストは1950年にアラン・チューリングが提唱した、AIの知能を評価する方法です。機械と人間の会話を第三者が区別できなければ合格とされます。"
    },
    {
        category: "テクノロジー",
        question: "「ブロックチェーン」の最も基本的な特徴は？",
        choices: [
            "高速な処理速度",
            "改ざんが極めて困難な分散型台帳技術",
            "小型のコンピュータ",
            "ワイヤレス通信技術"
        ],
        answer: 1,
        explanation: "ブロックチェーンはデータを「ブロック」の「チェーン」として記録する分散型台帳技術です。データの改ざんが極めて困難で、ビットコインなどの暗号通貨の基盤技術です。"
    },
    {
        category: "テクノロジー",
        question: "「VR」と「AR」の違いは？",
        choices: [
            "同じ技術の別名",
            "VRは仮想現実（完全没入）、ARは拡張現実（現実に重ね合わせ）",
            "VRはゲーム、ARは仕事用",
            "VRは映像、ARは音声"
        ],
        answer: 1,
        explanation: "VR（Virtual Reality）は完全な仮想空間に没入する技術、AR（Augmented Reality）は現実世界にデジタル情報を重ね合わせる技術です。ポケモンGOはARの代表例です。"
    },
    {
        category: "テクノロジー",
        question: "「5G」の5Gは何を意味する？",
        choices: ["5ギガバイト", "第5世代", "5ギガヘルツ", "5倍速い"],
        answer: 1,
        explanation: "5Gは第5世代（5th Generation）の移動通信システムを意味します。4Gの約20倍の通信速度と、多数同時接続・低遅延を実現する次世代通信規格です。"
    },
    {
        category: "テクノロジー",
        question: "「ビットコイン」の考案者とされる人物の名前は？",
        choices: ["中本聡（サトシ・ナカモト）", "イーロン・マスク", "ヴィタリック・ブテリン", "ジャック・ドーシー"],
        answer: 0,
        explanation: "ビットコインは2008年に「サトシ・ナカモト」を名乗る人物が論文を発表し、2009年に運用が開始されました。その正体は2026年現在も不明です。"
    },
    {
        category: "AI",
        question: "画像生成AI「Stable Diffusion」が使う技術は？",
        choices: [
            "GAN（敵対的生成ネットワーク）",
            "拡散モデル（Diffusion Model）",
            "決定木",
            "k近傍法"
        ],
        answer: 1,
        explanation: "Stable Diffusionは拡散モデル（Diffusion Model）を使った画像生成AIです。ノイズから徐々に画像を復元する仕組みで、テキストから高品質な画像を生成できます。"
    },
    {
        category: "テクノロジー",
        question: "「量子コンピュータ」の基本単位は？",
        choices: ["ビット", "バイト", "量子ビット（キュービット）", "テラビット"],
        answer: 2,
        explanation: "量子コンピュータは量子ビット（qubit）を使い、0と1を同時に表現（重ね合わせ）できます。従来のコンピュータでは不可能な超高速計算を実現する可能性を持ちます。"
    },
    {
        category: "AI",
        question: "「LLM」は何の略？",
        choices: [
            "Large Language Model",
            "Long Learning Machine",
            "Logic Layer Module",
            "Linear Link Method"
        ],
        answer: 0,
        explanation: "LLM（Large Language Model＝大規模言語モデル）は大量のテキストデータで学習したAIモデルです。GPT-4、Claude、Geminiなどが代表的なLLMです。"
    },
    {
        category: "セキュリティ",
        question: "「フィッシング詐欺」とは？",
        choices: [
            "コンピュータの釣りゲーム",
            "偽メールやWebサイトで個人情報を騙し取る行為",
            "魚の養殖に使うAI技術",
            "ファイルを暗号化して身代金を要求する攻撃"
        ],
        answer: 1,
        explanation: "フィッシング（phishing）は、銀行や企業を装った偽メール・偽サイトでパスワードやクレジットカード情報を騙し取るサイバー犯罪です。fishing（釣り）にかけた造語です。"
    },
    {
        category: "セキュリティ",
        question: "「ランサムウェア」とは何？",
        choices: [
            "高性能なハードウェア",
            "データを暗号化して身代金を要求するマルウェア",
            "高速なインターネット回線",
            "セキュリティソフトの一種"
        ],
        answer: 1,
        explanation: "ランサムウェア（Ransomware）はファイルを暗号化して使えなくし、復号と引き換えに身代金（ransom）を要求するマルウェアです。企業や病院などを狙った被害が多発しています。"
    },
    {
        category: "セキュリティ",
        question: "安全なパスワードの条件として最も重要なのは？",
        choices: [
            "好きな単語1つ",
            "誕生日の数字",
            "大文字・小文字・数字・記号を混ぜた12文字以上",
            "名前のローマ字"
        ],
        answer: 2,
        explanation: "安全なパスワードは長さ12文字以上で、大文字・小文字・数字・記号を組み合わせたものが推奨されます。辞書にある単語や個人情報は避けるべきです。"
    },
    {
        category: "テクノロジー",
        question: "「クラウドストレージ」の代表的なサービスでないのは？",
        choices: ["Google Drive", "Dropbox", "iCloud", "Photoshop"],
        answer: 3,
        explanation: "Google Drive、Dropbox、iCloudはいずれもクラウドストレージサービスです。Photoshopはアドビの画像編集ソフトであり、ストレージサービスではありません。"
    },
    {
        category: "AI",
        question: "「プロンプトエンジニアリング」とは？",
        choices: [
            "AIのハードウェア設計",
            "AIに適切な指示文を与えて望む結果を得る技術",
            "プログラミング言語の一種",
            "ネットワークの設定技術"
        ],
        answer: 1,
        explanation: "プロンプトエンジニアリングは、AIに的確な指示（プロンプト）を与えて最適な出力を得るための技術・スキルです。ChatGPTなどの実用化に伴い注目されています。"
    },
    {
        category: "AI",
        question: "世界初の対話型AIチャットボットとされるのは？",
        choices: ["Siri", "Alexa", "ELIZA", "Watson"],
        answer: 2,
        explanation: "ELIZAは1966年にMITのジョセフ・ワイゼンバウムが開発した世界初の対話型チャットボットです。セラピストを模したプログラムで、パターンマッチングで応答していました。"
    },
    {
        category: "テクノロジー",
        question: "「NFT」は何の略？",
        choices: ["New File Transfer", "Non-Fungible Token", "Network Function Tool", "Next Framework Technology"],
        answer: 1,
        explanation: "NFT（Non-Fungible Token＝非代替性トークン）はブロックチェーン上でデジタル資産の唯一性を証明する技術です。デジタルアート等の所有権の証明に使われています。"
    },
    {
        category: "テクノロジー",
        question: "「サブスクリプション」とはどんなビジネスモデル？",
        choices: [
            "商品を一回で買い切る方式",
            "定額料金を支払い期間中サービスを利用する方式",
            "無料でサービスを提供する方式",
            "広告収入で運営する方式"
        ],
        answer: 1,
        explanation: "サブスクリプション（定額課金）は月額や年額で料金を支払い、その期間中サービスを利用できるモデルです。Netflix、Spotify、Adobe CCなどが代表例です。"
    },
    {
        category: "セキュリティ",
        question: "「二要素認証（2FA）」の「二要素」とは？",
        choices: [
            "2つのパスワードを使うこと",
            "パスワード（知識）とスマホ（所持）など異なる種類の認証を2つ組み合わせること",
            "2つのアカウントでログインすること",
            "2回ログインすること"
        ],
        answer: 1,
        explanation: "二要素認証は「知っているもの（パスワード）」「持っているもの（スマホ）」「自分自身（指紋等）」のうち2つを組み合わせる認証方式です。セキュリティが大幅に向上します。"
    },
    {
        category: "セキュリティ",
        question: "「VPN」の主な用途は？",
        choices: [
            "動画の高速再生",
            "安全な暗号化通信でプライバシーを保護する",
            "ウイルスの駆除",
            "ファイルの圧縮"
        ],
        answer: 1,
        explanation: "VPN（Virtual Private Network）はインターネット通信を暗号化し、プライバシーを保護する技術です。公共Wi-Fiでの安全な通信や、リモートワークでの社内ネットワーク接続に使われます。"
    },

    // ========================================
    // 追加問題（100問到達用）
    // ========================================
    {
        category: "ネット史",
        question: "「Wikipedia」が開始された年は？",
        choices: ["1999年", "2001年", "2003年", "2005年"],
        answer: 1,
        explanation: "Wikipediaは2001年1月にジミー・ウェールズとラリー・サンガーが開始した無料のオンライン百科事典です。誰でも編集できるWiki形式が特徴で、300以上の言語版があります。"
    },
    {
        category: "ネット史",
        question: "「インフルエンサー」という言葉の意味は？",
        choices: [
            "インフルエンザの専門家",
            "SNSで大きな影響力を持つ発信者",
            "投資家のこと",
            "プログラマーのこと"
        ],
        answer: 1,
        explanation: "インフルエンサー（influencer）はSNSやブログで多くのフォロワーを持ち、消費行動や世論に大きな影響力を与える発信者のことです。マーケティングでも重要な存在です。"
    },
    {
        category: "PC史",
        question: "「Bluetooth」の名前の由来は？",
        choices: [
            "青い歯のロゴマーク",
            "デンマークの王「ハーラル1世（青歯王）」",
            "発明者の名前",
            "Blue Toothという会社名"
        ],
        answer: 1,
        explanation: "Bluetoothの名前は10世紀のデンマーク王ハーラル1世（通称「青歯王」）に由来します。彼がスカンジナビアを統一したことから、通信規格の統一を象徴しています。"
    },
    {
        category: "プログラミング",
        question: "「GitHub」とは何？",
        choices: [
            "プログラミング言語",
            "Gitを使ったソースコードのホスティングサービス",
            "ゲーム配信プラットフォーム",
            "AIチャットボット"
        ],
        answer: 1,
        explanation: "GitHubはGitベースのソースコードホスティングサービスで、2008年にサービス開始。2018年にMicrosoftが約75億ドルで買収しました。世界最大の開発者コミュニティです。"
    },
    {
        category: "プログラミング",
        question: "「フルスタックエンジニア」とは？",
        choices: [
            "特定の言語だけを使うエンジニア",
            "フロントエンドからバックエンドまで幅広く開発できるエンジニア",
            "ハードウェア専門のエンジニア",
            "セキュリティ専門のエンジニア"
        ],
        answer: 1,
        explanation: "フルスタックエンジニアは、UIのフロントエンドからサーバーサイドのバックエンド、データベース、インフラまで幅広い技術領域をカバーできるエンジニアのことです。"
    },
    {
        category: "Web技術",
        question: "「SPA（Single Page Application）」とは？",
        choices: [
            "1ページだけのウェブサイト",
            "ページ遷移せずに画面内容を動的に書き換えるWebアプリ",
            "スパムメールのこと",
            "シンプルなプログラミング方式"
        ],
        answer: 1,
        explanation: "SPAはページの全体リロードなしに、JavaScript で画面内容を動的に更新するWebアプリケーションの設計方式です。Gmail、Twitter(X)、Google Mapsなどが代表例です。"
    },
    {
        category: "AI",
        question: "「GPT」は何の略？",
        choices: [
            "General Purpose Technology",
            "Generative Pre-trained Transformer",
            "Global Processing Tool",
            "Graphical Programming Terminal"
        ],
        answer: 1,
        explanation: "GPTはGenerative Pre-trained Transformer（生成的事前学習済みトランスフォーマー）の略です。大量のテキストデータで事前学習し、テキスト生成が可能なAIモデルです。"
    },
    {
        category: "AI",
        question: "「ハルシネーション」とはAIの文脈で何を意味する？",
        choices: [
            "AIの処理速度が上がること",
            "AIが事実に反する情報をもっともらしく生成すること",
            "AIが幻覚を見ること",
            "AIが停止すること"
        ],
        answer: 1,
        explanation: "ハルシネーション（hallucination=幻覚）はAIが事実と異なる情報をあたかも正しいかのように生成してしまう現象です。LLMの最大の課題の一つとして知られています。"
    },
    {
        category: "セキュリティ",
        question: "「ゼロデイ攻撃」とは？",
        choices: [
            "0日で完了する高速な攻撃",
            "修正パッチが公開される前の脆弱性を突いた攻撃",
            "毎日0時に行われる攻撃",
            "初心者が行う攻撃"
        ],
        answer: 1,
        explanation: "ゼロデイ攻撃は、ソフトウェアの脆弱性が発見されてから修正パッチが提供されるまでの間（0日目）に、その脆弱性を悪用する攻撃です。防御が困難なため非常に危険です。"
    },
    {
        category: "セキュリティ",
        question: "「CAPTCHA」の主な目的は？",
        choices: [
            "パスワードを暗号化すること",
            "人間とボット（自動プログラム）を区別すること",
            "ウイルスを検出すること",
            "通信速度を測定すること"
        ],
        answer: 1,
        explanation: "CAPTCHA（Completely Automated Public Turing test to tell Computers and Humans Apart）は、歪んだ文字や画像認識テストで人間とボットを区別する仕組みです。"
    },
    {
        category: "テクノロジー",
        question: "「FinTech（フィンテック）」とは何の略？",
        choices: [
            "Final Technology",
            "Finance + Technology",
            "Financial Technique",
            "Fine Technology"
        ],
        answer: 1,
        explanation: "FinTechはFinance（金融）とTechnology（技術）を組み合わせた造語で、ITを活用した革新的な金融サービスを指します。モバイル決済、ロボアドバイザー、暗号通貨などが含まれます。"
    },
    {
        category: "テクノロジー",
        question: "「エッジコンピューティング」とは？",
        choices: [
            "崖っぷちの状態で計算すること",
            "データの発生源に近い場所で処理を行う分散型コンピューティング",
            "最先端のコンピュータのこと",
            "端末を使わない計算方式"
        ],
        answer: 1,
        explanation: "エッジコンピューティングはデータの発生源（エッジ）に近い場所で処理を行う技術です。クラウドへのデータ送信を減らし、遅延を最小化できるため、自動運転やIoTで重要です。"
    },
    {
        category: "プログラミング",
        question: "プログラミングの「デバッグ」とは？",
        choices: [
            "プログラムを削除すること",
            "プログラムの不具合（バグ）を見つけて修正すること",
            "プログラムを実行すること",
            "プログラムをコピーすること"
        ],
        answer: 1,
        explanation: "デバッグ（debug）はプログラムのバグ（不具合・誤り）を特定し修正する作業です。開発時間の大部分がデバッグに費やされると言われるほど、プログラミングにおいて重要な工程です。"
    },
    {
        category: "プログラミング",
        question: "「Docker」とは何？",
        choices: [
            "プログラミング言語",
            "アプリケーションをコンテナ化して実行する技術",
            "データベース管理システム",
            "画像編集ソフト"
        ],
        answer: 1,
        explanation: "Dockerはアプリケーションとその依存関係をコンテナという軽量な仮想環境にパッケージ化する技術です。「自分の環境では動く」問題を解決し、開発と運用の効率を大幅に向上させます。"
    },
    {
        category: "Web技術",
        question: "「CDN」とは何？",
        choices: [
            "Compact Disc Network",
            "Content Delivery Network",
            "Central Data Node",
            "Cloud Database Navigator"
        ],
        answer: 1,
        explanation: "CDN（Content Delivery Network）は世界各地にサーバーを配置し、ユーザーに最も近いサーバーからコンテンツを配信する仕組みです。Webサイトの表示速度向上に貢献します。"
    },
    {
        category: "AI",
        question: "「RAG」とはAIの文脈で何？",
        choices: [
            "Random Answer Generator",
            "Retrieval-Augmented Generation（検索拡張生成）",
            "Rapid AI Growth",
            "Real-time AI Graphics"
        ],
        answer: 1,
        explanation: "RAG（Retrieval-Augmented Generation）は外部データベースから関連情報を検索し、その情報を基にAIが回答を生成する技術です。LLMのハルシネーションを減らす効果があります。"
    },
    {
        category: "テクノロジー",
        question: "「デジタルツイン」とは？",
        choices: [
            "双子のデジタル版",
            "物理的な対象をデジタル空間に忠実に再現した仮想モデル",
            "2台のコンピュータを同期すること",
            "デジタルカメラの2つ目のレンズ"
        ],
        answer: 1,
        explanation: "デジタルツインは現実世界の物体やシステムをデジタル空間上に忠実に再現する技術です。工場の設備や都市のインフラをシミュレーションし、最適化や故障予測に活用されています。"
    },
    {
        category: "ネット史",
        question: "「Web3」とは何を指す概念？",
        choices: [
            "ウェブブラウザのバージョン3",
            "ブロックチェーンを基盤とした分散型のインターネット",
            "第3世代の携帯電話",
            "HTMLバージョン3"
        ],
        answer: 1,
        explanation: "Web3はブロックチェーン技術を活用した分散型インターネットの概念です。Web1.0（情報閲覧）、Web2.0（双方向SNS）に続く次の段階として提唱されています。"
    },
    {
        category: "プログラミング",
        question: "「TypeScript」と「JavaScript」の関係は？",
        choices: [
            "全く別の言語",
            "TypeScriptはJavaScriptに型システムを追加した上位互換言語",
            "TypeScriptはJavaScriptの前身",
            "同じ言語の別名"
        ],
        answer: 1,
        explanation: "TypeScriptはMicrosoftが開発したJavaScriptの上位互換（スーパーセット）言語です。静的型付けを追加し、大規模開発でのバグ防止や開発効率の向上に貢献します。"
    },
    {
        category: "テクノロジー",
        question: "「RPA」とは何？",
        choices: [
            "リアルプレイヤーアプリケーション",
            "Robotic Process Automation（ソフトウェアロボットによる業務自動化）",
            "Rapid Programming Architecture",
            "Real-time Processing Algorithm"
        ],
        answer: 1,
        explanation: "RPA（Robotic Process Automation）はソフトウェアロボットが人間の代わりにPC上の定型業務を自動実行する技術です。データ入力や帳票処理などの事務作業を効率化します。"
    },
    {
        category: "セキュリティ",
        question: "「パスキー（Passkey）」とは？",
        choices: [
            "強力なパスワードのこと",
            "パスワードに代わる生体認証等を使った新しい認証方式",
            "暗号化キーのこと",
            "物理的な鍵のこと"
        ],
        answer: 1,
        explanation: "パスキーはFIDO2規格に基づく新しい認証方式で、指紋や顔認証などの生体認証を使ってパスワードなしでログインできます。Apple、Google、Microsoftが対応を進めています。"
    },
    {
        category: "AI",
        question: "「ファインチューニング」とはAIの文脈で何を意味する？",
        choices: [
            "AIの音質を調整すること",
            "事前学習済みモデルを特定の用途に合わせて追加学習すること",
            "AIの動作を一時停止すること",
            "AIのコストを最適化すること"
        ],
        answer: 1,
        explanation: "ファインチューニング（fine-tuning）は大規模な事前学習済みAIモデルに、特定のタスクや分野のデータで追加学習を行い、性能を向上させる手法です。"
    },
    {
        category: "Web技術",
        question: "「WebSocket」とは何？",
        choices: [
            "Webサイトのプラグイン",
            "サーバーとクライアント間でリアルタイム双方向通信を行うプロトコル",
            "Web用の電源コネクタ",
            "Webサイトの保存形式"
        ],
        answer: 1,
        explanation: "WebSocketはHTTPとは異なり、クライアントとサーバー間で持続的な双方向通信を可能にするプロトコルです。チャットアプリやリアルタイム通知、オンラインゲームなどで使われます。"
    },
    {
        category: "テクノロジー",
        question: "「ゼロトラスト」とはセキュリティの文脈で何？",
        choices: [
            "誰も信頼しないこと",
            "ネットワーク内部・外部を問わず、全てのアクセスを検証するセキュリティモデル",
            "セキュリティソフトなしで運用すること",
            "信頼できないサイトのこと"
        ],
        answer: 1,
        explanation: "ゼロトラストは「何も信頼しない」を前提としたセキュリティモデルで、社内ネットワークからのアクセスであっても常に認証・認可を行います。リモートワーク普及に伴い注目されています。"
    },
    {
        category: "ネット史",
        question: "「コンピュータウイルス」が初めて確認されたのは約何年？",
        choices: ["1971年", "1982年", "1995年", "2000年"],
        answer: 1,
        explanation: "最初のPCウイルスとされる「Elk Cloner」は1982年にApple IIで発見されました。フロッピーディスク経由で感染し、画面にメッセージを表示するもので、実害は少ないものでした。"
    },
    {
        category: "プログラミング",
        question: "「アジャイル開発」とは？",
        choices: [
            "一度に全ての機能を完成させる開発手法",
            "小さな単位で反復的に開発を進める柔軟な手法",
            "一人で全てを開発する手法",
            "テストを行わない高速開発"
        ],
        answer: 1,
        explanation: "アジャイル（agile=俊敏な）開発は、短い開発サイクルを繰り返しながら、顧客のフィードバックを反映して段階的に製品を改良していく開発手法です。従来のウォーターフォール型と対比されます。"
    },
];
