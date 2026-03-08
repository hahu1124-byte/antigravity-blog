/**
 * パチンコ確率クイズ
 * Gravity Portal ツール
 */

// ========================================
// 問題データ
// ========================================

const QUESTIONS = [
    {
        category: "確率基礎",
        question: "1/319の台を319回転させた場合、1回も大当たりしない確率は約何%？",
        choices: ["約10%", "約25%", "約37%", "約50%"],
        answer: 2,
        explanation: "1回転で当たらない確率は 318/319 ≒ 0.9969。これを319回繰り返すと (318/319)^319 ≒ 0.368、つまり約37%です。確率の分母と同じ回転数を回しても、約3人に1人は一度も当たりません。これは確率 1/n の試行を n 回行った場合に近づく値 1/e ≒ 36.8% として知られています。"
    },
    {
        category: "確率基礎",
        question: "1/319の台で1000回転ハマる（一度も当たらない）確率は約何%？",
        choices: ["約0.4%", "約4.3%", "約10%", "約15%"],
        answer: 1,
        explanation: "(318/319)^1000 ≒ 0.043、つまり約4.3%です。100人が打てば約4人が経験する計算になります。珍しいようで意外とあり得る確率です。パチンコは毎回転が独立した完全確率抽選なので、前の結果は次の抽選に一切影響しません。"
    },
    {
        category: "確率基礎",
        question: "1/99（甘デジ）の台を99回転させて、1回以上当たる確率は約何%？",
        choices: ["約50%", "約63%", "約80%", "約99%"],
        answer: 1,
        explanation: "1 - (98/99)^99 ≒ 0.634、つまり約63%です。確率 1/n の台を n 回転させたときの当選確率は、n が大きくなるほど 1 - 1/e ≒ 63.2% に近づきます。つまり甘デジでも99回転以内に当たらない人が約37%もいるということです。"
    },
    {
        category: "ボーダー",
        question: "パチンコの「ボーダーライン」とは何を表す数値？",
        choices: [
            "大当たりに必要な最低回転数",
            "収支がプラスマイナスゼロになる千円あたりの回転数",
            "確変に突入するために必要な出玉数",
            "1日で回せる最大回転数"
        ],
        answer: 1,
        explanation: "ボーダーラインとは「千円あたり何回転回れば長期的な収支がプラスマイナスゼロになるか」を示す損益分岐点です。例えば大当たり確率1/300、平均出玉4500個の台では、300÷(4500÷250)=約16.7回転/千円がボーダーです。この数値より多く回る台を打てば、理論上プラス収支になります。"
    },
    {
        category: "ボーダー",
        question: "同じ機種でも、交換率が等価（4円）から非等価（3.57円）に下がると、ボーダーラインはどうなる？",
        choices: [
            "ボーダーは下がる",
            "ボーダーは変わらない",
            "ボーダーは上がる",
            "交換率とボーダーは無関係"
        ],
        answer: 2,
        explanation: "非等価店では出玉の換金額が減ります。例えば4円で250玉借りても、3.57円交換では換金時に約893円にしかなりません。この換金ギャップを補うために、より多く回る台（＝より高いボーダー）を打つ必要があります。ただし、持ち玉遊技中はこのギャップが発生しないため、実際のボーダーは持ち玉比率によっても変わります。"
    },
    {
        category: "連荘",
        question: "確変継続率80%の台で、初当たりを含めて10連荘する確率は約何%？",
        choices: ["約5%", "約13.4%", "約20%", "約30%"],
        answer: 1,
        explanation: "初当たり後に9回連続で確変を引く必要があるため、0.8^9 ≒ 0.1342、つまり約13.4%です。なお平均連荘数は 1÷(1-0.8) = 5連です。10連以上はその倍以上の連荘なので、体感よりも発生頻度は低いことがわかります。"
    },
    {
        category: "連荘",
        question: "ST100回転・大当たり確率1/99の台で、ST中に引き戻す（大当たりする）確率は約何%？",
        choices: ["約50%", "約63.6%", "約75%", "約99%"],
        answer: 1,
        explanation: "1 - (98/99)^100 ≒ 0.636、つまり約63.6%です。ST回転数と確率の分母がほぼ同じなので、1 - 1/e ≒ 63.2% の法則がほぼそのまま当てはまります。残りの約36%は時短を抜けてしまう計算です。"
    },
    {
        category: "期待値",
        question: "「期待値がプラスの台を打つ」とはどういう意味？",
        choices: [
            "必ず勝てる台を選ぶこと",
            "長期的に試行を重ねれば理論上プラス収支になる台を選ぶこと",
            "大当たり確率が高い台を選ぶこと",
            "過去に出ている台を選ぶこと"
        ],
        answer: 1,
        explanation: "期待値がプラスとは「大量に試行を重ねれば理論上プラスに収束する」という意味です。1日単位では負けることもありますが、長期的な累計収支の改善が見込めます。ボーダーラインを超える回転率の台を選ぶことが、期待値プラスの立ち回りの基本です。"
    },
    {
        category: "遊タイム",
        question: "パチンコの「遊タイム」について正しいのはどれ？",
        choices: [
            "規定回転数を超えると大当たりが確定する機能",
            "規定回転数ハマると通常より長い時短モードに突入する救済機能",
            "確率が2倍に上がるボーナスモード",
            "投資金額に応じて自動的に発動する割引機能"
        ],
        answer: 1,
        explanation: "遊タイムは2020年以降のP機に搭載された救済機能です。通常時に大当たりを引かずに規定回転数（大当たり確率の分母の約2.5〜3倍が目安）を消化すると、数百回転の時短モードに突入します。大当たり確率自体は変わりませんが、電チューサポートにより玉を減らさずに効率的に抽選を受けられるため、結果的に大当たりの期待度が高まります（約70〜99%）。"
    },
    {
        category: "収束",
        question: "1/319の台で、大当たり確率が理論値（1/319）に近づき始めるにはどの程度の回転数が必要？",
        choices: [
            "約2000〜3000回転（1日分）で十分",
            "約1万回転程度",
            "約3万〜5万回転以上",
            "1000回転もあれば収束する"
        ],
        answer: 2,
        explanation: "大数の法則により確率は収束しますが、それには膨大な試行回数が必要です。1/319の台では3万〜5万回転でようやく理論値に近づき始め、安定した収束には分母の300〜400倍（約10万〜13万回転）が必要とも言われます。1日の回転数（約2000〜3000回転）程度では偏りが大きいのが普通です。"
    },
    {
        category: "完全確率",
        question: "パチンコの『完全確率方式』について正しいのはどれ？",
        choices: [
            "ハマった後は当たりやすくなる仕組み",
            "毎回転が独立した抽選で、過去の結果は次に影響しない",
            "一定回転数ごとに必ず当たるよう設計されている",
            "連チャン後はハマりやすくなるよう調整されている"
        ],
        answer: 1,
        explanation: "パチンコはすべての回転が独立した完全確率抽選です。サイコロと同じで、過去に何回ハマっていても次の1回転で当たる確率は常に一定です。『そろそろ当たるはず』『連チャンの後はハマる』といった考えは『ギャンブラーの誤謬』と呼ばれる誤解で、統計的な根拠はありません。"
    },
    {
        category: "機種知識",
        question: "パチンコの『確変（確率変動）』と『ST（スペシャルタイム）』の最大の違いは？",
        choices: [
            "確変は出玉が多く、STは出玉が少ない",
            "確変は通常大当たりで終了し、STは規定回転数の消化で終了する",
            "確変は古い機種だけの機能で、STは新しい機種にしかない",
            "確変は甘デジ専用で、STはミドル専用"
        ],
        answer: 1,
        explanation: "確変（ループ式）は通常大当たりを引くまで高確率状態が続きます。一方、STは決められた回転数だけ高確率状態が続き、その間に当たればリセットされますが、引けなければ終了です。どちらも大当たり確率が通常の最大10倍に上がりますが、終了条件が異なります。"
    },
    {
        category: "機種知識",
        question: "P機（従来のパチンコ）と e機（スマパチ）の違いとして正しいのは？",
        choices: [
            "e機は大当たり確率がP機の2倍になる",
            "e機は出玉の払い出しがデジタル管理になった",
            "P機には設定機能がなく、e機にだけある",
            "e機は遊タイムが搭載できない"
        ],
        answer: 1,
        explanation: "e機（スマパチ）は2023年から導入された次世代パチンコです。最大の違いは出玉の払い出しがデジタル管理になった点で、遊技の基本的な仕組みはP機と大きく変わりません。大当たり確率の下限が1/320→1/350に緩和され、Cタイムやラッキートリガーなどの新機能も搭載可能になりましたが、打ち方や確率の考え方はP機と同じです。"
    },
    {
        category: "実践",
        question: "4円パチンコで千円（250玉）あたりの回転数が『良い台』の目安はどのくらい？",
        choices: [
            "5〜10回転",
            "10〜15回転",
            "20回転前後以上",
            "50回転以上"
        ],
        answer: 2,
        explanation: "4円パチンコでは千円あたり18〜25回転が平均的な目安です。等価交換の店ではボーダーラインが約20回転前後の機種が多いため、20回転以上回る台が『良い台』とされます。回転率はヘソ釘（命釘）の開き具合に大きく左右され、わずか0.5mmの違いで1日の回転数が200回以上変わることもあります。"
    }
];

