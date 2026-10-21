# Crossword · cseta.uk

A static, dependency-free crossword app with three cyber security puzzles and three general knowledge puzzles. Built to be pushed to GitHub and served by Vercel on `cseta.uk`.

- No build step, no npm packages, no backend, no cookies, no analytics
- Keyboard and touch play (an on-screen keyboard appears on touch devices)
- Check and reveal by letter, word or whole puzzle, with a timer
- Progress autosaves in the browser and can be exported as a **base64 progress key** to restore on any device
- Strict security headers (CSP, HSTS, frame-ancestors, etc.) set in `vercel.json`

## Files

```
index.html            page shell
styles.css            styles (Space Grotesk / IBM Plex Mono, dark theme)
app.js                game logic, save/restore key
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

## Progress keys

Progress is saved to `localStorage` in the browser as you play. To move it to another device, choose **Save key**, copy the key, then on the other device choose **Restore** and paste it. One key covers every puzzle you've started.

Format:

```
CSX1.<base64url(JSON)>.<checksum>
```

- `JSON` is `{ "v": 1, "a": "<active puzzle id>", "p": { "<puzzle id>": { "g": "<grid>", "t": <seconds> } } }`
- `g` has one character per letter square in reading order: `A–Z` typed, `a–z` revealed, `.` empty, and runs of two or more empty squares compressed to `<n>.` (e.g. `AB3.C`).
- `checksum` is the FNV-1a 32-bit hash (8 hex chars) of the base64 part, used to catch truncated or mistyped keys.

The key is **encoded, not encrypted**. It holds only the letters you've entered and your time, never any personal data, and it doesn't contain the answers. On restore, the key is strictly validated (prefix, checksum, version, known puzzle ids, exact grid length, allowed characters, bounded run lengths and timer) and anything that fails is rejected. Solved status is always recomputed from the letters rather than trusted from the key.

Puzzle ids are part of the key, so don't rename an existing id in `wordlists.json` or old keys will skip that puzzle.

## Adding or editing puzzles

1. Edit `tools/wordlists.json`. Each puzzle has an `id`, `title`, `category`, `difficulty` and a list of `[answer, clue]` pairs. Answers can include spaces or hyphens (e.g. `"ZERO TRUST"`, `"ZERO-DAY"`); the enumeration `(4,5)` / `(4-3)` is worked out automatically.
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
