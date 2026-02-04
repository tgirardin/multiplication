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
  bestStreak: 0,
  correct: 0,
  total: 0,
  perTable: {},
  history: [],
  sessionPerTable: {},
  questionMode: "recall",
  isSessionComplete: false,
  hintTimer: null,
  flashTimer: null,
  questionTimer: null,
  toastTimer: null,
};

const storageKey = "memox9_progress_v1";
const historyKey = "memox9_history_v1";

const elements = {
  configView: document.getElementById("config-view"),
  sessionView: document.getElementById("session-view"),
  tableGrid: document.getElementById("table-grid"),
  masteryGrid: document.getElementById("mastery-grid"),
  historyList: document.getElementById("history-list"),
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
  practiceCard: document.getElementById("practice-card"),
  summaryCard: document.getElementById("summary-card"),
  summaryScore: document.getElementById("summary-score"),
  summaryAccuracy: document.getElementById("summary-accuracy"),
  summaryBestStreak: document.getElementById("summary-best-streak"),
  summaryWeak: document.getElementById("summary-weak"),
  summaryReco: document.getElementById("summary-reco"),
  summaryRetryBtn: document.getElementById("summary-retry-btn"),
  summaryTargetBtn: document.getElementById("summary-target-btn"),
  summaryCloseBtn: document.getElementById("summary-close-btn"),
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

function initHistory() {
  const stored = localStorage.getItem(historyKey);
  if (!stored) {
    state.history = [];
    return;
  }
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      state.history = [];
      return;
    }
    state.history = parsed
      .filter((entry) => entry && typeof entry.date === "string")
      .map((entry) => ({
        date: entry.date,
        sessions: Number(entry.sessions) || 0,
        correct: Number(entry.correct) || 0,
        total: Number(entry.total) || 0,
        bestStreak: Number(entry.bestStreak) || 0,
      }));
  } catch {
    state.history = [];
  }
}

