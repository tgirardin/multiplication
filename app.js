const facts = [];
for (let i = 2; i <= 9; i++) {
  for (let j = 2; j <= 9; j++) {
    facts.push({
      a: i,
      b: j,
      id: `${i}x${j}`,
      box: 0, // 0 = New/Learning, 1-5 = Review Intervals
      lastReviewed: 0,
      history: [], // Recent attempts (last 5)
    });
  }
}

const state = {
  facts: {}, // Map id -> fact
  xp: 0,
  level: 1,
  mode: "smart", // smart = SRS, random = classic
  queue: [],
  index: 0,
  current: null,
  streak: 0,
  bestStreak: 0,
  sessionCorrect: 0,
  sessionTotal: 0,
  isSessionComplete: false,
  timers: {
    hint: null,
    flash: null,
    question: null,
    toast: null,
  },
  settings: {
    questions: 20,
    flashDelay: 6,
    timeLimit: 10,
    autoHint: true,
  },
};

const storageKey = "memox9_v2_data";

const dom = {
  // Views
  configView: document.getElementById("config-view"),
  sessionView: document.getElementById("session-view"),

  // Dashboard
  masteryGlobal: document.getElementById("mastery-global"),
  streak: document.getElementById("streak"),
  accuracy: document.getElementById("accuracy"),
  levelLabel: document.getElementById("level-label"),
  xpBarFill: document.getElementById("xp-bar-fill"),

  // Controls
  startBtn: document.getElementById("start-btn"),
  resetBtn: document.getElementById("reset-btn"),

  // Session
  sessionMeta: document.getElementById("session-meta"),
  progressLabel: document.getElementById("progress-label"),
  progressFill: document.getElementById("progress-fill"),
  question: document.getElementById("question"),
  hint: document.getElementById("hint"),
  answerArea: document.getElementById("answer-area"),
  answerInput: document.getElementById("answer-input"),
  checkBtn: document.getElementById("check-btn"),
  nextBtn: document.getElementById("next-btn"),
  feedback: document.getElementById("feedback"),
  timerBar: document.getElementById("timer-bar"),
  timer: document.getElementById("timer"),
  stopBtn: document.getElementById("stop-btn"),
  practiceCard: document.getElementById("practice-card"),

  // Summary
  summaryCard: document.getElementById("summary-card"),
  summaryScore: document.getElementById("summary-score"),
  summaryXp: document.getElementById("summary-xp"),
  summaryCloseBtn: document.getElementById("summary-close-btn"),
  summaryRetryBtn: document.getElementById("summary-retry-btn"),

  // Toast
  toast: document.getElementById("toast"),
};

// --- DATA & STATE MANAGEMENT ---

function initData() {
  facts.forEach(f => state.facts[f.id] = { ...f });

  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      state.xp = data.xp || 0;
      state.level = calculateLevel(state.xp);
      if (data.facts) {
        Object.keys(data.facts).forEach(id => {
          if (state.facts[id]) {
            state.facts[id] = { ...state.facts[id], ...data.facts[id] };
          }
        });
      }
    } catch (e) {
      console.error("Data load error", e);
    }
  }
  updateDashboard();
}

function persistData() {
  const data = {
    xp: state.xp,
    facts: state.facts,
  };
  localStorage.setItem(storageKey, JSON.stringify(data));
}

function calculateLevel(xp) {
  // Simple formula: Level = 1 + sqrt(XP / 100)
  return Math.floor(1 + Math.sqrt(xp / 50));
}

function getNextLevelXp(level) {
  return 50 * Math.pow(level, 2);
}

// --- ALGORITHMS ---

