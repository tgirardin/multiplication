(function attachMemox9Core(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.MEMOX9Core = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createMemox9Core() {
  const tables = Array.from({ length: 9 }, (_, index) => index + 1);

  function clampCount(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
  }

  function normalizeTableList(list) {
    if (!Array.isArray(list)) return [];
    return [...new Set(list.map((value) => Number(value)).filter((value) => tables.includes(value)))].sort(
      (a, b) => a - b,
    );
  }

  function sanitizeProgress(progress = {}) {
    const safeProgress = progress && typeof progress === "object" ? progress : {};
    const normalized = {};

    tables.forEach((table) => {
      const stats = safeProgress[table];
      const total = clampCount(stats?.total);
      const correct = Math.min(total, clampCount(stats?.correct));
      normalized[table] = { correct, total };
    });

    return normalized;
  }

  function sanitizeHistory(history = []) {
    if (!Array.isArray(history)) return [];

    return history
      .filter((entry) => entry && typeof entry.date === "string")
      .map((entry) => {
        const total = clampCount(entry.total);
        const correct = Math.min(total, clampCount(entry.correct));
        return {
          date: entry.date,
          sessions: clampCount(entry.sessions),
          correct,
          total,
          bestStreak: clampCount(entry.bestStreak),
        };
      });
  }

  function sanitizeSummary(summary) {
    if (!summary || typeof summary !== "object") return null;

    const total = clampCount(summary.total);
    const correct = Math.min(total, clampCount(summary.correct));
    const weakTables = normalizeTableList(summary.weakTables);
    const accuracy = total ? Math.round((correct / total) * 100) : 0;

    return {
      endedAt: typeof summary.endedAt === "string" ? summary.endedAt : null,
      stopped: Boolean(summary.stopped),
      mode: summary.mode === "targeted" ? "targeted" : "choice",
      selectedTables: normalizeTableList(summary.selectedTables),
      correct,
      total,
      accuracy,
      bestStreak: clampCount(summary.bestStreak),
      weakTables,
      recommendation:
        typeof summary.recommendation === "string"
          ? summary.recommendation
          : buildRecommendation(accuracy, weakTables),
    };
  }

  function computeGlobalMastery(progress) {
    const normalizedProgress = sanitizeProgress(progress);
    let correct = 0;
    let total = 0;

    tables.forEach((table) => {
      correct += normalizedProgress[table].correct;
      total += normalizedProgress[table].total;
    });

    return total ? Math.round((correct / total) * 100) : 0;
  }

  function computeGlobalBestStreak(history, lastSummary = null) {
    const historyBest = sanitizeHistory(history).reduce(
      (bestStreak, entry) => Math.max(bestStreak, entry.bestStreak),
      0,
    );
    const summaryBest = sanitizeSummary(lastSummary)?.bestStreak || 0;
    return Math.max(historyBest, summaryBest);
  }

  function getWeakestTables(progress, limit = 2) {
    const normalizedProgress = sanitizeProgress(progress);
    const safeLimit = Math.max(0, Math.floor(limit));
    const totalAttempts = tables.reduce((sum, table) => sum + normalizedProgress[table].total, 0);

    if (totalAttempts === 0) {
      return [2, 3].slice(0, safeLimit);
    }

    return tables
      .map((table) => {
        const stats = normalizedProgress[table];
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
      )
      .slice(0, safeLimit)
      .map((item) => item.table);
  }

  function resolveSelectedTables({ mode, overrideSelectedTables, selectedTables, progress }) {
    if (Array.isArray(overrideSelectedTables)) {
      return normalizeTableList(overrideSelectedTables);
    }

    if (mode === "targeted") {
      return getWeakestTables(progress, 2);
    }

    return normalizeTableList(selectedTables);
  }

  function weightedTablePick(selectedTables, progress) {
    const normalizedTables = normalizeTableList(selectedTables);
    if (!normalizedTables.length) return null;

    const normalizedProgress = sanitizeProgress(progress);
    const weights = normalizedTables.map((table) => {
      const stats = normalizedProgress[table];
      const accuracy = stats.total ? stats.correct / stats.total : 0;
      return 1 - accuracy + 0.2;
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = Math.random() * totalWeight;

    for (let index = 0; index < normalizedTables.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) {
        return normalizedTables[index];
      }
    }

    return normalizedTables[normalizedTables.length - 1];
  }

  function buildQueue(selectedTables, questionCount, progress) {
    const normalizedTables = normalizeTableList(selectedTables);
    const safeQuestionCount = clampCount(questionCount);
    const normalizedProgress = sanitizeProgress(progress);
    const queue = [];
    const recentPairs = [];

    for (let index = 0; index < safeQuestionCount; index += 1) {
      const table = weightedTablePick(normalizedTables, normalizedProgress);
      if (!table) break;

      let multiplier = Math.ceil(Math.random() * 9);
      let attempts = 0;
      while (recentPairs.includes(`${table}-${multiplier}`) && attempts < 10) {
        multiplier = Math.ceil(Math.random() * 9);
        attempts += 1;
      }

      recentPairs.push(`${table}-${multiplier}`);
      if (recentPairs.length > 4) {
        recentPairs.shift();
      }

      queue.push({ table, multiplier });
    }

    return queue;
  }

  function buildChoiceValues(table, multiplier) {
    const correct = Number(table) * Number(multiplier);
    const values = new Set([correct]);
    let attempts = 0;

    while (values.size < 4 && attempts < 80) {
      const pattern = attempts % 4;
      let candidate = correct;

      if (pattern === 0) {
        const delta = Math.random() < 0.5 ? -1 : 1;
        const altMultiplier = Math.min(
          9,
          Math.max(1, multiplier + delta * (1 + Math.floor(Math.random() * 2))),
        );
        candidate = table * altMultiplier;
      } else if (pattern === 1) {
        const delta = Math.random() < 0.5 ? -1 : 1;
        const altTable = Math.min(9, Math.max(1, table + delta));
        candidate = altTable * multiplier;
      } else if (pattern === 2) {
        const delta = (Math.floor(Math.random() * 3) + 1) * table;
        candidate = correct + (Math.random() < 0.5 ? -delta : delta);
      } else {
        const delta = Math.floor(Math.random() * 8) + 2;
        candidate = correct + (Math.random() < 0.5 ? -delta : delta);
      }

      if (candidate > 0 && candidate <= 81) {
        values.add(candidate);
      }
      attempts += 1;
    }

    while (values.size < 4) {
      values.add(Math.ceil(Math.random() * 81));
    }

    return Array.from(values).sort(() => Math.random() - 0.5);
  }

  function buildRecommendation(accuracy, weakTables) {
    if (accuracy >= 90) {
      return "Très solide. Tu peux réduire un peu le délai avant choix pour accélérer le rythme.";
    }
    if (weakTables.length >= 2) {
      return `Relance une révision ciblée sur les tables ${weakTables[0]} et ${weakTables[1]}.`;
    }
    if (weakTables.length === 1) {
      return `La table ${weakTables[0]} mérite encore quelques séries courtes.`;
    }
    return "Refais une série rapide pour ancrer les automatismes du jour.";
  }

  function buildSummary(session, progress, stopped) {
    const total = clampCount(session?.answered);
    const correct = Math.min(total, clampCount(session?.correct));
    const accuracy = total ? Math.round((correct / total) * 100) : 0;
    const weakTables = getWeakestTables(progress, 3);

    return {
      endedAt: new Date().toISOString(),
      stopped: Boolean(stopped),
      mode: session?.mode === "targeted" ? "targeted" : "choice",
      selectedTables: normalizeTableList(session?.selectedTables),
      correct,
      total,
      accuracy,
      bestStreak: clampCount(session?.bestStreak),
      weakTables,
      recommendation: buildRecommendation(accuracy, weakTables),
    };
  }

  function mergeSummaryIntoHistory(history, summary, dateKey) {
    const normalizedHistory = sanitizeHistory(history);
    const safeSummary = sanitizeSummary(summary);
    if (!safeSummary) {
      return normalizedHistory;
    }

    const nextHistory = normalizedHistory.map((entry) => ({ ...entry }));
    const entry = nextHistory.find((item) => item.date === dateKey);

    if (entry) {
      entry.sessions += 1;
      entry.correct += safeSummary.correct;
      entry.total += safeSummary.total;
      entry.bestStreak = Math.max(entry.bestStreak, safeSummary.bestStreak);
      return nextHistory;
    }

    nextHistory.push({
      date: dateKey,
      sessions: 1,
      correct: safeSummary.correct,
      total: safeSummary.total,
      bestStreak: safeSummary.bestStreak,
    });

    return nextHistory;
  }

  return {
    tables,
    sanitizeProgress,
    sanitizeHistory,
    sanitizeSummary,
    computeGlobalMastery,
    computeGlobalBestStreak,
    getWeakestTables,
    resolveSelectedTables,
    weightedTablePick,
    buildQueue,
    buildChoiceValues,
    buildRecommendation,
    buildSummary,
    mergeSummaryIntoHistory,
  };
});
