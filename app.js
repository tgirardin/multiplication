const tables = Array.from({ length: 9 }, (_, i) => i + 1);
const state = {
  selected: new Set(tables),
  mode: "recall",
  questions: 18,
  flashDelay: 6,
  timeLimit: 8,
  autoHint: true,
  queue: [],
  index: 0,
  current: null,
  streak: 0,
  correct: 0,
  total: 0,
  perTable: {},
  hintTimer: null,
  flashTimer: null,
  questionTimer: null,
  toastTimer: null,
};

const storageKey = "memox9_progress_v1";

const elements = {
  configView: document.getElementById("config-view"),
  sessionView: document.getElementById("session-view"),
  tableGrid: document.getElementById("table-grid"),
  masteryGrid: document.getElementById("mastery-grid"),
  startBtn: document.getElementById("start-btn"),
  resetBtn: document.getElementById("reset-btn"),
  selectAll: document.getElementById("select-all"),
  selectNone: document.getElementById("select-none"),
  selectCore: document.getElementById("select-core"),
  questionCount: document.getElementById("question-count"),
  questionCountValue: document.getElementById("question-count-value"),
  flashDelay: document.getElementById("flash-delay"),
  flashDelayValue: document.getElementById("flash-delay-value"),
  timeLimit: document.getElementById("time-limit"),
  timeLimitValue: document.getElementById("time-limit-value"),
  autoHint: document.getElementById("auto-hint"),
  sessionMeta: document.getElementById("session-meta"),
  progressLabel: document.getElementById("progress-label"),
  progressFill: document.getElementById("progress-fill"),
  question: document.getElementById("question"),
  hint: document.getElementById("hint"),
  answerArea: document.getElementById("answer-area"),
  answerInput: document.getElementById("answer-input"),
  checkBtn: document.getElementById("check-btn"),
  revealBtn: document.getElementById("reveal-btn"),
  nextBtn: document.getElementById("next-btn"),
  feedback: document.getElementById("feedback"),
  choices: document.getElementById("choices"),
  timer: document.getElementById("timer"),
  timerBar: document.getElementById("timer-bar"),
  stopBtn: document.getElementById("stop-btn"),
  masteryGlobal: document.getElementById("mastery-global"),
  streak: document.getElementById("streak"),
  accuracy: document.getElementById("accuracy"),
  toast: document.getElementById("toast"),
};

function initProgress() {
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    state.perTable = JSON.parse(stored);
    tables.forEach((table) => {
      if (!state.perTable[table]) {
        state.perTable[table] = { correct: 0, total: 0 };
      }
    });
  } else {
    tables.forEach((table) => {
      state.perTable[table] = { correct: 0, total: 0 };
    });
  }
}

function persistProgress() {
  localStorage.setItem(storageKey, JSON.stringify(state.perTable));
}

function renderTables() {
  elements.tableGrid.innerHTML = "";
  tables.forEach((table) => {
    const btn = document.createElement("button");
    btn.className = "table-btn";
    btn.type = "button";
    btn.textContent = `Table ${table}`;
    if (state.selected.has(table)) {
      btn.classList.add("active");
    }
    btn.addEventListener("click", () => toggleTable(table, btn));
    elements.tableGrid.appendChild(btn);
  });
}

function renderMastery() {
  elements.masteryGrid.innerHTML = "";
  let globalCorrect = 0;
  let globalTotal = 0;
  tables.forEach((table) => {
    const stats = state.perTable[table];
    const accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
    globalCorrect += stats.correct;
    globalTotal += stats.total;

    const card = document.createElement("div");
    card.className = "mastery-card";
    card.innerHTML = `
      <strong>Table ${table}</strong>
      <span>${stats.correct} / ${stats.total} réussites</span>
      <div class="mastery-bar">
        <div class="mastery-fill" style="width:${accuracy}%"></div>
      </div>
      <span>${accuracy}% de maîtrise</span>
    `;
    elements.masteryGrid.appendChild(card);
  });

  const globalAccuracy = globalTotal ? Math.round((globalCorrect / globalTotal) * 100) : 0;
  elements.masteryGlobal.textContent = `${globalAccuracy}%`;
}

function renderStats() {
  const accuracy = state.total ? Math.round((state.correct / state.total) * 100) : 0;
  elements.streak.textContent = state.streak.toString();
  elements.accuracy.textContent = `${accuracy}%`;
}

function toggleTable(table, btn) {
  if (state.selected.has(table)) {
    state.selected.delete(table);
    btn.classList.remove("active");
  } else {
    state.selected.add(table);
    btn.classList.add("active");
  }
}

function selectTables(set) {
  state.selected = new Set(set);
  renderTables();
}

function updateRangeDisplay() {
  elements.questionCountValue.textContent = state.questions;
  elements.flashDelayValue.textContent = state.flashDelay;
  elements.timeLimitValue.textContent = state.timeLimit;
}

function weightedTablePick() {
  const choices = Array.from(state.selected);
  if (choices.length === 0) {
    return null;
  }
  const weights = choices.map((table) => {
    const stats = state.perTable[table];
    const accuracy = stats.total ? stats.correct / stats.total : 0;
    return 1 - accuracy + 0.2;
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < choices.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      return choices[i];
    }
  }
  return choices[choices.length - 1];
}

