# Feature summary

## Data & sync

- Browser **session storage** for the working `.scrkpr` database; Overview import/export unchanged
- Optional **Firebase** shared leagues (Google sign-in): directory on Overview, join requests, admin approve, per-match cloud docs, 30s idle / game-complete flush — see [FIREBASE_SETUP.md](FIREBASE_SETUP.md)

## App shell

- **Overview** — Google sign-in / league directory (when Firebase configured), download database, **Load from file** (`.scrkpr`), **Load sample league (demo)**, sync status chip
- **Teams / Players** — manage teams and rosters; rename or delete (blocked if used in a match)
- **Matches** — create matches, select players, download/copy match statistics CSV
- **Track Match / Games** — add games, set on-court roster, open Track Game
- **History** — commit log for local mutations
- **MUI shell** — drawer nav, primary blue theme (`#1565c0`), Playwright-friendly class names where needed

## Roster & match setup

- **Match & game roster selection** with home/away columns
- **Auto-select first 6 players** per side when a match or game is created / opened
- **Live elimination on Game page** — outs grayed, sorted to bottom, active counts, game-over hint

## Track Game

Main scoring surface: optional **YouTube player** (tall / small-docked / hide) with a center editor + dark **timeline sidebar**.

### Event types

| Tab | Purpose |
|-----|---------|
| **Throw** | Thrower, target, result, optional deflections, catch recovery |
| **Error** | Offender + mistake (e.g. line-out, illegal block) |
| **Finish** | Winner (home / away / tie) |

### Editor UX

- Three-column grid (home / away / result) with team banners
- Throw results shown with **MUI icons**; result can be chosen before thrower
- **Deflections** chain on eligible results (block, hit, etc.)
- **Catch recovery** — pick a teammate (including outs) or **None** (`M`)
- Auto-commit when a draft is complete and dirty; **Done / Restore / Insert below / Delete**
- **Game Complete** idle state after a finish is recorded
- Timeline lists events (newest-oriented virtualized list); select to edit

### Live elimination

Derived from persisted events (not a separate toggle):

- Hit / block-failed / catch-failed → target (or deflection receiver) out
- Catch (throw or deflection) → thrower out
- Line-out / illegal block → offender out
- **Recovered** player on a catch is removed from the eliminated set
- Outs sort to the bottom and show “(out)”
- When one side has **zero active players**, the game is live-over

### YouTube match VOD

- Match page: optional **YouTube URL** field
- Track Game layouts (session preference):
  - **Tall** (`]`) — large fill-height 16:9 player; compact throw/error editor band below (all controls still visible)
  - **Small** (`[`) — player centered in the editor column; timeline rises full-height beside it
  - **Hide** — scoring only (timestamps pause)
- Playback hotkeys work without focusing the embed: `Space` play/pause, `←`/`→` ±5s, `,`/`.` frame step when paused
- Saving an event stamps `VideoOffsetSeconds` from the player clock on **create** (edits keep the existing time); timeline times are editable (type m:ss or **From video**); select seeks
- Every game has a **Game start** event (ordinal 1) with an editable timestamp; cannot be deleted
- GitHub Pages–safe iframe (`origin` + referrer policy); embed failures don’t block scoring

### Finish after team wipe

- Automatically switches to the **Finish** tab with the surviving team pre-selected
- **Enter** (or Done) confirms; wipe prompt does not auto-commit the finish
- Then lands on **Game Complete** with timeline still visible

## Hotkeys

Permanent bindings for the life of a game (by team + stable name order), not remapped when players are eliminated or sides switch in the throw UI.

| Area | Keys |
|------|------|
| Home players | `A S D F W E` |
| Away players | `J K L ; I O` |
| Throw results | `R T Y U G H P` |
| Recovered None | `M` |
| Actions | `Z` deflect, `X` done, `C` add throw, `V` restore, `B` insert below, `N` delete |
| Confirm wipe finish | `Enter` |
| YouTube layout | `[` small/docked, `]` tall |
| YouTube playback | `Space` play/pause, `←`/`→` ±5s |
| YouTube frame (paused) | `,` back, `.` forward |

Same permanent map is used on Match / Game roster screens and Track Game throw/error flows. Re-pressing a player/result key toggles the selection off where applicable.

## Statistics & interop

- Match statistics **CSV download / copy** (TSV for spreadsheet paste)
- Domain statistics service aligned with legacy kill/death/catch aggregates
- **Golden fixture** tests vs original WASM/scorekeeper CSV output
- Playwright coverage for workflow, import/export, and statistics

## Technical notes

- Domain logic under `react-app/src/domain/` (events, elimination, hotkeys, roster auto-select, statistics)
- UI under `react-app/src/pages/` and `react-app/src/components/trackGame/`
- Unit tests: Vitest; e2e: Playwright in `tests/`
- Deployable as a static SPA (including GitHub Pages)
