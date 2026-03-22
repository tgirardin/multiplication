const VERSION_BUILD = "2026-03-22T06:24";

function createVersionToken(build) {
  const compact = build.replace(/[^0-9]/g, "");
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}`;
}

window.MEMOX9_VERSION = {
  build: VERSION_BUILD,
  label: VERSION_BUILD.replace("T", " "),
  token: createVersionToken(VERSION_BUILD),
};

(function loadMemox9Assets() {
  const { token } = window.MEMOX9_VERSION;
  const scripts = [
    { key: "storage", src: "safe-storage.js" },
    { key: "core", src: "game-core.js" },
    { key: "app", src: "app.js" },
  ];

  if (!document.querySelector('link[data-memox9="styles"]')) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = `styles.css?v=${token}`;
    stylesheet.dataset.memox9 = "styles";
    document.head.appendChild(stylesheet);
  }

  scripts.forEach(({ key, src }) => {
    if (document.querySelector(`script[data-memox9="${key}"]`)) {
      return;
    }

    const script = document.createElement("script");
    script.src = `${src}?v=${token}`;
    script.defer = true;
    script.dataset.memox9 = key;
    document.head.appendChild(script);
  });
})();