function generateSessionQueue() {
  const allFacts = Object.values(state.facts);

  // Leitner System Logic
  // Box 0: Learning (New/Failed) - High priority
  // Box 1: Review every 1 session
  // Box 2: Review every 3 sessions
  // Box 3: Review every 7 sessions
  // ...

  // For this app, we randomize but weight by box number (lower box = higher weight)
  // and prioritize those not reviewed recently.

  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  const weighted = allFacts.map(f => {
    let weight = 0;

    // Box weighting
    if (f.box === 0) weight += 100; // New items are critical
    else if (f.box === 1) weight += 50;
    else if (f.box === 2) weight += 25;
    else weight += (10 / f.box);

    // Recency weighting (decay)
    const daysSince = (now - f.lastReviewed) / ONE_DAY;
    weight += daysSince * 10;

    return { fact: f, weight };
  });

  // Sort by weight desc and take top N
  weighted.sort((a, b) => b.weight - a.weight);

  // Add some randomness: take top 2x needed, shuffle, take needed
  const poolSize = Math.min(weighted.length, state.settings.questions * 2);
  const pool = weighted.slice(0, poolSize).map(w => w.fact);

  // Shuffle pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, state.settings.questions).map(f => ({
    ...f,
    mode: decideMode(f)
  }));
}

function decideMode(fact) {
  // Box 0 = Always Recall
  if (fact.box === 0) return "recall";
  // Higher boxes = chance of Flash (easier check but faster)
  // Box 5 = 50% Flash
  return Math.random() < (fact.box * 0.1) ? "flash" : "recall";
}

function processResult(factId, isCorrect, timeTaken) {
  const fact = state.facts[factId];
  const previousBox = fact.box;

  fact.lastReviewed = Date.now();

  if (isCorrect) {
    // Promotion
    fact.box = Math.min(5, fact.box + 1);

    // Gamification
    const baseXp = 10;
    const streakBonus = Math.min(state.streak, 10);
    const timeBonus = Math.max(0, Math.round((state.settings.timeLimit - timeTaken) * 2)); // Speed bonus
    const totalXp = baseXp + streakBonus + timeBonus;

    state.xp += totalXp;
    state.sessionCorrect++;
    state.streak++;

    showToast(`+${totalXp} XP ${state.streak > 1 ? `x${state.streak}` : ''}`, "good");

  } else {
    // Demotion - Back to Box 0
    fact.box = 0;
    state.streak = 0;
    showToast("À revoir !", "bad");
  }

  state.bestStreak = Math.max(state.streak, state.bestStreak);
  state.sessionTotal++;

  // Check level up
  const newLevel = calculateLevel(state.xp);
  if (newLevel > state.level) {
    state.level = newLevel;
    showToast(`NIVEAU ${state.level} ATTEINT !`, "good");
    playSound("levelup"); // Placeholder
  }

  state.facts[factId] = fact; // Update ref
  persistData();
  updateDashboard();
}


// --- UI LOGIC ---

function updateDashboard() {
  const all = Object.values(state.facts);
  const mastered = all.filter(f => f.box >= 4).length;
  const total = all.length;
  const masteryPct = Math.round((mastered / total) * 100);

  if (dom.masteryGlobal) dom.masteryGlobal.textContent = `${masteryPct}%`;
  if (dom.streak) dom.streak.textContent = state.streak;

  if (dom.levelLabel) dom.levelLabel.textContent = `Niv. ${state.level}`;

  if (dom.xpBarFill) {
    const currentLevelBase = getNextLevelXp(state.level - 1);
    const nextLevelTarget = getNextLevelXp(state.level);
    const progress = (state.xp - currentLevelBase) / (nextLevelTarget - currentLevelBase);
    dom.xpBarFill.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
  }
}

function updateSessionProgress() {
  dom.progressLabel.textContent = `${state.index + 1} / ${state.queue.length}`;
  const pct = ((state.index) / state.queue.length) * 100;
  dom.progressFill.style.width = `${pct}%`;
}

function startSession() {
  state.queue = generateSessionQueue();
  state.index = 0;
  state.sessionCorrect = 0;
  state.sessionTotal = 0;
  state.isSessionComplete = false;

  if (state.queue.length === 0) {
    alert("Tout est parfaitement appris pour le moment ! Revenez plus tard.");
    return;
  }

  document.body.dataset.view = "session";
  dom.configView.hidden = true;
  dom.sessionView.hidden = false;
  dom.summaryCard.hidden = true;
  dom.practiceCard.hidden = false;

  nextQuestion();
}

