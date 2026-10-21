/* Theme and background loader. Runs in <head> before first paint (no defer)
 * so there is no flash of the wrong theme. Choices are kept in localStorage.
 *   Theme:      emerald (default), system, midnight, daylight, amethyst, contrast
 *   Background: none (default), forest, mountains, space
 * Background photos are served from images.unsplash.com and only requested
 * once a background is chosen (the CSS rule for it doesn't apply otherwise).
 */
(function () {
  "use strict";

  var THEME_KEY = "cseta-crossword:theme";
  var BG_KEY = "cseta-crossword:bg";
  var DEFAULT_THEME = "emerald";
  var DEFAULT_BG = "none";

  var THEMES = {
    midnight: { label: "Midnight", color: "#0b0f17", scheme: "dark" },
    daylight: { label: "Daylight", color: "#f4f6fb", scheme: "light" },
    emerald: { label: "Emerald", color: "#06120e", scheme: "dark" },
    amethyst: { label: "Amethyst", color: "#0f0b1a", scheme: "dark" },
    contrast: { label: "High contrast", color: "#000000", scheme: "dark" }
  };

  var UTM = "?utm_source=cseta_crossword&utm_medium=referral";
  var BACKGROUNDS = {
    none: { label: "None" },
    forest: {
      label: "Forest",
      author: "Daniil Silantev",
      profile: "https://unsplash.com/@betagamma",
      photo: "https://unsplash.com/photos/silhouetted-pine-trees-in-misty-forest-g-_0cain0bY"
    },
    mountains: {
      label: "Mountains",
      author: "simon",
      profile: "https://unsplash.com/@simon_berger",
      photo: "https://unsplash.com/photos/landscape-photography-of-mountains-twukN12EN7c"
    },
    space: {
      label: "Space",
      author: "Tobias Rademacher",
      profile: "https://unsplash.com/@tobbes_rd",
      photo: "https://unsplash.com/photos/milky-way-and-stars-in-a-dark-night-sky-oQR1B87HsNs"
    }
  };

  var own = function (obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); };
  var mqLight = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  var mqContrast = window.matchMedia ? window.matchMedia("(prefers-contrast: more)") : null;

  function read(key, valid, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v !== null && valid(v) ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, v) {
    try { localStorage.setItem(key, v); } catch (e) { /* storage unavailable */ }
  }

  var validTheme = function (v) { return v === "system" || own(THEMES, v); };
  var validBg = function (v) { return own(BACKGROUNDS, v); };

  var theme = read(THEME_KEY, validTheme, DEFAULT_THEME);
  var bg = read(BG_KEY, validBg, DEFAULT_BG);

  function resolve(c) {
    if (c !== "system") return c;
    if (mqContrast && mqContrast.matches) return "contrast";
    return mqLight && mqLight.matches ? "daylight" : "midnight";
  }

  var firstApply = true;
  function apply() {
    var t = resolve(theme);
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
    if (bg === "none") root.removeAttribute("data-bg");
    else root.setAttribute("data-bg", bg);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEMES[t].color);
    syncUi();
  }

  function link(href, text) {
    var a = document.createElement("a");
    a.href = href + UTM;
    a.textContent = text;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }

  function syncUi() {
    var i, items;
    items = document.querySelectorAll("[data-theme-choice]");
    for (i = 0; i < items.length; i++) {
      items[i].setAttribute("aria-checked", String(items[i].getAttribute("data-theme-choice") === theme));
    }
    items = document.querySelectorAll("[data-bg-choice]");
    for (i = 0; i < items.length; i++) {
      items[i].setAttribute("aria-checked", String(items[i].getAttribute("data-bg-choice") === bg));
    }

    var btn = document.getElementById("btn-theme");
    if (btn) {
      var name = theme === "system" ? "Match system (" + THEMES[resolve(theme)].label + ")" : THEMES[theme].label;
      var full = name + ", background " + BACKGROUNDS[bg].label.toLowerCase();
      btn.title = "Appearance: " + full;
      btn.setAttribute("aria-label", "Change appearance. Current: " + full);
    }

    // Photo credit (Unsplash attribution), shown only while a photo is in use.
    var credit = document.getElementById("photo-credit");
    if (credit) {
      credit.textContent = "";
      var b = BACKGROUNDS[bg];
      if (b.photo) {
        credit.append(
          document.createTextNode("Background: "),
          link(b.photo, b.label + " photo"),
          document.createTextNode(" by "),
          link(b.profile, b.author),
          document.createTextNode(" on "),
          link("https://unsplash.com/", "Unsplash")
        );
        credit.hidden = false;
      } else {
        credit.hidden = true;
      }
    }
  }

  function setTheme(c) {
    if (!validTheme(c)) return;
    theme = c;
    write(THEME_KEY, c);
    apply();
  }
  function setBg(c) {
    if (!validBg(c)) return;
    bg = c;
    write(BG_KEY, c);
    apply();
  }

  function onSystemChange() { if (theme === "system") apply(); }
  [mqLight, mqContrast].forEach(function (mq) {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener("change", onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  });

  apply();

  document.addEventListener("DOMContentLoaded", function () {
    syncUi();
    document.addEventListener("click", function (ev) {
      if (!ev.target.closest) return;
      var t = ev.target.closest("[data-theme-choice]");
      var b = ev.target.closest("[data-bg-choice]");
      if (!t && !b) return;
      if (t) setTheme(t.getAttribute("data-theme-choice"));
      if (b) setBg(b.getAttribute("data-bg-choice"));
      var list = document.getElementById("menu-theme");
      var btn = document.getElementById("btn-theme");
      if (list) list.hidden = true;
      if (btn) { btn.setAttribute("aria-expanded", "false"); btn.focus(); }
    });
  });

  // Keep other open tabs in step.
  window.addEventListener("storage", function (ev) {
    if (ev.key === THEME_KEY) theme = read(THEME_KEY, validTheme, DEFAULT_THEME);
    else if (ev.key === BG_KEY) bg = read(BG_KEY, validBg, DEFAULT_BG);
    else return;
    apply();
  });

  window.__theme = {
    setTheme: setTheme,
    setBackground: setBg,
    get: function () { return { theme: theme, resolved: resolve(theme), background: bg }; }
  };
})();
