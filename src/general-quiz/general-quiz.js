/**
 * 一般常識クイズ
 * Gravity Portal ゲーム
 *
 * 問題データは各カテゴリ別ファイルから読み込み:
 * - QUESTIONS_CURRENT_EVENTS (時事)
 * - QUESTIONS_EDUCATION (教養)
 * - QUESTIONS_ENTERTAINMENT (娯楽)
 * - QUESTIONS_IT_TECH (IT)
 * 「総合」は全カテゴリから混合出題
 */

// ========================================
// カテゴリ定義
// ========================================

const CATEGORIES = [
    {
        id: "current-events",
        name: "時事",
        icon: "📰",
        desc: "2024〜2026年のニュース",
        getData: () => typeof QUESTIONS_CURRENT_EVENTS !== "undefined" ? QUESTIONS_CURRENT_EVENTS : [],
    },
    {
        id: "education",
        name: "教養",
        icon: "📖",
        desc: "中学校レベルの一般教養",
        getData: () => typeof QUESTIONS_EDUCATION !== "undefined" ? QUESTIONS_EDUCATION : [],
    },
    {
        id: "entertainment",
        name: "娯楽",
        icon: "🎬",
        desc: "映画・音楽・ゲーム・スポーツ",
        getData: () => typeof QUESTIONS_ENTERTAINMENT !== "undefined" ? QUESTIONS_ENTERTAINMENT : [],
    },
    {
        id: "it-tech",
        name: "IT",
        icon: "💻",
        desc: "インターネット・PC・テクノロジー",
        getData: () => typeof QUESTIONS_IT_TECH !== "undefined" ? QUESTIONS_IT_TECH : [],
    },
    {
        id: "all",
        name: "総合",
        icon: "🌐",
        desc: "全カテゴリから混合出題",
        getData: () => [
            ...(typeof QUESTIONS_CURRENT_EVENTS !== "undefined" ? QUESTIONS_CURRENT_EVENTS : []),
            ...(typeof QUESTIONS_EDUCATION !== "undefined" ? QUESTIONS_EDUCATION : []),
            ...(typeof QUESTIONS_ENTERTAINMENT !== "undefined" ? QUESTIONS_ENTERTAINMENT : []),
            ...(typeof QUESTIONS_IT_TECH !== "undefined" ? QUESTIONS_IT_TECH : []),
        ],
        fullWidth: true,
    },
];

// ========================================
// ランク判定（比率ベース）
// ========================================

const QUIZ_COUNT = 10;

const RANKS = [
    { min: 1.0, icon: "👑", title: "博識マスター", rank: "S", message: "パーフェクト！幅広い知識を完全に備えています。" },
    { min: 0.8, icon: "🏆", title: "上級者", rank: "A", message: "素晴らしい！ほとんどの問題を正解しました。" },
    { min: 0.6, icon: "📚", title: "中級者", rank: "B", message: "よく知っています。もう少しで上級者です！" },
    { min: 0.4, icon: "🔰", title: "初心者", rank: "C", message: "基本は押さえています。解説を読んで知識を深めましょう。" },
    { min: 0.0, icon: "📖", title: "見習い", rank: "D", message: "まだまだこれから！解説を読んで再チャレンジしてみましょう。" },
];

// ========================================
// ゲーム状態管理
// ========================================

let currentQuestionIndex = 0;
let correctCount = 0;
let wrongCount = 0;
let shuffledQuestions = [];
let results = [];
let selectedCategory = null;

// ========================================
// DOM要素
// ========================================

const $ = (id) => document.getElementById(id);

const screens = {
    category: $("category-screen"),
    quiz: $("quiz-screen"),
    result: $("result-screen"),
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
// カテゴリ選択画面の初期化
// ========================================

function initCategoryGrid() {
    const grid = $("category-grid");
    grid.innerHTML = "";

    CATEGORIES.forEach(cat => {
        const questions = cat.getData();
        const card = document.createElement("div");
        card.className = "category-card" + (cat.fullWidth ? " full-width" : "");
        card.innerHTML = `
            <span class="category-card-icon">${cat.icon}</span>
            <span class="category-card-name">${cat.name}</span>
            <span class="category-card-desc">${cat.desc}</span>
            <span class="category-card-count">${questions.length}問</span>
        `;
        card.addEventListener("click", () => startQuiz(cat));
        grid.appendChild(card);
    });
}

// ========================================
// ゲーム開始
// ========================================

function startQuiz(category) {
    selectedCategory = category;
    currentQuestionIndex = 0;
    correctCount = 0;
    wrongCount = 0;
    results = [];

    const pool = category.getData();
    if (pool.length === 0) {
        alert("このカテゴリにはまだ問題がありません。");
        return;
    }

    shuffledQuestions = shuffle(pool).slice(0, QUIZ_COUNT);

    $("correct-count").textContent = "0";
    $("wrong-count").textContent = "0";
    $("current-category-label").textContent = `${category.icon} ${category.name}`;

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
        correct: isCorrect,
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
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

// ========================================
// 結果画面
// ========================================

function showResult() {
    const total = shuffledQuestions.length;
    const ratio = correctCount / total;
    const rank = RANKS.find(r => ratio >= r.min);

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
// カテゴリ選択に戻る
// ========================================

function backToCategory() {
    showScreen("category");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ========================================
// イベントリスナー
// ========================================

$("next-btn").addEventListener("click", nextQuestion);
$("retry-btn").addEventListener("click", () => startQuiz(selectedCategory));
$("back-category-btn").addEventListener("click", backToCategory);

// 初期化
initCategoryGrid();