// ========================================
// ランク判定
// ========================================

const QUIZ_COUNT = 10; // 表示する問題数（プールからランダム抽出）

const RANKS = [
    { min: 10, icon: "👑", title: "確率マスター", rank: "S", message: "パーフェクト！パチンコの確率を完全に理解しています。" },
    { min: 8, icon: "🏆", title: "上級者", rank: "A", message: "素晴らしい！ほとんどの問題を正解しました。" },
    { min: 6, icon: "📚", title: "中級者", rank: "B", message: "よく勉強しています。もう少しで上級者です！" },
    { min: 4, icon: "🔰", title: "初心者", rank: "C", message: "基本は押さえています。解説を読んで知識を深めましょう。" },
    { min: 0, icon: "📖", title: "見習い", rank: "D", message: "まだまだこれから！解説を読んで再チャレンジしてみましょう。" }
];

// ========================================
// ゲーム状態管理
// ========================================

let currentQuestionIndex = 0;
let correctCount = 0;
let wrongCount = 0;
let shuffledQuestions = [];
let results = []; // 各問の結果を記録

// ========================================
// DOM要素
// ========================================

const $ = (id) => document.getElementById(id);

const screens = {
    start: $("start-screen"),
    quiz: $("quiz-screen"),
    result: $("result-screen")
};

