# Crossword · cseta.uk

A static, dependency-free crossword app with 34 puzzles in five categories. Built to be pushed to GitHub and served by Vercel on `cseta.uk`.

| Category | Puzzles |
| --- | --- |
| General knowledge (11) | Mixed Bag · Easy, Food & Drink · Easy, Everyday Things, Best of British, Science & Nature, Around the World, Sporting Life, Screen & Sound · Medium, History Lessons · Hard, **Polymath · Expert**, **Cryptic Mix · Cryptic** |
| Cyber security (5) | Foundations · Easy, Threats & Response · Medium, Architecture & Frameworks · Hard, **Deep Defence · Expert**, **Cryptic Cyber · Cryptic** |
| AI security (8) | Machine Learning Basics · Easy, AI Threats, Large Language Models, Defending AI · Medium, Agentic AI, AI Governance · Hard, **Under the Hood · Expert**, **Cryptic AI · Cryptic** |
| Economics (5) | Money Matters · Easy, Markets & Trade · Medium, The Big Picture · Hard, **The Dismal Science · Expert**, **Cryptic Economics · Cryptic** |
| Psychology (5) | Mind Basics · Easy, Famous Psychologists · Medium, Biases & Behaviour · Hard, **Mind Games · Expert**, **Cryptic Psychology · Cryptic** |

**Expert** puzzles use tougher vocabulary and less direct clues. **Cryptic** puzzles (12 clues each) follow UK newspaper style: each clue has a definition plus wordplay (anagram, hidden word, reversal, charade or double definition). Once a cryptic word is solved or revealed, the clue bar shows how the clue works.

First-time visitors start on Mixed Bag. The picker has a tab per category, and a Next puzzle button appears when you finish one.

- No build step, no npm packages, no backend, no cookies, no analytics
- Keyboard and touch play (an on-screen keyboard appears on touch devices)
- Check and reveal by letter, word or whole puzzle, with a timer
- Appearance menu: Emerald (default), Midnight, Daylight, Amethyst, High contrast or Match system, plus an optional photo background from Unsplash (11 scenes, or Cycle all) — remembered per browser
- Progress autosaves in the browser and can be exported as a **base64 progress key** to restore on any device
- Strict security headers (CSP, HSTS, frame-ancestors, etc.) set in `vercel.json`

## Files

```
index.html            page shell
styles.css            styles and theme palettes (Space Grotesk / IBM Plex Mono)
app.js                game logic, save/restore key
theme.js              theme and background switcher (loads in <head> to avoid a flash)
puzzles.js            generated puzzle data (don't edit by hand)
favicon.svg / .ico    favicon
icons/                apple-touch and PWA icons
site.webmanifest      install metadata
vercel.json           security headers and caching
tools/wordlists.json  answers and clues (edit this)
tools/generate.py     lays out the grids and writes puzzles.js
```

## Run locally

