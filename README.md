# Dodgeball Scorekeeper

Static React scorekeeper for dodgeball matches: teams, rosters, games, `.scrkpr` import/export, and match statistics CSV (compatible with the legacy scorekeeper database format).

## Quick start

```bash
npm install
npm ci --prefix react-app
npx playwright install chromium

npm run dev          # http://127.0.0.1:5173/
npm run build
npm run preview      # production build at :5173
npm run test         # vitest (statistics / interop)
npm run test:e2e     # Playwright
```

## Layout

| Path | Purpose |
|------|---------|
| `react-app/` | Vite + React 19 app (`src/`, domain logic, UI) |
| `tests/` | Playwright e2e + `fixtures/` (`.scrkpr` + golden CSV) |
| `.github/workflows/gh-pages.yml` | Deploy to GitHub Pages |

## Data

- Session storage key: `SCOREKEEPER_DATA`
- Export/import: **Download Database** / **Load from file** on Overview (`.scrkpr` JSON); **Load sample league (demo)** for the six-team fixture

## GitHub Pages

Use a repo named **`dodgeball-score`** → `https://<owner>.github.io/dodgeball-score/`

1. **Settings → Pages → Source: GitHub Actions**
2. Push to `main` or run the **GitHub Pages** workflow

CI sets `GITHUB_PAGES=true` so Vite `base` is `/<repo>/`. Local dev uses `base: '/'`.

```bash
GITHUB_PAGES=true GITHUB_REPOSITORY=willbuck/dodgeball-score npm run build:gh-pages
```

## Tests

- **`npm run test:interop`** — vitest CSV parity vs `tests/fixtures/*.golden.csv`, plus Playwright fixture load/CSV download
- Golden fixtures were captured from the original WASM scorekeeper; the app remains format-compatible
