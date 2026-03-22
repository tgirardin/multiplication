(() => {
  const core = window.MEMOX9Core;
  const storageUtils = window.MEMOX9Storage;

  if (!core || !storageUtils) {
    console.error("MÉMOx9: dépendances de démarrage manquantes.");
    return;
  }

  const DEFAULTS = {
    mode: "choice",
    selectedTables: [2, 3, 4, 5, 6],
    questions: 16,
    choiceDelay: 2,
    timeLimit: 7,
  };

  const storageKey = "memox9_progress_v1";
  const historyKey = "memox9_history_v1";
  const summaryKey = "memox9_last_session_v1";
  const store = storageUtils.createSafeStorage(window.localStorage);

  const elements = {
    body: document.body,
    screens: {
      config: document.getElementById("config-screen"),
      play: document.getElementById("play-screen"),
      results: document.getElementById("results-screen"),
    },
    versionBadge: document.getElementById("version-badge"),
    tableGrid: document.getElementById("table-grid"),
    tablesCard: document.getElementById("tables-card"),
    selectionNote: document.getElementById("selection-note"),
    launchInline: document.getElementById("launch-inline"),
    questionCount: document.getElementById("question-count"),
    questionCountValue: document.getElementById("question-count-value"),
    choiceDelay: document.getElementById("choice-delay"),
    choiceDelayValue: document.getElementById("choice-delay-value"),
    timeLimit: document.getElementById("time-limit"),
    timeLimitValue: document.getElementById("time-limit-value"),
    startBtn: document.getElementById("start-btn"),
    resetBtn: document.getElementById("reset-btn"),
    selectAll: document.getElementById("select-all"),
    selectNone: document.getElementById("select-none"),
    selectCore: document.getElementById("select-core"),
    stopBtn: document.getElementById("stop-btn"),
    progressLabel: document.getElementById("progress-label"),
    progressFill: document.getElementById("progress-fill"),
    playKicker: document.getElementById("play-kicker"),
    sessionMeta: document.getElementById("session-meta"),
    timerBar: document.getElementById("timer-bar"),
    question: document.getElementById("question"),
    choiceStage: document.getElementById("choice-stage"),
    choices: document.getElementById("choices"),
    feedback: document.getElementById("feedback"),
    resultsTitle: document.getElementById("results-title"),
    resultsSubtitle: document.getElementById("results-subtitle"),
    summaryScore: document.getElementById("summary-score"),
    summaryAccuracy: document.getElementById("summary-accuracy"),
    summaryBestStreak: document.getElementById("summary-best-streak"),
    summaryWeak: document.getElementById("summary-weak"),
    summaryReco: document.getElementById("summary-reco"),
    summaryRetryBtn: document.getElementById("summary-retry-btn"),
    summaryTargetBtn: document.getElementById("summary-target-btn"),
    backConfigBtn: document.getElementById("back-config-btn"),
    masteryGlobal: document.getElementById("mastery-global"),
    bestStreakGlobal: document.getElementById("best-streak-global"),
    accuracyGlobal: document.getElementById("accuracy-global"),
    masteryGrid: document.getElementById("mastery-grid"),
    historyList: document.getElementById("history-list"),
    toast: document.getElementById("toast"),
  };

  const requiredElements = [
    elements.body,
    elements.screens.config,
    elements.screens.play,
    elements.screens.results,
    elements.tableGrid,
    elements.tablesCard,
    elements.selectionNote,
    elements.launchInline,
    elements.questionCount,
    elements.questionCountValue,
    elements.choiceDelay,
    elements.choiceDelayValue,
    elements.timeLimit,
    elements.timeLimitValue,
    elements.startBtn,
    elements.resetBtn,
    elements.selectAll,
    elements.selectNone,
    elements.selectCore,
    elements.stopBtn,
    elements.progressLabel,
    elements.progressFill,
    elements.playKicker,
    elements.sessionMeta,
    elements.timerBar,
    elements.question,
    elements.choiceStage,
    elements.choices,
    elements.feedback,
    elements.resultsTitle,
    elements.resultsSubtitle,
    elements.summaryScore,
    elements.summaryAccuracy,
    elements.summaryBestStreak,
    elements.summaryWeak,
    elements.summaryReco,
    elements.summaryRetryBtn,
    elements.summaryTargetBtn,
    elements.backConfigBtn,
    elements.masteryGlobal,
    elements.bestStreakGlobal,
    elements.accuracyGlobal,
    elements.masteryGrid,
    elements.historyList,
  ];

  if (requiredElements.some((element) => !element)) {
    console.warn("MÉMOx9: page ignorée, contrat DOM incomplet.");
    return;
  }

  const state = {
    progress: core.sanitizeProgress(storageUtils.readJson(store, storageKey, {})),
    history: core.sanitizeHistory(storageUtils.readJson(store, historyKey, [])),
    lastSummary: core.sanitizeSummary(storageUtils.readJson(store, summaryKey, null)),
    selected: new Set(DEFAULTS.selectedTables),
    mode: DEFAULTS.mode,
    questions: DEFAULTS.questions,
    choiceDelay: DEFAULTS.choiceDelay,
    timeLimit: DEFAULTS.timeLimit,
    session: null,
    lastSessionConfig: null,
    revealTimer: 0,
    questionTimer: 0,
    advanceTimer: 0,
  };

  function persistProgress() {
    storageUtils.writeJson(store, storageKey, state.progress);
  }

  function persistHistory() {
    storageUtils.writeJson(store, historyKey, state.history);
  }

  function persistLastSummary(summary) {
    storageUtils.writeJson(store, summaryKey, summary);
  }

  function renderVersionBadge() {
    if (elements.versionBadge && window.MEMOX9_VERSION) {
      elements.versionBadge.textContent = `v ${window.MEMOX9_VERSION.label}`;
    }
  }

  function getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
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

  function readCheckedMode() {
    const checkedMode = document.querySelector('input[name="mode"]:checked');
    return checkedMode?.value === "targeted" ? "targeted" : "choice";
  }

  function readNumericValue(input, fallback) {
    const numeric = Number(input.value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function syncStateFromControls() {
    state.mode = readCheckedMode();
    state.questions = readNumericValue(elements.questionCount, DEFAULTS.questions);
    state.choiceDelay = readNumericValue(elements.choiceDelay, DEFAULTS.choiceDelay);
    state.timeLimit = readNumericValue(elements.timeLimit, DEFAULTS.timeLimit);
    clampTimeLimit();
  }

  function computeLaunchMessage(selectedTables) {
    if (!selectedTables.length) {
      return "Ajoute au moins une table pour lancer la séance.";
    }
    return "La séance s'ouvrira directement sur le jeu.";
  }

  function renderMasteryGrid() {
    elements.masteryGrid.innerHTML = "";

    core.tables.forEach((table) => {
      const stats = state.progress[table];
      const accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
      const card = document.createElement("article");
      card.className = "mastery-card";
      card.innerHTML = `
        <strong>Table ${table}</strong>
        <span>${stats.correct} / ${stats.total} réussites</span>
        <div class="mastery-bar"><div class="mastery-fill" style="width:${accuracy}%"></div></div>
        <span>${accuracy}% de maîtrise</span>
      `;
      elements.masteryGrid.appendChild(card);
    });
  }

  function renderHistoryList() {
    elements.historyList.innerHTML = "";

    if (state.history.length === 0) {
      const empty = document.createElement("p");
      empty.className = "history-empty";
      empty.textContent = "Aucune séance enregistrée pour le moment.";
      elements.historyList.appendChild(empty);
      return;
    }

    [...state.history]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 12)
      .forEach((entry) => {
        const accuracy = entry.total ? Math.round((entry.correct / entry.total) * 100) : 0;
        const item = document.createElement("article");
        item.className = "history-item";
        item.innerHTML = `
          <div class="history-head">
            <strong>${formatDateLabel(entry.date)}</strong>
            <span class="history-meta">${entry.sessions} séance${entry.sessions > 1 ? "s" : ""} · ${entry.correct} / ${entry.total}</span>
          </div>
          <div class="history-bar"><div class="history-fill" style="width:${accuracy}%"></div></div>
          <span class="history-meta">Exactitude du jour: ${accuracy}% · Meilleure série: ${entry.bestStreak}</span>
        `;
        elements.historyList.appendChild(item);
      });
  }

  function renderToast(message, tone = "good") {
    if (!elements.toast) return;

    elements.toast.textContent = message;
    elements.toast.classList.remove("good", "bad", "show");
    elements.toast.classList.add(tone, "show");
    window.clearTimeout(elements.toast._timer);
    elements.toast._timer = window.setTimeout(() => {
      elements.toast.classList.remove("show");
    }, 1500);
  }

  function switchScreen(nextScreen) {
    elements.body.dataset.screen = nextScreen;

    Object.entries(elements.screens).forEach(([screenName, screen]) => {
      const active = screenName === nextScreen;
      screen.classList.toggle("is-active", active);
      screen.setAttribute("aria-hidden", String(!active));

      if (active && screenName === "results") {
        screen.scrollTop = 0;
      }
    });

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function buildTableButtons() {
    elements.tableGrid.innerHTML = "";

    core.tables.forEach((table) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "table-btn";
      button.dataset.table = String(table);
      button.textContent = `Table ${table}`;
      button.addEventListener("click", () => {
        if (state.mode === "targeted") {
          return;
        }

        if (state.selected.has(table)) {
          state.selected.delete(table);
        } else {
          state.selected.add(table);
        }

        renderTableButtonsState();
        renderSelectionNote();
      });
      elements.tableGrid.appendChild(button);
    });

    renderTableButtonsState();
  }

  function renderTableButtonsState() {
    const isTargeted = state.mode === "targeted";
    elements.tablesCard.classList.toggle("is-muted", isTargeted);

    elements.tableGrid.querySelectorAll(".table-btn").forEach((button) => {
      const table = Number(button.dataset.table);
      button.classList.toggle("is-active", state.selected.has(table));
      button.disabled = isTargeted;
    });

    [elements.selectAll, elements.selectNone, elements.selectCore].forEach((button) => {
      button.disabled = isTargeted;
    });
  }

  function clampTimeLimit() {
    const minLimit = Math.min(14, state.choiceDelay + 2);
    elements.timeLimit.min = String(minLimit);

    if (state.timeLimit < minLimit) {
      state.timeLimit = minLimit;
      elements.timeLimit.value = String(minLimit);
    }
  }

  function renderControlValues() {
    clampTimeLimit();
    elements.questionCountValue.textContent = String(state.questions);
    elements.choiceDelayValue.textContent = `${state.choiceDelay} s`;
    elements.timeLimitValue.textContent = `${state.timeLimit} s`;
  }

  function renderSelectionNote() {
    const weakest = core.getWeakestTables(state.progress, 2);

    if (state.mode === "targeted") {
      elements.selectionNote.textContent = `Tables ciblées automatiquement: ${weakest
        .map((table) => `table ${table}`)
        .join(" et ")}.`;
      elements.launchInline.textContent = `Mode ciblé prêt. La séance démarrera directement sur ${weakest.join(" et ")}.`;
      return;
    }

    const selectedTables = Array.from(state.selected).sort((a, b) => a - b);
    elements.selectionNote.textContent = selectedTables.length
      ? `Tables actives: ${selectedTables.join(", ")}.`
      : "Sélection vide: choisis au moins une table pour lancer la séance.";
    elements.launchInline.textContent = computeLaunchMessage(selectedTables);
  }

  function renderPersistentStats() {
    elements.masteryGlobal.textContent = `${core.computeGlobalMastery(state.progress)}%`;
    elements.bestStreakGlobal.textContent = String(core.computeGlobalBestStreak(state.history, state.lastSummary));
    elements.accuracyGlobal.textContent = `${state.lastSummary?.accuracy || 0}%`;
    renderMasteryGrid();
    renderHistoryList();
    renderSelectionNote();
  }

  function initHelpPopovers() {
    const wraps = Array.from(document.querySelectorAll(".help-wrap"));

    function closeAll(except = null) {
      wraps.forEach((wrap) => {
        const keepOpen = except && wrap === except;
        wrap.classList.toggle("is-open", keepOpen);
        const trigger = wrap.querySelector(".help-trigger");
        if (trigger) {
          trigger.setAttribute("aria-expanded", keepOpen ? "true" : "false");
        }
      });
    }

    wraps.forEach((wrap) => {
      const trigger = wrap.querySelector(".help-trigger");
      if (!trigger) return;

      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const shouldOpen = !wrap.classList.contains("is-open");
        closeAll(shouldOpen ? wrap : null);
      });
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".help-wrap")) {
        closeAll();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAll();
      }
    });
  }

  function bindEvents() {
    document.querySelectorAll('input[name="mode"]').forEach((input) => {
      input.addEventListener("change", () => {
        state.mode = readCheckedMode();
        renderTableButtonsState();
        renderSelectionNote();
      });
    });

    elements.questionCount.addEventListener("input", () => {
      state.questions = readNumericValue(elements.questionCount, DEFAULTS.questions);
      renderControlValues();
    });

    elements.choiceDelay.addEventListener("input", () => {
      state.choiceDelay = readNumericValue(elements.choiceDelay, DEFAULTS.choiceDelay);
      renderControlValues();
    });

    elements.timeLimit.addEventListener("input", () => {
      state.timeLimit = readNumericValue(elements.timeLimit, DEFAULTS.timeLimit);
      renderControlValues();
    });

    elements.selectAll.addEventListener("click", () => {
      state.selected = new Set(core.tables);
      renderTableButtonsState();
      renderSelectionNote();
    });

    elements.selectNone.addEventListener("click", () => {
      state.selected = new Set();
      renderTableButtonsState();
      renderSelectionNote();
    });

    elements.selectCore.addEventListener("click", () => {
      state.selected = new Set(DEFAULTS.selectedTables);
      renderTableButtonsState();
      renderSelectionNote();
    });

    elements.startBtn.addEventListener("click", () => startSession());
    elements.stopBtn.addEventListener("click", () => finishSession(true));
    elements.backConfigBtn.addEventListener("click", () => switchScreen("config"));
    elements.summaryRetryBtn.addEventListener("click", () => retryLastSession());
    elements.summaryTargetBtn.addEventListener("click", () => startSession({ mode: "targeted" }));

    elements.resetBtn.addEventListener("click", () => {
      const confirmed = window.confirm("Effacer tous les progrès, l'historique et le dernier bilan ?");
      if (!confirmed) return;

      state.progress = core.sanitizeProgress({});
      state.history = [];
      state.lastSummary = null;
      storageUtils.removeKeys(store, [storageKey, historyKey, summaryKey]);
      persistProgress();
      renderPersistentStats();
      renderEmptyResults();
      renderToast("Progrès réinitialisés.", "good");
    });
  }

  function rememberLastSessionConfig(config) {
    state.lastSessionConfig = {
      mode: config.mode,
      selectedTables: [...config.selectedTables],
      questions: config.questions,
      choiceDelay: config.choiceDelay,
      timeLimit: config.timeLimit,
    };
  }

  function startSession(overrides = {}) {
    const mode = overrides.mode || state.mode;
    const selectedTables = core.resolveSelectedTables({
      mode,
      overrideSelectedTables: overrides.selectedTables,
      selectedTables: Array.from(state.selected),
      progress: state.progress,
    });

    if (!selectedTables.length) {
      renderToast("Choisis au moins une table avant de lancer la séance.", "bad");
      return;
    }

    const queue = core.buildQueue(selectedTables, state.questions, state.progress);
    if (!queue.length) {
      renderToast("Impossible de générer une séance pour le moment.", "bad");
      return;
    }

    clearLiveTimers();
    state.session = {
      mode,
      selectedTables,
      queue,
      questions: queue.length,
      choiceDelay: state.choiceDelay,
      timeLimit: state.timeLimit,
      index: 0,
      answered: 0,
      correct: 0,
      streak: 0,
      bestStreak: 0,
      locked: false,
      current: null,
    };

    rememberLastSessionConfig({
      mode,
      selectedTables,
      questions: state.questions,
      choiceDelay: state.choiceDelay,
      timeLimit: state.timeLimit,
    });

    switchScreen("play");
    askCurrentQuestion();
  }

  function retryLastSession() {
    if (!state.lastSessionConfig) {
      startSession();
      return;
    }

    const config = state.lastSessionConfig;
    state.selected = new Set(config.selectedTables);
    state.mode = config.mode;
    state.questions = config.questions;
    state.choiceDelay = config.choiceDelay;
    state.timeLimit = config.timeLimit;
    elements.questionCount.value = String(config.questions);
    elements.choiceDelay.value = String(config.choiceDelay);
    elements.timeLimit.value = String(config.timeLimit);

    const modeInput = document.querySelector(`input[name="mode"][value="${config.mode}"]`);
    if (modeInput) {
      modeInput.checked = true;
    }

    renderControlValues();
    renderTableButtonsState();
    renderSelectionNote();
    startSession({
      mode: config.mode,
      selectedTables: config.selectedTables,
    });
  }

  function askCurrentQuestion() {
    const session = state.session;
    if (!session) return;

    const entry = session.queue[session.index];
    const correct = entry.table * entry.multiplier;

    session.current = {
      ...entry,
      correct,
      choices: core.buildChoiceValues(entry.table, entry.multiplier),
    };
    session.locked = false;

    elements.playKicker.textContent =
      session.mode === "targeted"
        ? `Révision ciblée • tables ${session.selectedTables.join(", ")}`
        : `Choix multiple • tables ${session.selectedTables.join(", ")}`;
    elements.sessionMeta.textContent = `Question ${session.index + 1} sur ${session.questions} • Série ${session.streak}`;
    elements.question.textContent = `${entry.table} × ${entry.multiplier} = ?`;
    elements.feedback.textContent = "";
    elements.feedback.className = "feedback";
    elements.choiceStage.textContent = session.choiceDelay
      ? `Cherche mentalement la réponse pendant ${session.choiceDelay} seconde${session.choiceDelay > 1 ? "s" : ""}, puis laisse les cartes se retourner.`
      : "Choisis la bonne réponse le plus vite possible.";

    renderProgress();
    renderChoicePlaceholders();
    startQuestionTimer();

    if (session.choiceDelay > 0) {
      state.revealTimer = window.setTimeout(revealChoices, session.choiceDelay * 1000);
    } else {
      revealChoices();
    }
  }

  function renderChoicePlaceholders() {
    elements.choices.innerHTML = "";

    for (let index = 0; index < 4; index += 1) {
      elements.choices.appendChild(createChoiceCard(index));
    }
  }

  function revealChoices() {
    const session = state.session;
    if (!session || !session.current || session.locked) return;

    elements.choiceStage.textContent =
      "Les cartes se retournent. Clique vite dès que les réponses apparaissent.";
    const cards = Array.from(elements.choices.querySelectorAll(".choice-card"));

    session.current.choices.forEach((value, index) => {
      const button = cards[index] || createChoiceCard(index);
      const frontFace = button.querySelector(".choice-face-front");
      frontFace.textContent = String(value);
      button.dataset.value = String(value);
      button.disabled = false;
      button.style.setProperty("--flip-delay", `${index * 90}ms`);
      button.onclick = () => handleChoice(value);

      if (!button.parentElement) {
        elements.choices.appendChild(button);
      }

      requestAnimationFrame(() => {
        button.classList.add("is-revealed");
        button.classList.remove("is-hidden");
      });
    });
  }

  function createChoiceCard(index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-card is-hidden";
    button.disabled = true;
    button.style.setProperty("--flip-delay", `${index * 90}ms`);
    button.innerHTML = `
      <span class="choice-card-inner">
        <span class="choice-face choice-face-front"></span>
        <span class="choice-face choice-face-back">?</span>
      </span>
    `;
    return button;
  }

  function handleChoice(value) {
    const session = state.session;
    if (!session || !session.current || session.locked) return;

    session.locked = true;
    window.clearTimeout(state.revealTimer);
    window.clearInterval(state.questionTimer);

    finalizeQuestion({
      wasCorrect: value === session.current.correct,
      chosenValue: value,
      timedOut: false,
    });
  }

  function handleTimeout() {
    const session = state.session;
    if (!session || !session.current || session.locked) return;

    session.locked = true;
    window.clearTimeout(state.revealTimer);
    window.clearInterval(state.questionTimer);
    finalizeQuestion({
      wasCorrect: false,
      chosenValue: null,
      timedOut: true,
    });
  }

  function finalizeQuestion({ wasCorrect, chosenValue, timedOut }) {
    const session = state.session;
    if (!session || !session.current) return;

    session.answered += 1;
    registerAnswer(session.current.table, wasCorrect);

    if (wasCorrect) {
      session.correct += 1;
      session.streak += 1;
      session.bestStreak = Math.max(session.bestStreak, session.streak);
    } else {
      session.streak = 0;
    }

    revealResultButtons(chosenValue);

    if (timedOut) {
      elements.feedback.textContent = `Temps écoulé. La bonne réponse était ${session.current.correct}.`;
      elements.feedback.classList.add("bad");
    } else if (wasCorrect) {
      elements.feedback.textContent = "Bien joué.";
      elements.feedback.classList.add("good");
    } else {
      elements.feedback.textContent = `Raté. La bonne réponse était ${session.current.correct}.`;
      elements.feedback.classList.add("bad");
    }

    elements.sessionMeta.textContent = `Question ${session.index + 1} sur ${session.questions} • Série ${session.streak}`;
    elements.progressFill.style.width = `${(session.answered / session.questions) * 100}%`;

    state.advanceTimer = window.setTimeout(() => {
      if (!state.session) return;

      if (state.session.answered >= state.session.questions) {
        finishSession(false);
        return;
      }

      state.session.index += 1;
      askCurrentQuestion();
    }, 850);
  }

  function revealResultButtons(chosenValue) {
    const session = state.session;
    if (!session || !session.current) return;

    if (!elements.choices.querySelector(".choice-card.is-revealed")) {
      revealChoices();
    }

    elements.choices.querySelectorAll(".choice-card").forEach((button) => {
      const value = Number(button.dataset.value);
      button.disabled = true;

      if (value === session.current.correct) {
        button.classList.add("is-correct");
      }
      if (chosenValue !== null && value === chosenValue && value !== session.current.correct) {
        button.classList.add("is-wrong");
      }
    });
  }

  function registerAnswer(table, wasCorrect) {
    const stats = state.progress[table];
    stats.total += 1;

    if (wasCorrect) {
      stats.correct += 1;
    }

    persistProgress();
  }

  function startQuestionTimer() {
    window.clearTimeout(state.revealTimer);
    window.clearInterval(state.questionTimer);

    const durationMs = state.session.timeLimit * 1000;
    const start = performance.now();
    elements.timerBar.style.width = "100%";

    state.questionTimer = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const ratio = Math.max(0, 1 - elapsed / durationMs);
      elements.timerBar.style.width = `${ratio * 100}%`;

      if (ratio <= 0) {
        handleTimeout();
      }
    }, 50);
  }

  function renderProgress() {
    const session = state.session;
    if (!session) return;

    elements.progressLabel.textContent = `${session.index + 1} / ${session.questions}`;
    elements.progressFill.style.width = `${(session.index / session.questions) * 100}%`;
  }

  function finishSession(stopped) {
    if (!state.session) {
      switchScreen("results");
      return;
    }

    clearLiveTimers();

    const summary = core.buildSummary(state.session, state.progress, stopped);
    state.lastSummary = summary;
    persistLastSummary(summary);

    if (summary.total > 0) {
      state.history = core.mergeSummaryIntoHistory(state.history, summary, getTodayKey());
      persistHistory();
    }

    state.session = null;
    renderResults(summary);
    renderPersistentStats();
    switchScreen("results");
  }

  function renderEmptyResults() {
    elements.resultsTitle.textContent = "Résultats";
    elements.resultsSubtitle.textContent = "Lance une séance pour obtenir un bilan détaillé.";
    elements.summaryScore.textContent = "0 / 0";
    elements.summaryAccuracy.textContent = "0%";
    elements.summaryBestStreak.textContent = "0";
    elements.summaryWeak.textContent = "Tables à renforcer: —";
    elements.summaryReco.textContent = "Conseil: Lance une première série pour créer une base de progression.";
  }

  function renderResults(summary) {
    if (!summary) {
      renderEmptyResults();
      return;
    }

    const title = summary.stopped ? "Séance interrompue" : "Séance terminée";
    let subtitle = "La séance vient de se terminer.";

    if (summary.stopped && summary.total === 0) {
      subtitle = "La séance a été arrêtée avant la première réponse.";
    } else if (summary.stopped) {
      subtitle = `Séance stoppée après ${summary.total} question${summary.total > 1 ? "s" : ""}.`;
    }

    elements.resultsTitle.textContent = title;
    elements.resultsSubtitle.textContent = subtitle;
    elements.summaryScore.textContent = `${summary.correct} / ${summary.total}`;
    elements.summaryAccuracy.textContent = `${summary.accuracy}%`;
    elements.summaryBestStreak.textContent = String(summary.bestStreak);
    elements.summaryWeak.textContent = summary.weakTables.length
      ? `Tables à renforcer: ${summary.weakTables.join(", ")}`
      : "Tables à renforcer: —";
    elements.summaryReco.textContent = `Conseil: ${summary.recommendation}`;
  }

  function clearLiveTimers() {
    window.clearTimeout(state.revealTimer);
    window.clearInterval(state.questionTimer);
    window.clearTimeout(state.advanceTimer);
  }

  function init() {
    renderVersionBadge();
    syncStateFromControls();
    buildTableButtons();
    renderControlValues();
    renderSelectionNote();
    renderPersistentStats();
    renderResults(state.lastSummary);
    initHelpPopovers();
    bindEvents();
    switchScreen("config");
  }

  init();
})();