Any static server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Crossword app"
git branch -M main
git remote add origin https://github.com/jontever/cseta-crossword.git
git push -u origin main
```

(Create the empty `cseta-crossword` repo on GitHub first, or use `gh repo create jontever/cseta-crossword --public --source . --push`.)

### 2. Import into Vercel

1. In Vercel, **Add New → Project** and import the GitHub repo.
2. Framework preset: **Other**. Leave the build command and output directory empty (the repo root is served as-is).
3. Deploy. Every push to `main` redeploys automatically.

`vercel.json` pins `framework: null`, skips the install step, uses a no-op build command and serves the repo root. That way the deploy still works if the Vercel project was set up for another framework (for example a Vite app that used to live on this domain).

### 3. Point cseta.uk at it

In the project, go to **Settings → Domains** and add the domain.

- **Apex (`cseta.uk`)**: add the `A` record for `@` exactly as Vercel shows it on the Domains page, and add `www.cseta.uk` set to redirect to the apex.
- **Subdomain (e.g. `crossword.cseta.uk`)**: add a `CNAME` for `crossword` pointing to the target Vercel shows (`cname.vercel-dns.com` or a project-specific value).

If `cseta.uk` is already attached to another Vercel project, you'll need to remove it there first or use a subdomain. If you use a subdomain, update the `canonical` and `og:` URLs at the top of `index.html`.

Vercel issues the TLS certificate automatically once DNS resolves.

## Themes and backgrounds

The half-circle button in the header opens the appearance menu.

**Theme.** Emerald is the default. **Match system** follows the device's light/dark setting (and picks High contrast if the OS asks for more contrast). Stored in `localStorage` under `cseta-crossword:theme`.

**Background.** None (default), Cycle all, or one of 11 photos: Forest, Mountains, Waterfall, Ocean, Sunrise, Sunset, Space, Wildlife, Safari, Horses, Cats. Stored under `cseta-crossword:bg`. The photo sits on a fixed layer behind the page and is tinted with the current theme's `--overlay` colour so text stays readable. Phones get a portrait crop (focused on the animal for the animal photos).

**Cycle all** shows a different photo each time you open the app and moves to the next one every 5 minutes while it's open, with a slow crossfade (an instant swap if the device asks for reduced motion). The position in the cycle is kept under `cseta-crossword:bg-cycle`.

Neither setting is part of the progress key.

Themes are CSS custom properties: Midnight is the `:root` base and each theme is a `:root[data-theme="…"]` block near the end of `styles.css`. To add one, copy a block, add it to `THEMES` in `theme.js` and add a menu item in `index.html`. Photos are defined in `PHOTOS` in `theme.js` (Unsplash photo id, focal point, credit); add an entry plus a menu item and swatch in `index.html` / `styles.css`, and Cycle picks it up automatically.

### Photo credits

Photos are free to use under the [Unsplash License](https://unsplash.com/license) and are hotlinked from `images.unsplash.com`, with a credit line in the footer while a photo is showing:

| Background | Photo | Photographer |
| --- | --- | --- |
| Forest | [Silhouetted pine trees in misty forest](https://unsplash.com/photos/silhouetted-pine-trees-in-misty-forest-g-_0cain0bY) | [Daniil Silantev](https://unsplash.com/@betagamma) |
| Mountains | [Landscape photography of mountains](https://unsplash.com/photos/landscape-photography-of-mountains-twukN12EN7c) | [simon](https://unsplash.com/@simon_berger) |
| Waterfall | [Waterfall and rocky stream through a lush, dark forest](https://unsplash.com/photos/waterfall-and-rocky-stream-flow-through-a-lush-dark-forest-TWrKDYt-vVM) | [Hunter Newton](https://unsplash.com/@r7studios) |
| Ocean | [An aerial view of the ocean waves from above](https://unsplash.com/photos/an-aerial-view-of-the-ocean-waves-from-above-Vm6mxpQHh30) | [Alex varela](https://unsplash.com/@alexvarelo) |
| Sunrise | [Golden sunrise illuminates a foggy mountain landscape](https://unsplash.com/photos/golden-sunrise-illuminates-a-foggy-mountain-landscape-MaeshPdBGV4) | [Zetong Li](https://unsplash.com/@zetong) |
| Sunset | [Sea under white clouds at golden hour](https://unsplash.com/photos/sea-under-white-clouds-at-golden-hour--IMlv9Jlb24) | [Sebastien Gabriel](https://unsplash.com/@sgabriel) |
| Space | [Milky way and stars in a dark night sky](https://unsplash.com/photos/milky-way-and-stars-in-a-dark-night-sky-oQR1B87HsNs) | [Tobias Rademacher](https://unsplash.com/@tobbes_rd) |
| Wildlife | [Brown fox on snow field](https://unsplash.com/photos/brown-fox-on-snow-field-xUUZcpQlqpM) | [Ray Hennessy](https://unsplash.com/@rayhennessy) |
| Safari | [Two elephants walking on grass covered ground](https://unsplash.com/photos/two-elephants-walking-on-grass-covered-ground-BuQ1RZckYW4) | [AJ Robsin](https://unsplash.com/@ajrobsin) |
| Horses | [Brown and white horses on a green field](https://unsplash.com/photos/brown-and-white-horses-on-green-grass-field-under-blue-and-white-cloudy-sky-during-daytime-Qh044RQX2oU) | [Heyzeus Escribo](https://unsplash.com/@pqcrtivephoto) |
| Cats | [Black and white cat lying on a bamboo chair](https://unsplash.com/photos/black-and-white-cat-lying-on-brown-bamboo-chair-inside-room-gKXKBY-C-Dk) | [Manja Vitolic](https://unsplash.com/@madhatterzone) |

The browser only contacts Unsplash once someone picks a background; with None (the default) the site makes no third-party image requests. The CSP allows `img-src https://images.unsplash.com` for this. To self-host instead, download the images into `backgrounds/`, change `photoUrl()` in `theme.js` to return `/backgrounds/...` and remove `https://images.unsplash.com` from the CSP in `vercel.json`.

