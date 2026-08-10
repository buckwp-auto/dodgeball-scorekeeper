# Code conventions

House style for this repo. There is no ESLint/Prettier config — **match surrounding code**. Prefer small, reviewable diffs over drive-by refactors.

Related: [FEATURES.md](./FEATURES.md) (product behavior), [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) (cloud), [CONTRIBUTING.md](../CONTRIBUTING.md) (how to send a PR). Agents: [AGENTS.md](../AGENTS.md).

## Principles

- **Domain first.** Scoring, stats, roster, and `.scrkpr` shape live in `react-app/src/domain/` as pure TypeScript. Pages and components call domain functions; they do not reimplement rules.
- **Keep the legacy format stable.** Table names and row fields on `DatabaseDto` are PascalCase (`Id`, `TeamIdHome`, `Tables.Team`) to stay compatible with the original WASM scorekeeper. Do not rename them for “modern” style.
- **Golden CSV is a contract.** Under the default **Legacy** stat-credit policy, `tests/fixtures/*.golden.csv` must stay byte-identical. Display stats / credit views sit *on top* of the engine — they do not change CSV output.
- **Limits are shared.** String lengths and write quotas in `react-app/src/domain/limits.ts` must stay in sync with [`firestore.rules`](../firestore.rules). Changing one without the other is a bug.
- **UI is MUI, not custom CSS.** Layout and theming use `@mui/material` + `sx`. Global CSS is only for Playwright hooks, a few layout grids, and legacy `bw-*` search widgets.
- **Admins mass-destroy; scorers undo their game.** League admins (and local-only mode) own league-wide destructive actions: delete teams/core roster players, delete matches, replace shared league data, change league settings. People entering a match or game must be able to **undo their own scoring work** without being admin: change who’s active in a game, remove a player they added by mistake from Match/Game add, roll back events when editing that game’s roster, undo/delete events they recorded. Do not require admin for those, and do not let match/game entry delete the core team roster or other mass-destroy paths.

## Layout

| Path | Purpose |
|------|---------|
| `react-app/src/domain/` | Pure logic: database, events, elimination, hotkeys, statistics, limits |
| `react-app/src/pages/` | Route screens (`OverviewPage`, `GamePage`, …) |
| `react-app/src/components/` | Shared UI (`stats/`, `trackGame/`, `Ui.tsx`, …) |
| `react-app/src/state/` | React context: `DatabaseContext`, `AuthContext`, `LeagueContext`, `ColorModeContext` |
| `react-app/src/cloud/` | Firebase Auth / Firestore API (no UI) |
| `react-app/src/hooks/` | Reusable hooks (`useDocumentHotkeys`, `useLastScoring`, …) |
| `react-app/src/theme.ts` | MUI theme (`createAppTheme`, primary `#1565c0`, light/dark) |
| `tests/` | Playwright e2e (`*.spec.ts`) + helpers |
| `tests/fixtures/` | `.scrkpr` + golden CSV + sample league |
| `docs/` | Product and contributor docs |
| `firestore.rules` | Cloud security rules |

Root `package.json` scripts proxy into `react-app/` (`dev`, `build`, `test`) and run Playwright from the repo root (`test:e2e`).

## TypeScript & formatting

- **Strict TypeScript** (`strict`, `noUnusedLocals`, `noUnusedParameters`). No `any` unless wrapping unknown JSON at a parse boundary.
- **2-space indent**, **single quotes**, **semicolons**, trailing commas on multi-line lists.
- **Named exports** for components, hooks, and domain functions — not `export default`.
- Prefer **functions over classes**. Domain code is mostly pure functions + small typed rows.
- Types live next to the module that owns them, or in `domain/types.ts` for shared `.scrkpr` rows (`TeamRow`, `MatchRow`, `DatabaseDto`, `Guid`).
- `Guid` is a `string` alias for entity ids. Use it on public domain APIs.
- Import order (loose, match neighbors): external packages → React / router → local components → domain → state / cloud.

```ts
import { Box, Button, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '../components/Ui';
import { getMatches } from '../domain/database';
import { useDatabase } from '../state/DatabaseContext';
```

## Domain vs UI

**Do**

- Put new scoring / stats / roster rules in `domain/`, with a colocated `*.test.ts`.
- Mutate the working database through `useDatabase().mutate(fn, commitMessage)` so session storage + history commits stay consistent.
- Parse untrusted JSON (`normalizeDatabase`, `parseImageRef`, cloud docs) before using it.

**Don’t**

- Import React, MUI, or `window` from `domain/` (storage helpers that already exist there are the exception).
- Encode business rules only in JSX (`if (result === 3)` in a button handler).
- Bypass `mutate` / context and write `sessionStorage` from a page.

Cloud types (`LeagueMeta`, `RosterDoc`, `MatchDoc`) are camelCase and live under `cloud/`. They are a sync envelope around PascalCase `.scrkpr` tables, not a second data model.

### Naming: two conventions on purpose

