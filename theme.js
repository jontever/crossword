/* Theme loader. Runs in <head> before first paint (no defer) so there is no
 * flash of the wrong theme. The choice is kept in localStorage; "system"
 * follows the OS light/dark and high-contrast settings.
 */
(function () {
  "use strict";

  var KEY = "cseta-crossword:theme";
  var THEMES = {
    midnight: { label: "Midnight", color: "#0b0f17", scheme: "dark" },
    daylight: { label: "Daylight", color: "#f4f6fb", scheme: "light" },
    emerald: { label: "Emerald", color: "#06120e", scheme: "dark" },
    amethyst: { label: "Amethyst", color: "#0f0b1a", scheme: "dark" },
    contrast: { label: "High contrast", color: "#000000", scheme: "dark" }
  };
  var has = function (k) { return Object.prototype.hasOwnProperty.call(THEMES, k); };
  var mqLight = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  var mqContrast = window.matchMedia ? window.matchMedia("(prefers-contrast: more)") : null;

  function readChoice() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "system" || has(v) ? v : "system";
    } catch (e) {
      return "system";
    }
  }

  var choice = readChoice();

  function resolve(c) {
    if (c !== "system") return c;
    if (mqContrast && mqContrast.matches) return "contrast";
    return mqLight && mqLight.matches ? "daylight" : "midnight";
  }

  var firstApply = true;
  function apply() {
    var t = resolve(choice);
    var root = document.documentElement;
    // Suppress colour transitions for the swap so nothing animates through
    // the old palette.
    if (!firstApply) {
      root.classList.add("theme-switching");
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { root.classList.remove("theme-switching"); });
      });
    }
    firstApply = false;
    root.setAttribute("data-theme", t);
    root.style.colorScheme = THEMES[t].scheme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEMES[t].color);
    syncMenu();
  }

  function syncMenu() {
    var items = document.querySelectorAll("[data-theme-choice]");
    for (var i = 0; i < items.length; i++) {
      items[i].setAttribute("aria-checked", String(items[i].getAttribute("data-theme-choice") === choice));
    }
    var btn = document.getElementById("btn-theme");
    if (btn) {
      var name = choice === "system" ? "Match system (" + THEMES[resolve(choice)].label + ")" : THEMES[choice].label;
      btn.title = "Theme: " + name;
      btn.setAttribute("aria-label", "Change theme. Current: " + name);
    }
  }

  function set(c) {
    if (c !== "system" && !has(c)) return;
    choice = c;
    try { localStorage.setItem(KEY, c); } catch (e) { /* storage unavailable */ }
    apply();
  }

  function onSystemChange() { if (choice === "system") apply(); }
  [mqLight, mqContrast].forEach(function (mq) {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener("change", onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  });

  apply();

  document.addEventListener("DOMContentLoaded", function () {
    syncMenu();
    document.addEventListener("click", function (ev) {
      var item = ev.target.closest && ev.target.closest("[data-theme-choice]");
      if (!item) return;
      set(item.getAttribute("data-theme-choice"));
      var list = document.getElementById("menu-theme");
      var btn = document.getElementById("btn-theme");
      if (list) list.hidden = true;
      if (btn) { btn.setAttribute("aria-expanded", "false"); btn.focus(); }
    });
  });

  // Other tabs: keep in step if the theme is changed elsewhere.
  window.addEventListener("storage", function (ev) {
    if (ev.key === KEY) { choice = readChoice(); apply(); }
  });

  window.__theme = { set: set, get: function () { return choice; }, resolved: function () { return resolve(choice); } };
})();
