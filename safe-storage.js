(function attachMemox9Storage(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.MEMOX9Storage = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createMemox9Storage() {
  function createMemoryBackend() {
    const cache = new Map();

    return {
      getItem(key) {
        return cache.has(key) ? cache.get(key) : null;
      },
      setItem(key, value) {
        cache.set(key, String(value));
      },
      removeItem(key) {
        cache.delete(key);
      },
    };
  }

  function detectAvailability(backend) {
    if (
      !backend ||
      typeof backend.getItem !== "function" ||
      typeof backend.setItem !== "function" ||
      typeof backend.removeItem !== "function"
    ) {
      return false;
    }

    const probeKey = "__memox9_probe__";

    try {
      backend.setItem(probeKey, "1");
      backend.removeItem(probeKey);
      return true;
    } catch {
      return false;
    }
  }

  function createSafeStorage(backend) {
    const memory = createMemoryBackend();
    const available = detectAvailability(backend);

    return {
      available,
      getItem(key) {
        try {
          const value = backend?.getItem?.(key);
          if (value !== null && value !== undefined) {
            memory.setItem(key, value);
            return value;
          }
        } catch {
          return memory.getItem(key);
        }

        return memory.getItem(key);
      },
      setItem(key, value) {
        const serialized = String(value);
        memory.setItem(key, serialized);

        try {
          backend?.setItem?.(key, serialized);
          return true;
        } catch {
          return false;
        }
      },
      removeItem(key) {
        memory.removeItem(key);

        try {
          backend?.removeItem?.(key);
          return true;
        } catch {
          return false;
        }
      },
    };
  }

  function readJson(storage, key, fallback) {
    const stored = storage.getItem(key);
    if (!stored) return fallback;

    try {
      return JSON.parse(stored);
    } catch {
      return fallback;
    }
  }

  function writeJson(storage, key, value) {
    return storage.setItem(key, JSON.stringify(value));
  }

  function removeKeys(storage, keys) {
    keys.forEach((key) => storage.removeItem(key));
  }

  return {
    createSafeStorage,
    readJson,
    writeJson,
    removeKeys,
  };
});