| Layer | Style | Example |
|-------|--------|---------|
| `.scrkpr` / `DatabaseDto` rows | PascalCase fields & table names | `team.Id`, `match.TeamIdHome`, `Tables.GamePlayer` |
| Newer domain & cloud types | camelCase | `ImageRef.url`, `StatsScope`, `LeagueMeta.adminUid` |
| UI / hooks / locals | camelCase | `hasMatches`, `fileInputRef` |
| React components | PascalCase | `EntityAvatar`, `SeeStatsButton` |
| Storage keys | `SCOREKEEPER_*` | `SCOREKEEPER_DATA`, `SCOREKEEPER_ACTIVE_LEAGUE`, `SCOREKEEPER_COLOR_MODE` |

When adding a persisted field on a `.scrkpr` row, keep PascalCase and make it optional (`YoutubeUrl?: string | null`) so old files still load.

## React & MUI

- Function components only. Pages take route params via `useParams` / `useNavigate`.
- Prefer MUI primitives (`Stack`, `Box`, `Paper`, `TextField`, `Button`, `Dialog`, `Alert`) over raw HTML.
- `TextField` / compact controls: `size="small"`. Buttons: `variant="contained"` for primary actions, `text` for secondary. Don’t uppercase labels (`textTransform: 'none'` when needed).
- MUI v6+ uses **`slotProps`**, not deprecated `InputProps` / `inputProps`.
- Theme color is **`#1565c0`** primary / `#00838f` secondary (`createAppTheme` in `theme.ts`). Light/dark follow `SCOREKEEPER_COLOR_MODE` (system / light / dark). Don’t introduce a second palette without updating the theme.
- Destructive actions (delete match/game/team, replace cloud league, remove a match-added player, roster rollback) need a **confirm dialog**.
- Shared chrome: `PageHeader` from `components/Ui.tsx`, `EntityAvatar` for logos/photos, `SeeStatsButton` for stats entry points.
- Image URLs are **https only** (`imageRef.ts`). Paste fields, never file upload / Cloud Storage (yet).

```tsx
<TextField
  size="small"
  fullWidth
  value={name}
  slotProps={{ htmlInput: { maxLength: MAX_TEAM_NAME } }}
  onChange={(event) => setName(event.target.value)}
/>
```

## CSS & Playwright selectors

- Prefer `sx` on MUI components. Add global CSS in `index.css` only when a selector must be stable for e2e or a layout grid isn’t expressible cleanly in `sx`.
- **Stable class prefix `sk-`** for scorekeeper UI that tests click or assert (`sk-layout`, `sk-menu-link`, `sk-match`, `sk-team`, `sk-player`, `sk-editor-grid`, `sk-game-timeline`, `sk-stats-table`, …).
- Legacy **`bw-*`** classes (`bw-input-text`, `bw-result`, `bw-button`) remain on search/create widgets; keep them if you touch those controls.
- In Playwright, prefer **roles and accessible names** (`getByRole('button', { name: 'Add Match' })`). Use `.sk-*` when the role isn’t unique.

Don’t invent `data-testid` unless a control can’t be reached by role + `sk-*`.

## Testing

| Kind | Where | Command |
|------|--------|---------|
| Unit / domain | `react-app/src/**/*.test.ts` (Vitest, next to source) | `npm test` |
| E2e | `tests/*.spec.ts` (Playwright + `tests/helpers/scorekeeper-page.ts`) | `npm run test:e2e` |
| Interop | Vitest golden CSV + Playwright fixture load | `npm run test:interop` |

- Name unit tests after the module: `imageRef.ts` → `imageRef.test.ts`.
- Vitest style: `describe` / `it` / `expect` from `vitest`. Cover parse failures, limits, and edge cases — not only the happy path.
- Playwright: clear storage in `beforeEach` via `clearScorekeeperStorage`, start from `gotoScorekeeper` / `loadSampleLeague`, reuse helpers instead of copy-pasting roster setup.
- Author e2e as **TypeScript** (`*.spec.ts`). Playwright only runs `.spec.ts`. Don’t add new compiled `.js` siblings.
- If you change scoring, stats, or CSV: run **`npm run test:interop`**. Do not “fix” a golden file unless you intentionally changed the Legacy engine and documented why.
- If you change Track Game / roster / Overview workflows: add or extend a Playwright spec.

## Cloud & security

- Firebase is **optional**. The app must work locally (session storage + `.scrkpr` import/export) with no env configured.
- Client config is public; security is Auth + App Check + Firestore rules. Never commit `.env` / secrets.
- New writable cloud fields: update **TypeScript types**, **`limits.ts`**, **`firestore.rules`**, and [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) if setup steps change.
- Admin-only vs member-vs-creator permissions belong in domain helpers (e.g. `matchPermissions.ts`) *and* rules — UI hiding is not enough. Same split as above: admin for mass destroy; match creator / scorer for undoing the game they are managing.
- Rate limit: `WRITES_PER_HOUR` (100). Don’t add unbounded write loops on the client.

## Documentation

User-facing behavior lives in [FEATURES.md](./FEATURES.md). If a PR changes what players/admins can do, update that file in the same PR (and `TODO.md` if you close a backlog item).

Keep comments scarce and useful: explain *why* (legacy CSV, video timestamp slotting, hotkey permanence), not what the next line does.

## Git

- Small PRs. One concern per branch.
- Commit messages: **1–2 sentences on why**, not a file list. Example: “Keep golden CSV stable when adding display-only credit columns.”
- Don’t commit generated `dist/`, Playwright reports, `.env`, or scratch `.scrkpr` files (fixtures already tracked under `tests/fixtures/` are the exception).
