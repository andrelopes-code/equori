// Runs before the stylesheet and the application load, so the first paint already holds the
// stored scheme. The resolution mirrors applyScheme in src/theme/scheme.ts. It is a file, not an
// inline script, because the CSP of ADR 008 forbids inline scripts.
(function () {
  var scheme = "dark";
  try {
    var stored = localStorage.getItem("equori.scheme");
    if (stored === "light") scheme = "light";
    if (stored === "system") {
      scheme = matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
  } catch {
    // Storage is unavailable: the dark default stays.
  }
  document.documentElement.setAttribute("data-slotted-scheme", scheme);
  document
    .querySelector('meta[name="theme-color"]')
    .setAttribute("content", scheme === "light" ? "#f9fafe" : "#0c0c0f");
})();