function stopSession() {
  document.body.dataset.view = "config";
  dom.configView.hidden = false;
  dom.sessionView.hidden = true;
  clearAllTimers();
}

function nextQuestion() {
  clearAllTimers();

  if (state.index >= state.queue.length) {
    endSession();
    return;
  }

  const q = state.queue[state.index];
  state.current = q;

  // UI Setup
  dom.question.textContent = `${q.a} × ${q.b}`;
  dom.answerInput.value = "";
  dom.answerInput.focus();
  dom.feedback.textContent = "";
  dom.hint.textContent = "Indice prêt...";
  dom.timer.classList.remove("active");

  updateSessionProgress();

  // Timers
  startTimer(state.settings.timeLimit);
  state.timers.hint = setTimeout(() => {
    if (state.settings.autoHint) {
      dom.hint.textContent = `💡 ${q.a} × ${q.b} = ${q.a * q.b}`;
    }
  }, 5000);
}

function startTimer(seconds) {
  dom.timer.classList.add("active");
  dom.timerBar.style.transition = "none";
  dom.timerBar.style.width = "0%";

  // Force reflow
  void dom.timerBar.offsetWidth;

  dom.timerBar.style.transition = `width ${seconds}s linear`;
  dom.timerBar.style.width = "100%";

  state.timers.question = setTimeout(() => {
    handleTimeout();
  }, seconds * 1000);
}

function handleTimeout() {
  processResult(state.current.id, false, state.settings.timeLimit);
  dom.feedback.textContent = `Trop lent ! ${state.current.a} × ${state.current.b} = ${state.current.a * state.current.b}`;
  dom.feedback.style.color = "var(--bad)";
  setTimeout(() => {
    state.index++;
    nextQuestion();
  }, 2000);
}

function checkAnswer() {
  if (!state.current) return;
  clearAllTimers();

  const input = parseInt(dom.answerInput.value, 10);
  const correct = state.current.a * state.current.b;
  const timeSpent = 0; // TODO: Measure actual time

  if (input === correct) {
    dom.feedback.textContent = "Correct !";
    dom.feedback.style.color = "var(--good)";
    processResult(state.current.id, true, timeSpent);
    setTimeout(() => {
      state.index++;
      nextQuestion();
    }, 600);
  } else {
    dom.feedback.textContent = `Incorrect ! La réponse est ${correct}`;
    dom.feedback.style.color = "var(--bad)";
    processResult(state.current.id, false, timeSpent);
    dom.answerInput.value = "";
    dom.answerInput.focus();
    // Force re-type correctly before moving on? Or just move on?
    // Move on for now to keep flow
    setTimeout(() => {
      state.index++;
      nextQuestion();
    }, 2000);
  }
}

function endSession() {
  dom.practiceCard.hidden = true;
  dom.summaryCard.hidden = false;

  const xpGained = state.sessionCorrect * 10; // Estimation
  dom.summaryScore.textContent = `${state.sessionCorrect} / ${state.sessionTotal}`;
  dom.summaryXp.textContent = `+${xpGained} XP`;

  playSound("fanfare"); // Placeholder
}

function clearAllTimers() {
  Object.values(state.timers).forEach(t => clearTimeout(t));
}

function showToast(msg, type) {
  dom.toast.textContent = msg;
  dom.toast.className = `toast ${type} show`;
  setTimeout(() => dom.toast.classList.remove("show"), 2000);
}

function playSound(type) {
  // TODO: Implement simple Web Audio API beeps
}

// --- EVENTS ---

dom.startBtn.addEventListener("click", startSession);
dom.stopBtn.addEventListener("click", stopSession);
dom.summaryCloseBtn.addEventListener("click", stopSession);
dom.summaryRetryBtn.addEventListener("click", startSession);

dom.checkBtn.addEventListener("click", checkAnswer);
dom.answerInput.addEventListener("keydown", e => {
  if (e.key === "Enter") checkAnswer();
});

dom.resetBtn.addEventListener("click", () => {
  if (confirm("Tout effacer ?")) {
    localStorage.clear();
    location.reload();
  }
});

// --- INIT ---
initData();

setView(false);
