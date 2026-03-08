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
        explanation: "1回転で当たらない確率は 318/319 ≒ 0.9969。これを319回繰り返すと (318/319)^319 ≒ 0.368、つまり約37%です。確率の分母と同じ回転数を回しても、約3人に1人は一度も当たりません。"
    },
    {
        category: "確率基礎",
        question: "1/319の台で1000回転ハマる（一度も当たらない）確率は約何%？",
        choices: ["約0.4%", "約4.3%", "約10%", "約15%"],
        answer: 1,
        explanation: "(318/319)^1000 ≒ 0.043、つまり約4.3%です。100人が打てば約4人が経験する計算。珍しいようで意外とある確率です。"
    },
    {
        category: "確率基礎",
        question: "1/99（甘デジ）の台を99回転させて当たる確率は約何%？",
        choices: ["約50%", "約63%", "約80%", "約99%"],
        answer: 1,
        explanation: "1 - (98/99)^99 ≒ 0.634、つまり約63%です。これは確率1/nの台をn回転させたときの当選確率で、nが大きくなるほど 1 - 1/e ≒ 63.2% に近づきます。"
    },
    {
        category: "ボーダー",
        question: "パチンコの「ボーダーライン」とは何を表す数値？",
        choices: [
            "大当たりに必要な最低回転数",
            "損益分岐点となる千円あたりの回転数",
            "確変に突入するために必要な出玉数",
            "1日で回せる最大回転数"
        ],
        answer: 1,
        explanation: "ボーダーラインとは「千円あたり何回転回れば期待値がプラスマイナスゼロになるか」を示す基準値です。ボーダー以上回る台を打てば理論上プラス収支になります。"
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
        explanation: "非等価店では出玉の換金額が減るため、同じ出玉でも回収できる金額が減ります。その分、より多く回る台（＝ボーダーが高い台）を打たないと期待値がプラスになりません。"
    },
    {
        category: "連荘",
        question: "確変継続率80%の台で、10連荘（大当たり10回連続）する確率は約何%？",
        choices: ["約8%", "約10.7%", "約20%", "約30%"],
        answer: 1,
        explanation: "0.8^9 ≒ 0.134 …ですが、初当たり含めて10回連続するので 0.8^9 ≒ 13.4%。ただし「ちょうど10連」ではなく「10連以上」の確率は 0.8^9 ≒ 13.4%。実は約10.7%（0.8^10 × ... ）の計算もありますが、10回大当たりが連続する確率は約10.7%（0.8の9乗 ≒ 13.4%のうち10回目で終了する分）です。"
    },
    {
        category: "連荘",
        question: "ST100回転・確率1/99の台でST中に引き戻す（大当たりする）確率は約何%？",
        choices: ["約50%", "約63.6%", "約75%", "約99%"],
        answer: 1,
        explanation: "1 - (98/99)^100 ≒ 0.636、つまり約63.6%です。ST回転数と確率の分母がほぼ同じなので、先ほどの法則（約63%）がそのまま当てはまります。"
    },
    {
        category: "期待値",
        question: "「期待値がプラスの台を打つ」とはどういう意味？",
        choices: [
            "必ず勝てる台を選ぶこと",
            "長期間打ち続ければ理論上プラス収支になる台を選ぶこと",
            "大当たり確率が高い台を選ぶこと",
            "過去に出ている台を選ぶこと"
        ],
        answer: 1,
        explanation: "期待値がプラスとは「大量に試行すれば理論上プラスに収束する」という意味です。1日単位では負けることもありますが、長期的な収支改善が見込めます。これがボーダー理論の根幹です。"
    },
    {
        category: "遊タイム",
        question: "遊タイム（天井機能）について正しいのはどれ？",
        choices: [
            "規定回転数を超えると大当たりが確定する",
            "規定回転数を超えると時短モードに突入し、大当たり確率が上がる",
            "規定回転数を超えると自動的にRUSHに突入する",
            "規定回転数を超えると投資金額が返ってくる"
        ],
        answer: 1,
        explanation: "遊タイムは規定回転数に到達すると時短モードに突入する救済機能です。大当たり確率自体は変わりませんが、電チューサポート（電サポ）により玉を減らさずに回せるため、実質的に大当たりしやすくなります。"
    },
    {
        category: "収束",
        question: "「確率は1日で収束する」という考えは正しい？",
        choices: [
            "正しい — 1日2000回転もあれば十分",
            "正しい — 大数の法則により収束する",
            "正しくない — 数万〜数十万回転が必要",
            "機種による — 甘デジなら1日で収束する"
        ],
        answer: 2,
        explanation: "大数の法則は「試行回数が十分に多いとき」に成立します。1日の回転数（約2000〜3000回転）程度では、確率の偏りがまだ大きいのが普通です。1/319の台なら5万回転以上で徐々に収束し始めるのが目安です。"
    }
];

// ========================================
// ランク判定
// ========================================

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
    shuffledQuestions = shuffle(QUESTIONS);

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
