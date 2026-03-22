const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../game-core.js");

test("sanitizeProgress remplit les tables manquantes", () => {
  const progress = core.sanitizeProgress({
    2: { correct: 3, total: 5 },
  });

  assert.deepEqual(progress[1], { correct: 0, total: 0 });
  assert.deepEqual(progress[2], { correct: 3, total: 5 });
  assert.equal(Object.keys(progress).length, 9);
});

test("resolveSelectedTables respecte un override explicite en mode cible", () => {
  const resolved = core.resolveSelectedTables({
    mode: "targeted",
    overrideSelectedTables: [8, 9],
    selectedTables: [2, 3],
    progress: core.sanitizeProgress({}),
  });

  assert.deepEqual(resolved, [8, 9]);
});

test("buildChoiceValues renvoie 4 valeurs uniques incluant la bonne reponse", () => {
  const values = core.buildChoiceValues(7, 8);

  assert.equal(values.length, 4);
  assert.equal(new Set(values).size, 4);
  assert.ok(values.includes(56));
  values.forEach((value) => {
    assert.ok(value >= 1 && value <= 81);
  });
});

test("mergeSummaryIntoHistory agrege les resultats du meme jour", () => {
  const history = [
    {
      date: "2026-03-20",
      sessions: 1,
      correct: 7,
      total: 10,
      bestStreak: 4,
    },
  ];

  const next = core.mergeSummaryIntoHistory(
    history,
    {
      correct: 5,
      total: 6,
      bestStreak: 5,
    },
    "2026-03-20",
  );

  assert.deepEqual(next, [
    {
      date: "2026-03-20",
      sessions: 2,
      correct: 12,
      total: 16,
      bestStreak: 5,
    },
  ]);
  assert.notStrictEqual(next, history);
});

test("computeGlobalBestStreak prend le maximum entre historique et dernier resume", () => {
  const bestStreak = core.computeGlobalBestStreak(
    [
      { date: "2026-03-20", sessions: 1, correct: 7, total: 10, bestStreak: 4 },
      { date: "2026-03-21", sessions: 2, correct: 9, total: 12, bestStreak: 6 },
    ],
    { bestStreak: 5, total: 5, correct: 4 },
  );

  assert.equal(bestStreak, 6);
});