function persistHistory() {
  localStorage.setItem(historyKey, JSON.stringify(state.history));
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

function formatDateLabel(dateKey) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  if (!year || !month || !day) return dateKey;
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function renderHistory() {
  elements.historyList.innerHTML = "";
  if (state.history.length === 0) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Aucune séance enregistrée pour le moment.";
    elements.historyList.appendChild(empty);
    return;
  }

  const entries = [...state.history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  entries.forEach((entry) => {
    const accuracy = entry.total ? Math.round((entry.correct / entry.total) * 100) : 0;
    const card = document.createElement("article");
    card.className = "history-item";
    card.innerHTML = `
      <div class="history-head">
        <strong>${formatDateLabel(entry.date)}</strong>
        <span class="history-meta">${entry.sessions} séance${entry.sessions > 1 ? "s" : ""} · ${entry.correct} / ${entry.total}</span>
      </div>
      <div class="history-bar">
        <div class="history-fill" style="width:${accuracy}%"></div>
      </div>
      <span class="history-meta">Exactitude du jour: ${accuracy}% · Meilleure série: ${entry.bestStreak}</span>
    `;
    elements.historyList.appendChild(card);
  });
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

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeakestTables(limit = 2) {
  const totalAttempts = tables.reduce((sum, table) => sum + state.perTable[table].total, 0);
  if (totalAttempts === 0) {
    return [2, 3].slice(0, limit);
  }

  const ranked = tables
    .map((table) => {
      const stats = state.perTable[table];
      const accuracy = stats.total ? stats.correct / stats.total : 0;
      const confidence = Math.min(stats.total, 18) / 18;
      const weakness = (1 - accuracy) * 0.75 + (1 - confidence) * 0.25;
      return { table, weakness, accuracy, total: stats.total };
    })
    .sort(
      (a, b) =>
        b.weakness - a.weakness ||
        a.accuracy - b.accuracy ||
        a.total - b.total ||
        a.table - b.table,
    );
  return ranked.slice(0, limit).map((item) => item.table);
}

function applyTargetedSelection() {
  const weakest = getWeakestTables(2);
  if (weakest.length === 0) return [];
  state.selected = new Set(weakest);
  renderTables();
  return weakest;
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

function initSessionTableStats() {
  state.sessionPerTable = {};
  tables.forEach((table) => {
    state.sessionPerTable[table] = { correct: 0, total: 0 };
  });
}

function getSessionWeakTables(limit = 2) {
  const attempted = tables
    .map((table) => {
      const stats = state.sessionPerTable[table];
      const accuracy = stats.total ? stats.correct / stats.total : 1;
      return { table, accuracy, total: stats.total };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total || a.table - b.table);
  return attempted.slice(0, limit).map((item) => item.table);
}

function buildRecommendation(accuracy, weakTables) {
  if (accuracy >= 90) {
    return "Excellent travail. Passez en mode flash ou augmentez le volume pour consolider.";
  }
  if (weakTables.length >= 2) {
    return `Priorité: relancer une séance ciblée sur les tables ${weakTables[0]} et ${weakTables[1]}.`;
  }
  if (weakTables.length === 1) {
    return `Priorité: retravailler la table ${weakTables[0]} avec des séries courtes en rappel actif.`;
  }
  return "Refaites une séance courte pour stabiliser les acquis du jour.";
}

function pushHistoryEntry() {
  const day = getTodayKey();
  const existing = state.history.find((entry) => entry.date === day);
  if (existing) {
    existing.sessions += 1;
    existing.correct += state.correct;
    existing.total += state.total;
    existing.bestStreak = Math.max(existing.bestStreak, state.bestStreak);
  } else {
    state.history.push({
      date: day,
      sessions: 1,
      correct: state.correct,
      total: state.total,
      bestStreak: state.bestStreak,
    });
  }
  state.history = state.history
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-90);
  persistHistory();
  renderHistory();
}

function showSessionSummary() {
  const accuracy = state.total ? Math.round((state.correct / state.total) * 100) : 0;
  const weakTables = getSessionWeakTables(2);
  elements.summaryScore.textContent = `${state.correct} / ${state.total}`;
  elements.summaryAccuracy.textContent = `${accuracy}%`;
  elements.summaryBestStreak.textContent = `${state.bestStreak}`;
  elements.summaryWeak.textContent = weakTables.length
    ? `Tables à renforcer: ${weakTables.join(" et ")}`
    : "Tables à renforcer: aucune (séance équilibrée).";
  elements.summaryReco.textContent = `Conseil: ${buildRecommendation(accuracy, weakTables)}`;
  elements.practiceCard.hidden = true;
  elements.summaryCard.hidden = false;
}

function completeSession() {
  if (state.isSessionComplete) return;
  state.isSessionComplete = true;
  state.current = null;
  clearTimers();
  elements.timer.classList.remove("active");
  elements.timerBar.style.width = "100%";
  elements.timerBar.style.transition = "none";
  elements.question.textContent = "Séance terminée.";
  elements.sessionMeta.textContent = "Analyse de vos résultats.";
  pushHistoryEntry();
  showSessionSummary();
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
  if (!state.autoHint || state.questionMode === "flash") {
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
    handleTimeOut();
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
  document.body.dataset.view = isSession ? "session" : "config";
  if (isSession) {
    elements.configView.classList.add("view-hidden");
    elements.sessionView.classList.remove("view-hidden");
    elements.configView.hidden = true;
    elements.sessionView.hidden = false;
  } else {
    elements.sessionView.classList.add("view-hidden");
    elements.configView.classList.remove("view-hidden");
    elements.sessionView.hidden = true;
    elements.configView.hidden = false;
  }
}

function resetSessionUI() {
  clearTimers();
  state.queue = [];
  state.index = 0;
  state.current = null;
  state.isSessionComplete = false;
  elements.question.textContent = "—";
  elements.sessionMeta.textContent = "Prêt à commencer.";
  elements.feedback.textContent = "";
  elements.answerInput.value = "";
  setHint("Indice prêt.");
  elements.choices.innerHTML = "";
  elements.practiceCard.hidden = false;
  elements.summaryCard.hidden = true;
  elements.timer.classList.remove("active");
  elements.timerBar.style.width = "0%";
  elements.timerBar.style.transition = "none";
  elements.progressLabel.textContent = "0 / 0";
  elements.progressFill.style.width = "0%";
  state.questionMode = "recall";
}

function setMode(mode) {
  state.mode = mode;
  const target = document.querySelector(`input[name="mode"][value="${mode}"]`);
  if (target) {
    target.checked = true;
  }
}

function setModeUI(mode = state.mode) {
  if (mode === "flash") {
    elements.answerArea.style.display = "none";
    elements.choices.style.display = "flex";
  } else {
    elements.answerArea.style.display = "flex";
    elements.choices.style.display = "none";
  }
}

function resolveQuestionMode(table) {
  if (state.mode === "flash" || state.mode === "recall") {
    return state.mode;
  }
  const stats = state.perTable[table];
  const accuracy = stats.total ? stats.correct / stats.total : 0;
  if (state.mode === "targeted") {
    return accuracy >= 0.75 ? (Math.random() < 0.45 ? "flash" : "recall") : "recall";
  }
  if (accuracy >= 0.7) {
    return Math.random() < 0.65 ? "flash" : "recall";
  }
  return Math.random() < 0.8 ? "recall" : "flash";
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
    completeSession();
    return;
  }

  state.current = state.queue[state.index];
  const { table, multiplier } = state.current;
  state.questionMode = resolveQuestionMode(table);
  setModeUI(state.questionMode);
  elements.question.textContent = `${table} × ${multiplier} = ?`;
  elements.sessionMeta.textContent = `Table ${table} · Question ${state.index + 1} · ${state.questionMode === "flash" ? "Flash" : "Rappel"}`;
  updateProgressUI();
  startHintTimer();
  if (state.questionMode === "flash") {
    buildChoices();
    startFlashTimer();
  } else {
    startQuestionTimer();
  }
}

function recordResult(isCorrect) {
  const { table } = state.current;
  const stats = state.perTable[table];
  const sessionStats = state.sessionPerTable[table];
  stats.total += 1;
  sessionStats.total += 1;
  if (isCorrect) {
    stats.correct += 1;
    sessionStats.correct += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
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
  if (!state.current || state.questionMode === "flash") return false;
  clearTimers();
  const { table, multiplier } = state.current;
  const answer = table * multiplier;
  const value = Number(elements.answerInput.value);
  if (!Number.isFinite(value)) {
    elements.feedback.textContent = "Entrez une réponse.";
    elements.feedback.style.color = "var(--muted)";
    return false;
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
  return true;
}

function handleChoice(value) {
  if (!state.current || state.questionMode !== "flash") return;
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
  if (state.mode === "targeted") {
    const tablesPicked = applyTargetedSelection();
    if (tablesPicked.length === 0) {
      elements.sessionMeta.textContent = "Impossible de déterminer des tables ciblées.";
      return;
    }
    showToast(`Révision ciblée: tables ${tablesPicked.join(" et ")}`, true);
  } else if (state.selected.size === 0) {
    elements.sessionMeta.textContent = "Sélectionnez au moins une table.";
    return;
  }
  resetSessionUI();
  state.correct = 0;
  state.total = 0;
  state.streak = 0;
  state.bestStreak = 0;
  renderStats();
  initSessionTableStats();
  buildQueue();
  if (state.queue.length === 0) {
    elements.sessionMeta.textContent = "Aucune question générée pour cette session.";
    return;
  }
  setModeUI("recall");
  updateProgressUI();
  setView(true);
  nextQuestion();
}

function resetProgress() {
  if (!confirm("Réinitialiser toute la maîtrise et l'historique enregistrés ?")) return;
  tables.forEach((table) => {
    state.perTable[table] = { correct: 0, total: 0 };
  });
  state.history = [];
  persistProgress();
  persistHistory();
  renderMastery();
  renderHistory();
  renderStats();
}

document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener("change", (event) => {
    setMode(event.target.value);
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
elements.summaryRetryBtn.addEventListener("click", startSession);
elements.summaryTargetBtn.addEventListener("click", () => {
  setMode("targeted");
  setModeUI();
  startSession();
});
elements.summaryCloseBtn.addEventListener("click", stopSession);
elements.selectAll.addEventListener("click", () => selectTables(tables));
elements.selectNone.addEventListener("click", () => selectTables([]));
elements.selectCore.addEventListener("click", () => selectTables([2, 3, 4, 5, 6]));

elements.checkBtn.addEventListener("click", () => {
  if (checkAnswer()) {
    nextQuestion();
  }
});

elements.revealBtn.addEventListener("click", revealAnswer);
elements.nextBtn.addEventListener("click", nextQuestion);

elements.answerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    if (checkAnswer()) {
      nextQuestion();
    }
  }
});

initProgress();
initHistory();
initSessionTableStats();
renderTables();
renderMastery();
renderHistory();
renderStats();
updateRangeDisplay();
setView(false);
