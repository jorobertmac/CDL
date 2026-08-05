/* =========================================================
   CDL Practice Test App
   Loads data from tests.json with this shape:

   {
     "categories": {
       "hazardous-material": {
         "name": "Hazardous Materials",
         "description": "...",
         "tests": [
           { "id": "hazardous-material-1", "name": "Practice Test 1", "questions": [...] }
         ]
       }
     }
   }
   ========================================================= */

let quizData = null;

// ---------- STATE ----------
let state = {
  selectedCategories: new Set(),
  selectedTests: new Set(), // stores "categoryId::testId"
  randomize: true,
  feedbackMode: "immediate", // "immediate" | "end"
  questions: [], // flat list of questions for the current session
  currentIndex: 0,
  answers: [], // { questionIndex, selectedIndex }
  quizFinished: false
};

// ---------- DOM REFS ----------
const selectionScreen = document.getElementById("selection-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultsScreen = document.getElementById("results-screen");

const categoryList = document.getElementById("category-list");
const testList = document.getElementById("test-list");
const startBtn = document.getElementById("start-btn");
const randomizeCheckbox = document.getElementById("randomize");

const progressText = document.getElementById("progress-text");
const progressFill = document.getElementById("progress-fill");
const questionText = document.getElementById("question-text");
const optionsList = document.getElementById("options-list");
const feedbackBox = document.getElementById("feedback-box");
const nextBtn = document.getElementById("next-btn");
const quitBtn = document.getElementById("quit-btn");

const scorePercent = document.getElementById("score-percent");
const scoreDetail = document.getElementById("score-detail");
const reviewList = document.getElementById("review-list");
const restartBtn = document.getElementById("restart-btn");

// ---------- INIT ----------
function init() {
  renderCategories();
  bindEvents();
}

function bindEvents() {
  randomizeCheckbox.addEventListener("change", () => {
    state.randomize = randomizeCheckbox.checked;
  });

  document.querySelectorAll('input[name="feedback"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      state.feedbackMode = e.target.value;
    });
  });

  startBtn.addEventListener("click", startQuiz);
  nextBtn.addEventListener("click", handleNext);
  quitBtn.addEventListener("click", () => {
    if (confirm("Quit this practice test and return to the selection screen?")) {
      showScreen("selection");
    }
  });
  restartBtn.addEventListener("click", () => showScreen("selection"));
}

// ---------- SELECTION UI ----------
function renderCategories() {
  categoryList.innerHTML = "";
  const cats = quizData.categories;

  Object.entries(cats).forEach(([id, cat]) => {
    const label = document.createElement("label");
    label.className = "checkbox-item";
    label.innerHTML = `
      <input type="checkbox" data-category="${id}" />
      <span class="item-text">
        <span class="item-name">${cat.name}</span>
        <span class="item-desc">${cat.description || ""}</span>
      </span>
    `;
    const checkbox = label.querySelector("input");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.selectedCategories.add(id);
      } else {
        state.selectedCategories.delete(id);
        // also deselect any tests that belonged to this category
        [...state.selectedTests].forEach((key) => {
          if (key.startsWith(id + "::")) state.selectedTests.delete(key);
        });
      }
      renderTests();
      updateStartButton();
    });
    categoryList.appendChild(label);
  });
}

function renderTests() {
  testList.innerHTML = "";

  if (state.selectedCategories.size === 0) {
    testList.innerHTML = `<p class="empty-state">No categories selected yet.</p>`;
    return;
  }

  state.selectedCategories.forEach((catId) => {
    const cat = quizData.categories[catId];
    if (!cat) return;

    const groupLabel = document.createElement("div");
    groupLabel.className = "category-group-label";
    groupLabel.textContent = cat.name;
    testList.appendChild(groupLabel);

    cat.tests.forEach((test) => {
      const key = `${catId}::${test.id}`;
      const label = document.createElement("label");
      label.className = "checkbox-item";
      label.innerHTML = `
        <input type="checkbox" data-test-key="${key}" ${
        state.selectedTests.has(key) ? "checked" : ""
      } />
        <span class="item-text">
          <span class="item-name">${test.name}</span>
          <span class="item-desc">${test.questions.length} questions</span>
        </span>
      `;
      const checkbox = label.querySelector("input");
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.selectedTests.add(key);
        } else {
          state.selectedTests.delete(key);
        }
        updateStartButton();
      });
      testList.appendChild(label);
    });
  });
}

function updateStartButton() {
  startBtn.disabled = state.selectedTests.size === 0;
}

