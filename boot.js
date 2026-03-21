window.MEMOX9_VERSION = {
  label: "21-03-2026 02:39",
  token: "20260321-0239",
};

(function loadMemox9Assets() {
  const { token } = window.MEMOX9_VERSION;

  if (!document.querySelector('link[data-memox9="styles"]')) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = `styles.css?v=${token}`;
    stylesheet.dataset.memox9 = "styles";
    document.head.appendChild(stylesheet);
  }

  if (!document.querySelector('script[data-memox9="app"]')) {
    const appScript = document.createElement("script");
    appScript.src = `app.js?v=${token}`;
    appScript.defer = true;
    appScript.dataset.memox9 = "app";
    document.head.appendChild(appScript);
  }
})();