## Progress keys

Progress is saved to `localStorage` in the browser as you play. To move it to another device, choose **Save key**, copy the key, then on the other device choose **Restore** and paste it. One key covers every puzzle you've started.

Format:

```
CSX1.<base64url(JSON)>.<checksum>
```

- `JSON` is `{ "v": 1, "a": "<active puzzle id>", "p": { "<puzzle id>": { "g": "<grid>", "t": <seconds> } } }`
- `g` has one character per letter square in reading order: `A–Z` typed, `a–z` revealed, `.` empty, and runs of two or more empty squares compressed to `<n>.` (e.g. `AB3.C`). A puzzle solved without reveals is stored as just `=`.
- `checksum` is the FNV-1a 32-bit hash (8 hex chars) of the base64 part, used to catch truncated or mistyped keys.

The key is **encoded, not encrypted**. It holds only the letters you've entered and your time, never any personal data, and it doesn't contain the answers. On restore, the key is strictly validated (prefix, checksum, version, known puzzle ids, exact grid length, allowed characters, bounded run lengths and timer) and anything that fails is rejected. Solved status is always recomputed from the letters rather than trusted from the key.

Puzzle ids are part of the key, so don't rename an existing id in `wordlists.json` or old keys will skip that puzzle.

## Adding or editing puzzles

1. Edit `tools/wordlists.json`. Each puzzle has an `id`, `title`, `category`, `difficulty` and a list of `[answer, clue]` pairs, or `[answer, clue, explanation]` for cryptic clues (the explanation appears once the word is solved). A new category gets its own picker tab automatically; add it to `CATEGORY_ORDER` and `CATEGORY_KEYS` in `app.js` to control its position and accent colour. Answers can include spaces or hyphens (e.g. `"ZERO TRUST"`, `"ZERO-DAY"`); the enumeration `(4,5)` / `(4-3)` is worked out automatically.
2. Run `python3 tools/generate.py` (Python 3.8+, standard library only).
3. Commit the updated `puzzles.js`.

The generator builds a connected criss-cross grid, checks there are no accidental words formed by adjacent letters, and numbers the squares. Output is deterministic per puzzle id. Changing a puzzle's words changes its grid, so existing saved keys for that puzzle will no longer match and will be skipped on restore.

Puzzles with 12–16 words of mixed lengths that share common letters lay out best.

## Keyboard

| Key | Action |
| --- | --- |
| Letters | Fill square and advance |
| Backspace / Delete | Clear square |
| Arrow keys | Move (first press across the current direction switches direction) |
| Space | Switch across/down |
| Tab / Enter | Next clue (Shift for previous) |
| Click a selected square | Switch across/down |

## Security notes

`vercel.json` sets:

- `Content-Security-Policy` with `default-src 'none'`, scripts from self only, no inline script or style, fonts only from Google Fonts, `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'none'`
- `Strict-Transport-Security` (2 years, includeSubDomains, preload). Only submit to the preload list if every subdomain of `cseta.uk` serves HTTPS.
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`

User-supplied keys are never inserted as HTML; all DOM text is set with `textContent`.

If you'd rather not load Google Fonts, delete the two font `<link>` tags in `index.html` and remove the `fonts.googleapis.com` / `fonts.gstatic.com` entries from the CSP. The app falls back to system fonts.

## Licence

MIT
