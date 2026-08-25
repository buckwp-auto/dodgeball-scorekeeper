# Agent instructions

Start here before editing this repo. Full human-facing guide: [CONTRIBUTING.md](CONTRIBUTING.md). House style: [docs/CODE_CONVENTIONS.md](docs/CODE_CONVENTIONS.md). Product behavior: [docs/FEATURES.md](docs/FEATURES.md). Cloud setup: [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).

Claude Code also loads [CLAUDE.md](CLAUDE.md), which points back here.

## Commands

```bash
npm run dev          # Vite at http://127.0.0.1:5173/
npm test             # Vitest (src/**/*.test.ts)
npm run test:e2e     # Playwright (tests/*.spec.ts)
npm run test:interop # golden CSV + fixture e2e
```

Firebase is optional. Without `.env.local`, the app is local-only (session storage + `.scrkpr`).

## Non-negotiables

- Domain logic in `src/domain/` — pure TypeScript, no React/MUI.
- UI in `src/pages/` and `src/components/`; cloud I/O in `src/cloud/`; React context in `src/state/`.
- `.scrkpr` / `DatabaseDto` fields and table names stay **PascalCase** (`Id`, `TeamIdHome`, `Tables.Team`). Newer types (`ImageRef`, `LeagueMeta`) are camelCase.
- Do **not** change `tests/fixtures/*.golden.csv` under the default Legacy stat-credit policy.
- Keep `src/domain/limits.ts` in sync with `firestore.rules`.
- Mutate the working DB through `useDatabase().mutate`, not ad-hoc `sessionStorage`.
- MUI + `sx`; stable e2e classes use the `sk-` prefix. Prefer `getByRole` in Playwright.
- Named exports, strict TypeScript, match surrounding style (no ESLint/Prettier config).
- Update `docs/FEATURES.md` for user-facing changes. Never commit `.env` or secrets.
- **Admins mass-destroy; scorers undo their game.** Admin (or local-only) for delete team/core roster, delete match, replace league data, league settings. Match/game entry must be able to undo *that game*: active roster, remove a player they added from Match/Game, event rollback, undo recorded events. Do not gate those on admin, and do not let scorers delete the core team roster.

## Tests

- New/changed domain modules: colocated `*.test.ts` (Vitest).
- Track Game / roster / Overview / import-export / stats UI: extend `tests/*.spec.ts`.
- Scoring, stats, or CSV: run `npm run test:interop`.

## PRs

Work on a feature branch. Do not push to upstream `main`. After the human reviews the diff, open a PR against upstream `main` from the fork/branch (`gh pr create`, allow maintainer edits). Title/body: why + a short test plan. See [CONTRIBUTING.md](CONTRIBUTING.md#opening-a-pull-request).