function buildQueue() {
  state.queue = [];
  const lastPairs = [];
  for (let i = 0; i < state.questions; i += 1) {
    const table = weightedTablePick();
    if (!table) break;
    let multiplier = Math.ceil(Math.random() * 9);
    let attempts = 0;
    while (attempts < 6 && lastPairs.includes(`${table}-${multiplier}`)) {
      multiplier = Math.ceil(Math.random() * 9);
      attempts += 1;
    }
    lastPairs.push(`${table}-${multiplier}`);
    if (lastPairs.length > 4) lastPairs.shift();
    state.queue.push({ table, multiplier });
  }
}

function updateProgressUI() {
  elements.progressLabel.textContent = `${state.index} / ${state.queue.length}`;
  const ratio = state.queue.length ? (state.index / state.queue.length) * 100 : 0;
  elements.progressFill.style.width = `${ratio}%`;
}

function setHint(text) {
  elements.hint.textContent = text;
}

function clearTimers() {
  if (state.hintTimer) {
    clearTimeout(state.hintTimer);
    state.hintTimer = null;
  }
  if (state.flashTimer) {
    clearTimeout(state.flashTimer);
    state.flashTimer = null;
  }
  if (state.questionTimer) {
    clearTimeout(state.questionTimer);
    state.questionTimer = null;
  }
}

function startHintTimer() {
  clearTimeout(state.hintTimer);
  if (!state.autoHint || state.mode === "flash") {
    return;
  }
  state.hintTimer = setTimeout(() => {
    const { table, multiplier } = state.current;
    setHint(`Indice: ${table} × ${multiplier} = ${table} × ${multiplier - 1} + ${table}`);
  }, 5000);
}

function startFlashTimer() {
  clearTimeout(state.flashTimer);
  elements.timer.classList.add("active");
  elements.timerBar.style.transition = "none";
  elements.timerBar.style.width = "0%";
  requestAnimationFrame(() => {
    elements.timerBar.style.transition = `width ${state.flashDelay}s linear`;
    elements.timerBar.style.width = "100%";
  });
  state.flashTimer = setTimeout(() => {
    revealAnswer();
  }, state.flashDelay * 1000);
}

function startQuestionTimer() {
  clearTimeout(state.questionTimer);
  elements.timer.classList.add("active");
  elements.timerBar.style.transition = "none";
  elements.timerBar.style.width = "0%";
  requestAnimationFrame(() => {
    elements.timerBar.style.transition = `width ${state.timeLimit}s linear`;
    elements.timerBar.style.width = "100%";
  });
  state.questionTimer = setTimeout(() => {
    handleTimeOut();
  }, state.timeLimit * 1000);
}

function showToast(message, isPositive) {
  const toast = elements.toast;
  toast.textContent = message;
  toast.classList.toggle("good", isPositive);
  toast.classList.toggle("bad", !isPositive);
  toast.classList.add("show");
  if (state.toastTimer) clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1200);
}

function setView(isSession) {
  if (isSession) {
    elements.configView.classList.add("view-hidden");
    elements.sessionView.classList.remove("view-hidden");
  } else {
    elements.sessionView.classList.add("view-hidden");
    elements.configView.classList.remove("view-hidden");
  }
}

function resetSessionUI() {
  clearTimers();
  state.queue = [];
  state.index = 0;
  state.current = null;
  elements.question.textContent = "—";
  elements.sessionMeta.textContent = "Prêt à commencer.";
  elements.feedback.textContent = "";
  elements.answerInput.value = "";
  setHint("Indice prêt.");
  elements.choices.innerHTML = "";
  elements.timer.classList.remove("active");
  elements.timerBar.style.width = "0%";
  elements.timerBar.style.transition = "none";
  elements.progressLabel.textContent = "0 / 0";
  elements.progressFill.style.width = "0%";
}

function setModeUI() {
  if (state.mode === "flash") {
    elements.answerArea.style.display = "none";
    elements.choices.style.display = "flex";
  } else {
    elements.answerArea.style.display = "flex";
    elements.choices.style.display = "none";
  }
}

function nextQuestion() {
  clearTimers();
  elements.timer.classList.remove("active");
  elements.timerBar.style.width = "0%";
  elements.timerBar.style.transition = "none";
  elements.feedback.textContent = "";
  elements.answerInput.value = "";
  setHint("Indice prêt.");
  elements.choices.innerHTML = "";

  if (state.index >= state.queue.length) {
    elements.question.textContent = "Séance terminée.";
    elements.sessionMeta.textContent = "Bravo, votre cerveau a travaillé efficacement.";
    return;
  }

  state.current = state.queue[state.index];
  const { table, multiplier } = state.current;
  elements.question.textContent = `${table} × ${multiplier} = ?`;
  elements.sessionMeta.textContent = `Table ${table} · Question ${state.index + 1}`;
  updateProgressUI();
  startHintTimer();
  if (state.mode === "flash") {
    buildChoices();
  }
  startQuestionTimer();
}

