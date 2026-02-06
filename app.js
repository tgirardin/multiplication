const facts = [];
for (let i = 2; i <= 9; i++) {
  for (let j = 2; j <= 9; j++) {
    facts.push({
      a: i,
      b: j,
      id: `${i}x${j}`,
      box: 0, // 0 = New/Learning, 1-5 = Review Intervals
      lastReviewed: 0,
    });
  }
}

const state = {
  facts: {}, // Map id -> fact
  xp: 0,
  level: 1,
  queue: [],
  index: 0,
  current: null,
  streak: 0,
  bestStreak: 0,
  sessionCorrect: 0,
  sessionTotal: 0,
  isSessionComplete: false,
  timers: {
    question: null,
    toast: null,
    hint: null,
  },
  settings: {
    questions: 20,
    timeLimit: 12, // Slightly more time for thought
    autoHint: true,
  },
};

const storageKey = "memox9_v3_data";

const dom = {
  // Views
  configView: document.getElementById("config-view"),
  sessionView: document.getElementById("session-view"),
  tipsView: document.getElementById("tips-view"),

  // Dashboard
  masteryGlobal: document.getElementById("mastery-global"),
  streak: document.getElementById("streak"),
  levelLabel: document.getElementById("level-label"),
  xpBarFill: document.getElementById("xp-bar-fill"),

  // Controls
  startBtn: document.getElementById("start-btn"),
  resetBtn: document.getElementById("reset-btn"),
  tipsBtn: document.getElementById("tips-btn"),
  tipsBackBtn: document.getElementById("tips-back-btn"),

  // Session
  sessionMeta: document.getElementById("session-meta"),
  progressLabel: document.getElementById("progress-label"),
  progressFill: document.getElementById("progress-fill"),
  question: document.getElementById("question"),
  hint: document.getElementById("hint"),

  // Input Modes
  answerArea: document.getElementById("answer-area"),
  answerInput: document.getElementById("answer-input"),
  checkBtn: document.getElementById("check-btn"),

  choicesArea: document.getElementById("choices-area"),

  // Feedback
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
  summaryTipsBtn: document.getElementById("summary-tips-btn"),

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
  return Math.floor(1 + Math.sqrt(xp / 100)); // Slower progression
}

function getNextLevelXp(level) {
  return 100 * Math.pow(level, 2);
}

// --- ALGORITHMS ---

function generateSessionQueue() {
  const allFacts = Object.values(state.facts);
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  // Weighting logic: New items (Box 0) and expired reviews first
  const weighted = allFacts.map(f => {
    let weight = 0;

    if (f.box === 0) weight += 500; // Priority to new
    else {
      // Recency factor
      const daysSince = (now - f.lastReviewed) / ONE_DAY;
      const interval = Math.pow(2, f.box - 1); // 1, 2, 4, 8 days...
      if (daysSince >= interval) weight += 200; // Overdue
      weight += (10 / f.box); // Lower boxes have slightly more weight
    }

    return { fact: f, weight };
  });

  weighted.sort((a, b) => b.weight - a.weight);

  // Mix top priority with some random reinforcement
  const poolSize = Math.min(weighted.length, state.settings.questions * 2);
  const pool = weighted.slice(0, poolSize).map(w => w.fact);

  // Shuffle
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
  // If box is low (0-2) -> Flash (Multiple Choice)
  // If box is high (3+) -> Recall (Typing)
  if (fact.box <= 2) return "flash";
  return "recall";
}

function getSmartHint(a, b) {
  if (a === 2 || b === 2) return "Le double du nombre.";
  if (a === 5 || b === 5) return "Se termine toujours par 0 ou 5.";
  if (a === 9) return `Astuce du 9 : ${b} × 10 - ${b} (soit ${b * 10} - ${b})`;
  if (b === 9) return `Astuce du 9 : ${a} × 10 - ${a} (soit ${a * 10} - ${a})`;
  if (a === b) return "C'est un carré parfait (comme un carré géométrique).";
  if (a % 2 !== 0 && b % 2 !== 0) return "Impair × Impair = Impair";
  if (a % 2 === 0 || b % 2 === 0) return "Pair × N = Pair";
  return "Regroupez par additions répétées.";
}

