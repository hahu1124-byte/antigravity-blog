/**
 * パチンコ確率クイズ
 * Gravity Portal ツール
 */

// ========================================
// 問題データ
// ========================================

// ========================================
// 問題データ（questions/*.js から集約）
// ========================================
// 実データは questions/probability.js・practice.js・culture.js に分割済み。
// index.html で quiz.js より前に読み込まれる（素の script タグのため順序依存）。

const QUESTIONS = [
    ...(typeof QUIZ_QUESTIONS_PROBABILITY !== "undefined" ? QUIZ_QUESTIONS_PROBABILITY : []),
    ...(typeof QUIZ_QUESTIONS_PRACTICE !== "undefined" ? QUIZ_QUESTIONS_PRACTICE : []),
    ...(typeof QUIZ_QUESTIONS_CULTURE !== "undefined" ? QUIZ_QUESTIONS_CULTURE : []),
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
    const categoryText = q.category === "演者" ? `${q.category}　※2026年3月時点` : q.category;
    $("question-category").textContent = categoryText;
    $("question-text").textContent = q.question;

    // 選択肢をシャッフル（位置暗記防止）
    const choiceIndices = shuffle([0, 1, 2, 3]);
    q._shuffledAnswer = choiceIndices.indexOf(q.answer);

    // 選択肢
    const choicesEl = $("choices");
    choicesEl.innerHTML = "";
    const labels = ["A", "B", "C", "D"];

    choiceIndices.forEach((origIndex, displayIndex) => {
        const btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.innerHTML = `<span class="choice-label">${labels[displayIndex]}</span><span>${q.choices[origIndex]}</span>`;
        btn.addEventListener("click", () => handleAnswer(displayIndex));
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
    const correctIndex = q._shuffledAnswer;
    const isCorrect = selectedIndex === correctIndex;
    const buttons = $("choices").querySelectorAll(".choice-btn");

    // 全ボタン無効化
    buttons.forEach((btn, i) => {
        if (i === correctIndex) {
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