function recordResult(isCorrect) {
  const { table } = state.current;
  const stats = state.perTable[table];
  stats.total += 1;
  if (isCorrect) {
    stats.correct += 1;
    state.streak += 1;
  } else {
    state.streak = 0;
  }
  state.total += 1;
  if (isCorrect) state.correct += 1;
  persistProgress();
  renderMastery();
  renderStats();
}

function revealAnswer() {
  const { table, multiplier } = state.current;
  const answer = table * multiplier;
  elements.feedback.textContent = `Réponse: ${answer}`;
  elements.feedback.style.color = "var(--muted)";
}

function checkAnswer() {
  if (!state.current) return;
  clearTimers();
  const { table, multiplier } = state.current;
  const answer = table * multiplier;
  const value = Number(elements.answerInput.value);
  if (!Number.isFinite(value)) {
    elements.feedback.textContent = "Entrez une réponse.";
    elements.feedback.style.color = "var(--muted)";
    return;
  }
  if (value === answer) {
    elements.feedback.textContent = "Exact.";
    elements.feedback.style.color = "var(--accent-strong)";
    recordResult(true);
    showToast("Juste.", true);
  } else {
    elements.feedback.textContent = `Incorrect. ${table} × ${multiplier} = ${answer}`;
    elements.feedback.style.color = "#8f3f2f";
    recordResult(false);
    showToast("Faux.", false);
  }
  state.index += 1;
  updateProgressUI();
}

function handleChoice(value) {
  if (!state.current) return;
  clearTimers();
  const { table, multiplier } = state.current;
  const answer = table * multiplier;
  if (value === answer) {
    recordResult(true);
    showToast("Juste.", true);
    elements.feedback.textContent = "Exact.";
    elements.feedback.style.color = "var(--accent-strong)";
  } else {
    recordResult(false);
    showToast("Faux.", false);
    elements.feedback.textContent = `Incorrect. ${table} × ${multiplier} = ${answer}`;
    elements.feedback.style.color = "#8f3f2f";
  }
  state.index += 1;
  updateProgressUI();
  nextQuestion();
}

function buildChoices() {
  const { table, multiplier } = state.current;
  const correct = table * multiplier;
  const choices = new Set([correct]);
  while (choices.size < 3) {
    const altMultiplier = Math.ceil(Math.random() * 9);
    if (altMultiplier === multiplier) continue;
    choices.add(table * altMultiplier);
  }
  const shuffled = Array.from(choices).sort(() => Math.random() - 0.5);
  elements.choices.innerHTML = "";
  shuffled.forEach((value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-btn";
    btn.textContent = value.toString();
    btn.addEventListener("click", () => handleChoice(value));
    elements.choices.appendChild(btn);
  });
}

function handleTimeOut() {
  if (!state.current) return;
  const { table, multiplier } = state.current;
  recordResult(false);
  showToast(`Temps écoulé · ${table} × ${multiplier} = ${table * multiplier}`, false);
  state.index += 1;
  updateProgressUI();
  nextQuestion();
}

function stopSession() {
  resetSessionUI();
  setView(false);
}

function startSession() {
  if (state.selected.size === 0) {
    elements.sessionMeta.textContent = "Sélectionnez au moins une table.";
    return;
  }
  state.queue = [];
  state.index = 0;
  state.correct = 0;
  state.total = 0;
  state.streak = 0;
  buildQueue();
  setModeUI();
  updateProgressUI();
  setView(true);
  nextQuestion();
}

function resetProgress() {
  if (!confirm("Réinitialiser toute la maîtrise enregistrée ?")) return;
  tables.forEach((table) => {
    state.perTable[table] = { correct: 0, total: 0 };
  });
  persistProgress();
  renderMastery();
  renderStats();
}

document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener("change", (event) => {
    state.mode = event.target.value;
    setModeUI();
  });
});

elements.questionCount.addEventListener("input", (event) => {
  state.questions = Number(event.target.value);
  updateRangeDisplay();
});

elements.flashDelay.addEventListener("input", (event) => {
  state.flashDelay = Number(event.target.value);
  updateRangeDisplay();
});

elements.timeLimit.addEventListener("input", (event) => {
  state.timeLimit = Number(event.target.value);
  updateRangeDisplay();
});

elements.autoHint.addEventListener("change", (event) => {
  state.autoHint = event.target.checked;
});

elements.startBtn.addEventListener("click", startSession);
elements.stopBtn.addEventListener("click", stopSession);
elements.resetBtn.addEventListener("click", resetProgress);
elements.selectAll.addEventListener("click", () => selectTables(tables));
elements.selectNone.addEventListener("click", () => selectTables([]));
elements.selectCore.addEventListener("click", () => selectTables([2, 3, 4, 5, 6]));

elements.checkBtn.addEventListener("click", () => {
  checkAnswer();
  nextQuestion();
});

elements.revealBtn.addEventListener("click", revealAnswer);
elements.nextBtn.addEventListener("click", nextQuestion);

elements.answerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    checkAnswer();
    nextQuestion();
  }
});

initProgress();
renderTables();
renderMastery();
renderStats();
updateRangeDisplay();
setView(false);