function generateChoices(fact) {
  const correct = fact.a * fact.b;
  const choices = new Set([correct]);

  // Determine number of choices based on "skill" (box level)
  // Box 0 = 3 choices, Box 1 = 4 choices, Box 2+ = 6 choices
  let count = 3;
  if (fact.box === 1) count = 4;
  if (fact.box >= 2) count = 6;

  // Generate Traps
  const traps = [
    correct + 10, correct - 10, // Proche dizaine
    correct + fact.a, correct - fact.a, // Erreur d'ajout
    correct + fact.b, correct - fact.b,
    correct + 1, correct - 1, // Très proche
  ];

  // Add plausible traps
  let attempts = 0;
  while (choices.size < count && attempts < 50) {
    let trap;
    if (traps.length > 0 && Math.random() < 0.7) {
      trap = traps.shift();
    } else {
      trap = Math.floor(Math.random() * 80) + 4;
    }

    if (trap > 0 && trap < 100 && trap !== correct) {
      choices.add(trap);
    }
    attempts++;
  }

  return Array.from(choices).sort(() => Math.random() - 0.5);
}

function processResult(factId, isCorrect, timeTaken) {
  const fact = state.facts[factId];

  fact.lastReviewed = Date.now();

  if (isCorrect) {
    fact.box = Math.min(5, fact.box + 1);

    // XP
    const baseXp = 10;
    const streakBonus = Math.min(state.streak, 5) * 2;
    const timeBonus = Math.max(0, Math.round((state.settings.timeLimit - timeTaken)));
    const totalXp = baseXp + streakBonus + timeBonus;

    state.xp += totalXp;
    state.sessionCorrect++;
    state.streak++;

    showToast(`Correct ! +${totalXp} XP`, "good");

  } else {
    fact.box = 0; // Reset progress on failure
    state.streak = 0;
    showToast("Loupé... On reverra ça.", "bad");
  }

  state.bestStreak = Math.max(state.streak, state.bestStreak);
  state.sessionTotal++;

  // Level Up
  const newLevel = calculateLevel(state.xp);
  if (newLevel > state.level) {
    state.level = newLevel;
    showToast(`NIVEAU ${state.level} ATTEINT ! 🚀`, "good");
  }

  state.facts[factId] = fact;
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
    dom.xpBarFill.style.width = `${Math.min(100, Math.max(5, progress * 100))}%`;
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
    alert("Tout est appris !");
    return;
  }

  document.body.dataset.view = "session";
  dom.configView.hidden = true;
  dom.tipsView.hidden = true;
  dom.sessionView.hidden = false;
  dom.summaryCard.hidden = true;
  dom.practiceCard.hidden = false;

  nextQuestion();
}

function stopSession() {
  document.body.dataset.view = "config";
  dom.configView.hidden = false;
  dom.tipsView.hidden = true;
  dom.sessionView.hidden = true;
  clearAllTimers();
}

function showTips() {
  document.body.dataset.view = "tips";
  dom.configView.hidden = true;
  dom.sessionView.hidden = true;
  dom.tipsView.hidden = false;
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
  dom.feedback.textContent = "";
  dom.hint.textContent = "Indice prêt...";
  dom.hint.style.color = "var(--muted)";
  dom.hint.style.fontWeight = "normal";

  updateSessionProgress();

  // Adaptive UI: Flash vs Recall
  if (q.mode === "flash") {
    setupFlashMode(q);
  } else {
    setupRecallMode();
  }

  // Timer
  startTimer(state.settings.timeLimit);

  // Hint Timer (No longer reveals answer)
  state.timers.hint = setTimeout(() => {
    if (state.settings.autoHint) {
      dom.hint.textContent = `💡 ${getSmartHint(q.a, q.b)}`;
      dom.hint.style.color = "var(--accent)";
    }
  }, 4000);
}

