#!/usr/bin/env python3
"""
Build puzzles.js from tools/wordlists.json.

Lays each word list out as a criss-cross grid (every letter belongs to a word,
no accidental adjacent letters), validates it, numbers it and writes the data
file the app loads. Deterministic: the same input always gives the same grid.

    python3 tools/generate.py

To add a puzzle, append an entry to wordlists.json and re-run. Puzzle ids are
part of saved progress keys, so don't rename an existing id.
"""
import json
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "wordlists.json"
OUT = ROOT / "puzzles.js"

ATTEMPTS = 4000
MAX_SIDE = 17


def enumeration(text):
    parts = re.split(r"([ \-])", text.strip())
    out = ""
    for p in parts:
        if p == " ":
            out += ","
        elif p == "-":
            out += "-"
        elif p:
            out += str(len(p))
    return f"({out})"


def clean(text):
    return re.sub(r"[^A-Z]", "", text.upper())


class Grid:
    def __init__(self):
        self.cells = {}      # (r, c) -> letter
        self.used = {}       # (r, c) -> set of directions using the cell
        self.placed = []     # (word_index, r, c, dir)

    def can_place(self, word, r, c, d):
        dr, dc = (0, 1) if d == "A" else (1, 0)
        # cells immediately before and after must be empty
        if (r - dr, c - dc) in self.cells:
            return -1
        if (r + dr * len(word), c + dc * len(word)) in self.cells:
            return -1
        crossings = 0
        for i, ch in enumerate(word):
            rr, cc = r + dr * i, c + dc * i
            existing = self.cells.get((rr, cc))
            if existing is not None:
                if existing != ch or d in self.used[(rr, cc)]:
                    return -1
                crossings += 1
            else:
                # side neighbours must be empty, or we'd create stray words
                side = [(rr + dc, cc + dr), (rr - dc, cc - dr)]
                if any(s in self.cells for s in side):
                    return -1
        return crossings

    def place(self, idx, word, r, c, d):
        dr, dc = (0, 1) if d == "A" else (1, 0)
        for i, ch in enumerate(word):
            key = (r + dr * i, c + dc * i)
            self.cells[key] = ch
            self.used.setdefault(key, set()).add(d)
        self.placed.append((idx, r, c, d))

    def bounds(self):
        rs = [k[0] for k in self.cells]
        cs = [k[1] for k in self.cells]
        return min(rs), max(rs), min(cs), max(cs)


def candidate_spots(grid, word):
    spots = []
    for (r, c), ch in list(grid.cells.items()):
        for i, wch in enumerate(word):
            if wch != ch:
                continue
            for d in ("A", "D"):
                if d in grid.used[(r, c)]:
                    continue
                sr, sc = (r, c - i) if d == "A" else (r - i, c)
                x = grid.can_place(word, sr, sc, d)
                if x > 0:
                    spots.append((x, sr, sc, d))
    return spots


def attempt(words, rng):
    order = list(range(len(words)))
    # mostly longest-first, with some shuffling for variety
    order.sort(key=lambda i: -len(words[i]) + rng.random() * 4)
    g = Grid()
    first = order[0]
    g.place(first, words[first], 0, 0, rng.choice("AD"))
    pending = order[1:]
    progress = True
    while pending and progress:
        progress = False
        for idx in list(pending):
            spots = candidate_spots(g, words[idx])
            if not spots:
                continue
            r0, r1, c0, c1 = g.bounds()

            def score(s):
                x, sr, sc, d = s
                er = sr + (len(words[idx]) - 1 if d == "D" else 0)
                ec = sc + (len(words[idx]) - 1 if d == "A" else 0)
                h = max(r1, er) - min(r0, sr) + 1
                w = max(c1, ec) - min(c0, sc) + 1
                return (x * 10) - (h * w) * 0.15 - abs(h - w) * 0.6 + rng.random()

            best = max(spots, key=score)
            g.place(idx, words[idx], best[1], best[2], best[3])
            pending.remove(idx)
            progress = True
    return g, pending


def evaluate(g, words):
    r0, r1, c0, c1 = g.bounds()
    h, w = r1 - r0 + 1, c1 - c0 + 1
    crossings = sum(1 for v in g.used.values() if len(v) == 2)
    return h, w, crossings


