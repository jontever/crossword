/* Theme and background loader. Runs in <head> before first paint (no defer)
 * so there is no flash of the wrong theme. Choices are kept in localStorage.
 *   Theme:      emerald (default), system, midnight, daylight, amethyst, contrast
 *   Background: none (default), cycle, or one of the photos below
 * Photos are served from images.unsplash.com and only requested once a
 * background is chosen. "cycle" shows a different photo on each visit and
 * moves to the next one every few minutes, with a slow crossfade.
 */
(function () {
  "use strict";

  var THEME_KEY = "cseta-crossword:theme";
  var BG_KEY = "cseta-crossword:bg";
  var CYCLE_KEY = "cseta-crossword:bg-cycle";
  var DEFAULT_THEME = "emerald";
  var DEFAULT_BG = "none";
  var CYCLE_MS = 5 * 60 * 1000;

  var THEMES = {
    midnight: { label: "Midnight", color: "#0b0f17", scheme: "dark" },
    daylight: { label: "Daylight", color: "#f4f6fb", scheme: "light" },
    emerald: { label: "Emerald", color: "#06120e", scheme: "dark" },
    amethyst: { label: "Amethyst", color: "#0f0b1a", scheme: "dark" },
    contrast: { label: "High contrast", color: "#000000", scheme: "dark" }
  };

  // Free photos under the Unsplash License. `pos` is the desktop focal
  // point; `crop: "entropy"` lets Unsplash pick the subject for the portrait
  // phone crop (used for animals so they aren't cut off).
  var UTM = "?utm_source=cseta_crossword&utm_medium=referral";
  var PHOTOS = {
    forest: {
      label: "Forest", id: "photo-1792090894054-a5312e786da1", pos: "center 70%",
      author: "Daniil Silantev", profile: "https://unsplash.com/@betagamma",
      photo: "https://unsplash.com/photos/silhouetted-pine-trees-in-misty-forest-g-_0cain0bY"
    },
    mountains: {
      label: "Mountains", id: "photo-1500964757637-c85e8a162699", pos: "center 60%",
      author: "simon", profile: "https://unsplash.com/@simon_berger",
      photo: "https://unsplash.com/photos/landscape-photography-of-mountains-twukN12EN7c"
    },
    waterfall: {
      label: "Waterfall", id: "photo-1783473855377-5dc01c0fbd80", pos: "center",
      author: "Hunter Newton", profile: "https://unsplash.com/@r7studios",
      photo: "https://unsplash.com/photos/waterfall-and-rocky-stream-flow-through-a-lush-dark-forest-TWrKDYt-vVM"
    },
    ocean: {
      label: "Ocean", id: "photo-1670860774847-22c234df0f1e", pos: "center",
      author: "Alex varela", profile: "https://unsplash.com/@alexvarelo",
      photo: "https://unsplash.com/photos/an-aerial-view-of-the-ocean-waves-from-above-Vm6mxpQHh30"
    },
    sunrise: {
      label: "Sunrise", id: "photo-1743309411498-a0f4f4b96b65", pos: "center 40%",
      author: "Zetong Li", profile: "https://unsplash.com/@zetong",
      photo: "https://unsplash.com/photos/golden-sunrise-illuminates-a-foggy-mountain-landscape-MaeshPdBGV4"
    },
    sunset: {
      label: "Sunset", id: "photo-1503803548695-c2a7b4a5b875", pos: "center 45%",
      author: "Sebastien Gabriel", profile: "https://unsplash.com/@sgabriel",
      photo: "https://unsplash.com/photos/sea-under-white-clouds-at-golden-hour--IMlv9Jlb24"
    },
    space: {
      label: "Space", id: "photo-1742626157111-59f3f1019a8a", pos: "center", q: 60,
      author: "Tobias Rademacher", profile: "https://unsplash.com/@tobbes_rd",
      photo: "https://unsplash.com/photos/milky-way-and-stars-in-a-dark-night-sky-oQR1B87HsNs"
    },
    wildlife: {
      label: "Wildlife", id: "photo-1474511320723-9a56873867b5", pos: "35% center", crop: "entropy",
      author: "Ray Hennessy", profile: "https://unsplash.com/@rayhennessy",
      photo: "https://unsplash.com/photos/brown-fox-on-snow-field-xUUZcpQlqpM"
    },
    safari: {
      label: "Safari", id: "photo-1521651201144-634f700b36ef", pos: "center 60%", crop: "entropy",
      author: "AJ Robsin", profile: "https://unsplash.com/@ajrobsin",
      photo: "https://unsplash.com/photos/two-elephants-walking-on-grass-covered-ground-BuQ1RZckYW4"
    },
    horses: {
      label: "Horses", id: "photo-1614788888372-db5285f4e83d", pos: "center 65%", crop: "entropy",
      author: "Heyzeus Escribo", profile: "https://unsplash.com/@pqcrtivephoto",
      photo: "https://unsplash.com/photos/brown-and-white-horses-on-green-grass-field-under-blue-and-white-cloudy-sky-during-daytime-Qh044RQX2oU"
    },
    cats: {
      label: "Cats", id: "photo-1514888286974-6c03e2ca1dba", pos: "center 40%", crop: "entropy",
      author: "Manja Vitolic", profile: "https://unsplash.com/@madhatterzone",
      photo: "https://unsplash.com/photos/black-and-white-cat-lying-on-brown-bamboo-chair-inside-room-gKXKBY-C-Dk"
    },
    dogs: {
      label: "Dogs", id: "photo-1621266778264-2122ca94a05c", pos: "center 40%", crop: "entropy",
      author: "Helena Lopes", profile: "https://unsplash.com/@helenalopesph",
      photo: "https://unsplash.com/photos/golden-retriever-sitting-on-ground-during-daytime-jt77duEXQvg"
    }
  };
  var PHOTO_KEYS = Object.keys(PHOTOS);
  var LABELS = { none: "None", cycle: "Cycle" };

  var own = function (obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); };
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : null; };
  var mqLight = mq("(prefers-color-scheme: light)");
  var mqContrast = mq("(prefers-contrast: more)");
  var mqPhone = mq("(max-width: 700px)");
  var mqReduce = mq("(prefers-reduced-motion: reduce)");

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
  var validBg = function (v) { return v === "none" || v === "cycle" || own(PHOTOS, v); };

  var theme = read(THEME_KEY, validTheme, DEFAULT_THEME);
  var bg = read(BG_KEY, validBg, DEFAULT_BG);
  var shown = null; // photo key currently on screen

  function resolve(c) {
    if (c !== "system") return c;
    if (mqContrast && mqContrast.matches) return "contrast";
    return mqLight && mqLight.matches ? "daylight" : "midnight";
  }

  function photoUrl(key) {
    var p = PHOTOS[key];
    var q = p.q || 70;
    var size = mqPhone && mqPhone.matches
      ? "w=900&h=1600" + (p.crop ? "&crop=" + p.crop : "")
      : "w=1920";
    return "https://images.unsplash.com/" + p.id + "?auto=format&fit=crop&" + size + "&q=" + q;
  }

  /* ---------- cycle ---------- */

  function nextCycleKey() {
    var i = parseInt(read(CYCLE_KEY, function (v) { return /^\d{1,3}$/.test(v); }, "0"), 10);
    var key = PHOTO_KEYS[i % PHOTO_KEYS.length];
    write(CYCLE_KEY, String((i + 1) % PHOTO_KEYS.length));
    return key;
  }

  var cycleTimer = null;
  function scheduleCycle() {
    clearInterval(cycleTimer);
    cycleTimer = null;
    if (bg !== "cycle") return;
    cycleTimer = setInterval(function () {
      if (document.hidden) return;
      showPhoto(nextCycleKey(), true);
    }, CYCLE_MS);
  }

  /* ---------- painting ---------- */

  function paint(key) {
    var root = document.documentElement;
    shown = key;
    if (!key) {
      root.removeAttribute("data-bg");
      root.style.removeProperty("--bg-photo");
      root.style.removeProperty("--bg-pos");
    } else {
      root.setAttribute("data-bg", key);
      root.style.setProperty("--bg-photo", 'url("' + photoUrl(key) + '")');
      root.style.setProperty("--bg-pos", PHOTOS[key].pos || "center");
    }
    syncUi();
  }

  // Switch photo; with `fade`, wait for the new image to load, then dissolve
  // the old one away on a temporary layer above it.
  function showPhoto(key, fade) {
    var reduce = mqReduce && mqReduce.matches;
    if (!fade || reduce || !shown || !document.body || key === shown) { paint(key); return; }
    var img = new Image();
    var done = false;
    var go = function () {
      if (done) return;
      done = true;
      var before = getComputedStyle(document.body, "::before");
      var layer = document.createElement("div");
      layer.className = "bg-fade";
      layer.setAttribute("aria-hidden", "true");
      layer.style.backgroundImage = before.backgroundImage;
      layer.style.backgroundPosition = before.backgroundPosition;
      document.body.appendChild(layer);
      paint(key);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { layer.classList.add("out"); });
      });
      var remove = function () { if (layer.parentNode) layer.parentNode.removeChild(layer); };
      layer.addEventListener("transitionend", remove);
      setTimeout(remove, 3000);
    };
    img.onload = go;
    img.onerror = go;
    setTimeout(go, 4000);
    img.src = photoUrl(key);
  }

  var firstApply = true;
  function apply(bgChanged) {
    var t = resolve(theme);
    var root = document.documentElement;
    // Suppress colour transitions for a theme swap.
    if (!firstApply) {
      root.classList.add("theme-switching");
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { root.classList.remove("theme-switching"); });
      });
    }
    root.setAttribute("data-theme", t);
    root.style.colorScheme = THEMES[t].scheme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEMES[t].color);

    if (firstApply || bgChanged) {
      var key = bg === "none" ? null : bg === "cycle" ? nextCycleKey() : bg;
      showPhoto(key, !firstApply && !!key);
      scheduleCycle();
    }
    firstApply = false;
    syncUi();
  }

  /* ---------- menu + credit ---------- */

  function link(href, text) {
    var a = document.createElement("a");
    a.href = href + UTM;
    a.textContent = text;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }

  function bgLabel(k) { return own(PHOTOS, k) ? PHOTOS[k].label : LABELS[k]; }

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
      var bgName = bg === "cycle" && shown ? "cycling (" + PHOTOS[shown].label + ")" : bgLabel(bg).toLowerCase();
      var full = name + ", background " + bgName;
      btn.title = "Appearance: " + full;
      btn.setAttribute("aria-label", "Change appearance. Current: " + full);
    }

    // Unsplash attribution for whichever photo is on screen.
    var credit = document.getElementById("photo-credit");
    if (credit) {
      credit.textContent = "";
      var p = shown && PHOTOS[shown];
      if (p) {
        credit.append(
          document.createTextNode("Background: "),
          link(p.photo, p.label + " photo"),
          document.createTextNode(" by "),
          link(p.profile, p.author),
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
    apply(false);
  }
  function setBg(c) {
    if (!validBg(c)) return;
    bg = c;
    write(BG_KEY, c);
    apply(true);
  }

  function onSystemChange() { if (theme === "system") apply(false); }
  [mqLight, mqContrast].forEach(function (m) {
    if (!m) return;
    if (m.addEventListener) m.addEventListener("change", onSystemChange);
    else if (m.addListener) m.addListener(onSystemChange);
  });
  // Swap between the landscape and portrait crop when crossing the breakpoint.
  if (mqPhone) {
    var onPhone = function () { if (shown) paint(shown); };
    if (mqPhone.addEventListener) mqPhone.addEventListener("change", onPhone);
    else if (mqPhone.addListener) mqPhone.addListener(onPhone);
  }

  apply(true);

  // Puzzle picker collapsed/expanded, applied here (before first paint) so
  // the layout doesn't jump; app.js handles the toggle itself.
  if (read("cseta-crossword:picker", function (v) { return v === "collapsed" || v === "open"; }, "open") === "collapsed") {
    document.documentElement.classList.add("picker-collapsed");
  }

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
    if (ev.key === THEME_KEY) { theme = read(THEME_KEY, validTheme, DEFAULT_THEME); apply(false); }
    else if (ev.key === BG_KEY) { bg = read(BG_KEY, validBg, DEFAULT_BG); apply(true); }
  });

  window.__theme = {
    setTheme: setTheme,
    setBackground: setBg,
    nextPhoto: function () { if (bg === "cycle") showPhoto(nextCycleKey(), true); },
    photos: PHOTO_KEYS.slice(),
    get: function () { return { theme: theme, resolved: resolve(theme), background: bg, showing: shown }; }
  };
})();
