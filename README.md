# Junior Entrepreneur

Lemonade-stand style game (vanilla HTML / CSS / JS). One corner juice stand for v1: set a recipe, buy ingredients, set a price, sell each day, try to profit.

## Play locally

Open `index.html` in your browser (`file://`), or from this folder run:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

**Play on GitHub Pages:** https://iagreen59.github.io/junior-entrepreneur/

No build step or install is required — open the HTML file and play.

## Cursor workflow

1. Plan and build early slices on PC.
2. Later slices: launch **Cloud Agents** from iPhone (not Remote Control on Windows).
3. Review PRs on phone, merge, then `git pull` on PC and play-test.

Cloud Agents should follow **[PLAN.md](PLAN.md)** (one phase per PR; honor the Phase status checkboxes). Phases **0–8** are done; the post–Phase-8 entrepreneur expansion roadmap is Phases **9–19** in that file.

Cloud Agents: connect this GitHub repo in the [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents#environments). This repo uses a minimal `.cursor/environment.json` (static site, no npm).