def validate(rows, cols, entries):
    """Rebuild the grid from the entries and confirm every run of 2+ letters
    in either direction is exactly one listed entry."""
    grid = [[None] * cols for _ in range(rows)]
    for e in entries:
        dr, dc = (0, 1) if e["dir"] == "across" else (1, 0)
        for i, ch in enumerate(e["answer"]):
            r, c = e["row"] + dr * i, e["col"] + dc * i
            assert 0 <= r < rows and 0 <= c < cols, "out of bounds"
            assert grid[r][c] in (None, ch), f"clash at {r},{c}"
            grid[r][c] = ch
    listed = {(e["dir"], e["row"], e["col"], e["answer"]) for e in entries}
    found = set()
    for r in range(rows):
        c = 0
        while c < cols:
            if grid[r][c] and (c + 1 < cols and grid[r][c + 1]):
                s = c
                while c < cols and grid[r][c]:
                    c += 1
                found.add(("across", r, s, "".join(grid[r][s:c])))
            c += 1
    for c in range(cols):
        r = 0
        while r < rows:
            if grid[r][c] and (r + 1 < rows and grid[r + 1][c]):
                s = r
                while r < rows and grid[r][c]:
                    r += 1
                found.add(("down", s, c, "".join(grid[x][c] for x in range(s, r))))
            r += 1
    assert found == listed, f"stray or missing runs: {found ^ listed}"
    # connectivity
    cells = {(r, c) for r in range(rows) for c in range(cols) if grid[r][c]}
    start = next(iter(cells))
    seen, stack = {start}, [start]
    while stack:
        r, c = stack.pop()
        for n in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if n in cells and n not in seen:
                seen.add(n)
                stack.append(n)
    assert seen == cells, "grid is not connected"


def build(puzzle):
    raw = puzzle["words"]
    words = [clean(w) for w, _ in raw]
    seed = sum(ord(ch) for ch in puzzle["id"])
    rng = random.Random(seed)
    best = None
    for _ in range(ATTEMPTS):
        g, missing = attempt(words, rng)
        if missing:
            continue
        h, w, x = evaluate(g, words)
        if max(h, w) > MAX_SIDE:
            continue
        key = (x * 3 - h * w * 0.08 - abs(h - w) * 0.5)
        if best is None or key > best[0]:
            best = (key, g)
    if best is None:
        sys.exit(f"Could not fit all words for {puzzle['id']}; try fewer or longer-overlapping words")
    g = best[1]
    r0, r1, c0, c1 = g.bounds()
    rows, cols = r1 - r0 + 1, c1 - c0 + 1

    # number the starts in reading order
    starts = sorted({(r - r0, c - c0) for _, r, c, _ in g.placed})
    numbers = {pos: n + 1 for n, pos in enumerate(starts)}

    entries = []
    for idx, r, c, d in g.placed:
        rr, cc = r - r0, c - c0
        entries.append({
            "num": numbers[(rr, cc)],
            "dir": "across" if d == "A" else "down",
            "row": rr,
            "col": cc,
            "answer": words[idx],
            "clue": raw[idx][1],
            "enum": enumeration(raw[idx][0]),
        })
    entries.sort(key=lambda e: (e["dir"] != "across", e["num"]))
    validate(rows, cols, entries)
    return {
        "id": puzzle["id"],
        "title": puzzle["title"],
        "category": puzzle["category"],
        "difficulty": puzzle["difficulty"],
        "rows": rows,
        "cols": cols,
        "entries": entries,
    }


def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    ids = [p["id"] for p in data]
    assert len(ids) == len(set(ids)), "duplicate puzzle ids"
    out = []
    for p in data:
        built = build(p)
        x = sum(1 for _ in built["entries"])
        print(f"{p['id']:<22} {built['rows']:>2}x{built['cols']:<2}  {x} entries")
        out.append(built)
    js = (
        "// Generated by tools/generate.py from tools/wordlists.json. Do not edit by hand.\n"
        "window.PUZZLES = " + json.dumps(out, indent=1) + ";\n"
    )
    OUT.write_text(js, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
