const test = require("node:test");
const assert = require("node:assert/strict");

const storageUtils = require("../safe-storage.js");

function createThrowingBackend() {
  return {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
}

function createWorkingBackend() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("createSafeStorage bascule en memoire quand le backend echoue", () => {
  const storage = storageUtils.createSafeStorage(createThrowingBackend());

  assert.equal(storage.available, false);
  assert.equal(storage.setItem("foo", "bar"), false);
  assert.equal(storage.getItem("foo"), "bar");
  assert.equal(storage.removeItem("foo"), false);
  assert.equal(storage.getItem("foo"), null);
});

test("readJson renvoie le fallback si la charge utile est invalide", () => {
  const storage = storageUtils.createSafeStorage(createWorkingBackend());
  storage.setItem("bad", "{broken");

  assert.deepEqual(storageUtils.readJson(storage, "bad", { ok: true }), { ok: true });
});

test("writeJson serialise correctement les objets", () => {
  const storage = storageUtils.createSafeStorage(createWorkingBackend());
  storageUtils.writeJson(storage, "summary", { score: 8, total: 10 });

  assert.deepEqual(storageUtils.readJson(storage, "summary", null), {
    score: 8,
    total: 10,
  });
});