function setupFlashMode(q) {
  dom.answerArea.hidden = true;
  dom.choicesArea.hidden = false;
  dom.choicesArea.innerHTML = "";

  // Generate choices
  const choices = generateChoices(q);
  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = choice;
    btn.onclick = () => checkChoice(choice, btn);
    dom.choicesArea.appendChild(btn);
  });
}

function setupRecallMode() {
  dom.answerArea.hidden = false;
  dom.choicesArea.hidden = true;
  dom.answerInput.value = "";

  // UX Focus aggressively
  setTimeout(() => {
    dom.answerInput.focus();
    dom.answerInput.click(); // Mobile focus trigger
  }, 50);
}

function startTimer(seconds) {
  dom.timer.classList.add("active");
  dom.timerBar.style.transition = "none";
  dom.timerBar.style.width = "0%";

  void dom.timerBar.offsetWidth; // Force reflow

  dom.timerBar.style.transition = `width ${seconds}s linear`;
  dom.timerBar.style.width = "100%";

  state.timers.question = setTimeout(() => {
    handleTimeout();
  }, seconds * 1000);
}

function handleTimeout() {
  const correct = state.current.a * state.current.b;
  processResult(state.current.id, false, state.settings.timeLimit);
  dom.feedback.textContent = `Temps écoulé ! Réponse : ${correct}`;
  dom.feedback.style.color = "var(--bad)";

  setTimeout(() => {
    state.index++;
    nextQuestion();
  }, 2500);
}

function checkChoice(value, btn) {
  if (!state.current) return;
  clearAllTimers();

  // Prevent double clicks
  const allBtns = dom.choicesArea.querySelectorAll("button");
  allBtns.forEach(b => b.disabled = true);

  const correct = state.current.a * state.current.b;

  if (value === correct) {
    btn.classList.add("correct");
    processResult(state.current.id, true, 0);
    setTimeout(() => {
      state.index++;
      nextQuestion();
    }, 800);
  } else {
    btn.classList.add("wrong");
    // Highlight correct one
    allBtns.forEach(b => {
      if (parseInt(b.textContent) === correct) b.classList.add("correct");
    });

    processResult(state.current.id, false, 0);
    setTimeout(() => {
      state.index++;
      nextQuestion();
    }, 2000);
  }
}

function checkAnswer() {
  if (!state.current) return;
  clearAllTimers();

  const input = parseInt(dom.answerInput.value, 10);
  const correct = state.current.a * state.current.b;

  if (input === correct) {
    dom.feedback.textContent = "Correct !";
    dom.feedback.style.color = "var(--good)";
    processResult(state.current.id, true, 0);
    setTimeout(() => {
      state.index++;
      nextQuestion();
    }, 600);
  } else {
    dom.feedback.textContent = `La réponse était ${correct}`;
    dom.feedback.style.color = "var(--bad)";
    processResult(state.current.id, false, 0);
    dom.answerInput.value = "";
    setTimeout(() => {
      state.index++;
      nextQuestion();
    }, 2000);
  }
}

function endSession() {
  dom.practiceCard.hidden = true;
  dom.summaryCard.hidden = false;

  const xpGained = state.sessionCorrect * 10;
  dom.summaryScore.textContent = `${state.sessionCorrect} / ${state.sessionTotal}`;
  dom.summaryXp.textContent = `+${xpGained} XP`;
}

function clearAllTimers() {
  Object.values(state.timers).forEach(t => clearTimeout(t));
}

function showToast(msg, type) {
  dom.toast.textContent = msg;
  dom.toast.className = `toast ${type} show`;
  setTimeout(() => dom.toast.classList.remove("show"), 2000);
}


// --- EVENTS ---

dom.startBtn.addEventListener("click", startSession);
dom.stopBtn.addEventListener("click", stopSession);
dom.tipsBtn.addEventListener("click", showTips);
dom.tipsBackBtn.addEventListener("click", stopSession);

dom.summaryCloseBtn.addEventListener("click", stopSession);
dom.summaryRetryBtn.addEventListener("click", startSession);
dom.summaryTipsBtn.addEventListener("click", showTips);

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