// ---------- QUIZ LOGIC ----------
function startQuiz() {
  // Collect all selected questions
  let questions = [];

  state.selectedTests.forEach((key) => {
    const [catId, testId] = key.split("::");
    const cat = quizData.categories[catId];
    if (!cat) return;
    const test = cat.tests.find((t) => t.id === testId);
    if (!test) return;

    test.questions.forEach((q) => {
      questions.push({
        ...q,
        _category: cat.name,
        _testName: test.name
      });
    });
  });

  if (questions.length === 0) return;

  if (state.randomize) {
    questions = shuffle(questions);
  }

  state.questions = questions;
  state.currentIndex = 0;
  state.answers = [];
  state.quizFinished = false;

  showScreen("quiz");
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  const total = state.questions.length;
  const num = state.currentIndex + 1;

  progressText.textContent = `Question ${num} of ${total}`;
  progressFill.style.width = `${(num / total) * 100}%`;

  questionText.textContent = q.question;
  optionsList.innerHTML = "";
  feedbackBox.className = "feedback-box hidden";
  nextBtn.disabled = true;
  nextBtn.textContent =
    state.currentIndex === total - 1 ? "Finish" : "Next";

  q.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt;
    btn.dataset.index = idx;
    btn.addEventListener("click", () => selectOption(idx));
    optionsList.appendChild(btn);
  });
}

function selectOption(selectedIndex) {
  const q = state.questions[state.currentIndex];
  const buttons = optionsList.querySelectorAll(".option-btn");

  // Prevent re-selection
  if (buttons[0].disabled) return;

  // Record answer
  state.answers[state.currentIndex] = {
    selectedIndex,
    correctIndex: q.correctIndex
  };

  buttons.forEach((btn) => {
    btn.disabled = true;
    const idx = Number(btn.dataset.index);
    if (idx === selectedIndex) btn.classList.add("selected");
  });

  if (state.feedbackMode === "immediate") {
    const isCorrect = selectedIndex === q.correctIndex;
    buttons.forEach((btn) => {
      const idx = Number(btn.dataset.index);
      if (idx === q.correctIndex) btn.classList.add("correct");
      if (idx === selectedIndex && !isCorrect) btn.classList.add("incorrect");
    });

    feedbackBox.classList.remove("hidden");
    feedbackBox.className = `feedback-box ${isCorrect ? "correct" : "incorrect"}`;
    feedbackBox.innerHTML = `
      <strong>${isCorrect ? "Correct!" : "Incorrect"}</strong>
      ${
        q.explanation
          ? `<div class="explanation">${q.explanation}</div>`
          : ""
      }
    `;
  }

  nextBtn.disabled = false;
}

function handleNext() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex++;
    renderQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  state.quizFinished = true;
  showScreen("results");
  renderResults();
}

function renderResults() {
  const total = state.questions.length;
  let correct = 0;

  state.answers.forEach((a) => {
    if (a && a.selectedIndex === a.correctIndex) correct++;
  });

  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  scorePercent.textContent = `${percent}%`;
  scoreDetail.textContent = `You answered ${correct} out of ${total} correctly.`;

  // Color the circle based on score
  const circle = scorePercent.parentElement;
  if (percent >= 80) circle.style.background = "var(--success)";
  else if (percent >= 60) circle.style.background = "#f9ab00";
  else circle.style.background = "var(--error)";

  // Build review list
  reviewList.innerHTML = "";

  state.questions.forEach((q, i) => {
    const answer = state.answers[i];
    const selected = answer ? answer.selectedIndex : -1;
    const isCorrect = selected === q.correctIndex;

    const item = document.createElement("div");
    item.className = `review-item ${isCorrect ? "correct-item" : "incorrect-item"}`;

    let optionsHtml = "<ul class='review-options'>";
    q.options.forEach((opt, idx) => {
      let classes = [];
      if (idx === selected) classes.push("user-choice");
      if (idx === q.correctIndex) classes.push("correct-answer");
      if (idx === selected && idx !== q.correctIndex) classes.push("wrong-choice");

      optionsHtml += `<li class="${classes.join(" ")}">${opt}</li>`;
    });
    optionsHtml += "</ul>";

    item.innerHTML = `
      <div class="review-question">${i + 1}. ${q.question}</div>
      ${optionsHtml}
      ${
        q.explanation
          ? `<div class="review-explanation">${q.explanation}</div>`
          : ""
      }
    `;
    reviewList.appendChild(item);
  });
}

// ---------- HELPERS ----------
function showScreen(name) {
  selectionScreen.classList.remove("active");
  quizScreen.classList.remove("active");
  resultsScreen.classList.remove("active");

  if (name === "selection") selectionScreen.classList.add("active");
  else if (name === "quiz") quizScreen.classList.add("active");
  else if (name === "results") resultsScreen.classList.add("active");
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- START ----------
fetch("tests.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error("Could not load tests.json (status " + response.status + ")");
    }
    return response.json();
  })
  .then((data) => {
    quizData = data;
    init();
  })
  .catch((err) => {
    console.error(err);
    document.body.innerHTML = `
      <div style="max-width:480px;margin:3rem auto;padding:1.5rem;font-family:sans-serif;text-align:center;">
        <h2 style="color:#d93025;">Failed to load tests.json</h2>
        <p style="color:#5f6368;margin-top:0.75rem;">
          Make sure <code>tests.json</code> is in the same folder as this page
          and that you are running a local server (not just opening the HTML file).
        </p>
        <p style="color:#5f6368;margin-top:0.5rem;font-size:0.9rem;">
          Example: <code>npx serve .</code> or <code>python -m http.server</code>
        </p>
      </div>
    `;
  });