// ========================================
// 画面切り替え
// ========================================

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    screens[name].classList.add("active");
}

// ========================================
// ユーティリティ
// ========================================

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ========================================
// ゲーム開始
// ========================================

function startQuiz() {
    currentQuestionIndex = 0;
    correctCount = 0;
    wrongCount = 0;
    results = [];
    shuffledQuestions = shuffle(QUESTIONS).slice(0, QUIZ_COUNT);

    $("correct-count").textContent = "0";
    $("wrong-count").textContent = "0";

    showScreen("quiz");
    renderQuestion();
}

// ========================================
// 問題表示
// ========================================

function renderQuestion() {
    const q = shuffledQuestions[currentQuestionIndex];
    const total = shuffledQuestions.length;

    // ヘッダー更新
    $("question-counter").textContent = `${currentQuestionIndex + 1} / ${total}`;
    $("progress-fill").style.width = `${((currentQuestionIndex) / total) * 100}%`;

    // 問題カード
    $("question-category").textContent = q.category;
    $("question-text").textContent = q.question;

    // 選択肢
    const choicesEl = $("choices");
    choicesEl.innerHTML = "";
    const labels = ["A", "B", "C", "D"];

    q.choices.forEach((choice, i) => {
        const btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.innerHTML = `<span class="choice-label">${labels[i]}</span><span>${choice}</span>`;
        btn.addEventListener("click", () => handleAnswer(i));
        choicesEl.appendChild(btn);
    });

    // 解説を隠す
    $("explanation-card").classList.add("hidden");
    $("question-card").style.display = "block";
}

// ========================================
// 回答処理
// ========================================

function handleAnswer(selectedIndex) {
    const q = shuffledQuestions[currentQuestionIndex];
    const isCorrect = selectedIndex === q.answer;
    const buttons = $("choices").querySelectorAll(".choice-btn");

    // 全ボタン無効化
    buttons.forEach((btn, i) => {
        if (i === q.answer) {
            btn.classList.add("correct");
        } else if (i === selectedIndex && !isCorrect) {
            btn.classList.add("wrong");
        } else {
            btn.classList.add("disabled");
        }
    });

    // スコア更新
    if (isCorrect) {
        correctCount++;
        $("correct-count").textContent = correctCount;
    } else {
        wrongCount++;
        $("wrong-count").textContent = wrongCount;
    }

    // 結果記録
    results.push({
        question: q.question,
        correct: isCorrect
    });

    // 解説表示
    showExplanation(isCorrect, q.explanation);
}

// ========================================
// 解説表示
// ========================================

function showExplanation(isCorrect, explanationText) {
    const card = $("explanation-card");
    card.classList.remove("hidden");

    $("result-icon").textContent = isCorrect ? "⭕" : "❌";
    const label = $("result-label");
    label.textContent = isCorrect ? "正解！" : "不正解…";
    label.className = `result-label ${isCorrect ? "correct" : "wrong"}`;

    $("explanation-text").textContent = explanationText;

    // ボタンテキスト
    const nextBtn = $("next-btn");
    const isLast = currentQuestionIndex >= shuffledQuestions.length - 1;
    nextBtn.textContent = isLast ? "結果を見る" : "次の問題へ";

    // スクロール
    card.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ========================================
// 次の問題 / 結果画面
// ========================================

function nextQuestion() {
    currentQuestionIndex++;

    if (currentQuestionIndex >= shuffledQuestions.length) {
        showResult();
    } else {
        renderQuestion();
        // スクロールを上に
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

// ========================================
// 結果画面
// ========================================

function showResult() {
    const total = shuffledQuestions.length;
    const rank = RANKS.find(r => correctCount >= r.min);

    // ランクに応じたクラス
    const resultHero = document.querySelector(".result-hero");
    resultHero.className = `result-hero rank-${rank.rank.toLowerCase()}`;

    $("result-rank-icon").textContent = rank.icon;
    $("result-rank-title").textContent = `ランク ${rank.rank} — ${rank.title}`;
    $("result-score-display").textContent = `${correctCount} / ${total}`;
    $("result-message").textContent = rank.message;

    // 各問の結果内訳
    const breakdownEl = $("result-breakdown");
    breakdownEl.innerHTML = "";
    results.forEach((r, i) => {
        const div = document.createElement("div");
        div.className = "breakdown-item";
        div.innerHTML = `
            <span class="breakdown-icon">${r.correct ? "⭕" : "❌"}</span>
            <span class="breakdown-q">Q${i + 1}. ${r.question}</span>
            <span class="breakdown-result ${r.correct ? "correct" : "wrong"}">${r.correct ? "正解" : "不正解"}</span>
        `;
        breakdownEl.appendChild(div);
    });

    // プログレスバー100%に
    $("progress-fill").style.width = "100%";

    showScreen("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ========================================
// イベントリスナー
// ========================================

$("start-btn").addEventListener("click", startQuiz);
$("next-btn").addEventListener("click", nextQuestion);
$("retry-btn").addEventListener("click", startQuiz);
