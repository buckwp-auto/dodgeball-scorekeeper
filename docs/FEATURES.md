# Feature summary

## Data & sync

- Browser **session storage** (`SCOREKEEPER_DATA`) for the working `.scrkpr` database; Overview import/export unchanged
- Last opened cloud league id in **localStorage** (`SCOREKEEPER_ACTIVE_LEAGUE`): auto-opens on sign-in when membership is still active; cleared on **Leave league**; kept across sign-out for the next session
- Last scoring target in **localStorage** (`SCOREKEEPER_LAST_SCORING`): **Resume game** / **Resume match** in the drawer and on Overview — jumps to the in-progress game, or to Track Match after a finish is recorded; hidden if the match/game is gone
- Optional **Firebase** shared leagues (Google sign-in): directory on Overview, join requests, admin approve, per-match cloud docs, 30s idle / game-complete flush — see [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
- Optional **https image URLs** (`ImageRef`: display URL now, storage path later): team logos and player photos in the `.scrkpr` roster; cloud league **logo / banner** on `LeagueMeta` (admin paste-only; no Cloud Storage yet)

## App shell

- **Overview** — Google sign-in / league directory (when Firebase configured) with league logos and an optional slim banner when a league is open, **Resume** last game/match, **League stats**, download database, **Load from file** (`.scrkpr`), **Load sample league (demo)** (six teams with photos, Minnesota Dodgeball VODs, starred catches/deflections/double-kills, and 12 games per match so highlight minimums are met), sync status chip; admin-only confirm to replace an open cloud league from import
- **Teams / Players** — manage teams and rosters; rename or delete (blocked if used in a match); paste https logo / photo URLs (thumbnails + initials fallback); player name opens **Player** (`/players/:id`) with a large photo, league stats row (including Caught% / Catch% / Elu% / Eff% / Net / VOR / WAR), ranks (kills / catches / hit%), starred highlights they appear in, and links to games played
- **Matches** — create matches, select players, **See stats**, download/copy match statistics CSV; **Delete** (with confirm) for local data or league admins
- **Track Match / Games** — add games; list shows **Scoring complete** vs **In progress**; **See stats** per game; **Add Game** always opens the game roster screen (auto-select fills first 6, then you can adjust); opening an existing game with a roster goes straight to Track Game (skip “who’s playing”); empty games still open the roster screen; game roster heading shows **Game N**; **match score** (home–away game wins) on match roster, Track Match, game roster, Track Game, and Game Complete; game roster has **Previous / Next game** (Next creates a game if needed); after **Game Complete**, **Back to match** and **Next game**; **Delete** game (with confirm) for local data, league admins, or the member who created the match
- **Stats** — in-app leaderboards, standings, and charts for the open league, a match, or a single game; Match / Game / Player dropdowns jump between those views and player pages
- **League Stat Settings** — highlight-leaderboard minimums (15 games / 2 matches / 20 throws & targets, each toggleable, default on) plus stat-credit policy (team throws, deflection weights, multi-kills/catches); local always editable, cloud admin-only; cloud admin can paste league logo and banner URLs
- **History** — commit log for local mutations
- **MUI shell** — drawer nav, primary blue theme (`#1565c0`), Playwright-friendly class names where needed; resume-scoring control when a last game/match is stored

## Roster & match setup

- **Match & game roster selection** with home/away columns; game roster heading is **Game N**; team logos on banners and player photos on rows; optional tall YouTube VOD on both roster screens
- **Add players on the match screen** (creates a team player and includes them on the match); mark **Sub** officially instead of a “(sub)” name suffix
- **Auto-select first 6 players** per side when a match is opened, or when a **new empty** game is created (does not overwrite an existing game roster); game auto-select prefers non-subs, then fills with subs if needed
- **Live elimination on Game page** — outs grayed, sorted to bottom, active counts, game-over hint; subs sort below starters

## Track Game

Main scoring surface: optional **YouTube player** (tall / small-docked / hide) with a center editor + dark **timeline sidebar**.

### Event types

| Tab | Purpose |
|-----|---------|
| **Throw** | Thrower, target, result, optional deflections, catch recovery |
| **Error** | Offender + mistake (e.g. line-out, illegal block) |
| **Finish** | Winner (home / away / tie) |

### Editor UX

- Three-column grid (home / away / result) with slightly taller team banners separated from player rows (result column spacer keeps tops aligned); six player buttons stretch to the same total height as the seven result rows
- Throw results shown with **MUI icons**; result can be chosen before thrower
- **Deflections** chain on eligible results (block, hit, etc.); `Z` focuses the new row so player keys pick the receiver and `R Y U G H` set the deflection result (Dodge/Miss stay on the throw)
- **Catch recovery** — pick a teammate (including outs) or **None** (`M`)
- Auto-commit when a draft is complete and dirty; **Done / Restore / Insert below / Delete**
- **Undo / Redo** (`-` / `+`) remove or restore the last entered event (session redo stack; cleared when a new event is committed). Distinct from `N` (delete selected) and `V` (restore draft from saved selection)
- **Game Complete** idle state after a finish is recorded (undo/redo still work)
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

- Match page: optional **YouTube URL** field; **tall VOD player** on Match and Game roster screens (playback hotkeys, no Track Game action tooltip) so you can see who is playing vs subbing
- Track Game layouts (session preference):
  - **Tall** (`]`) — large fill-height 16:9 player; compact throw/error editor band below (all controls still visible); keyboard-icon tooltip on the player bar for playback (`Space` `←`/`→` `,` `.`) and action keys (Done, Delete, Undo, …)
  - **Small** (`[`) — player centered in the editor column; timeline rises full-height beside it
  - **Hide** — scoring only (timestamps pause)
- Playback hotkeys work without focusing the embed: `Space` play/pause, `←`/`→` ±5s, `,`/`.` frame step when paused
- **On open**: unfinished games start paused at the last stamped event; finished games start paused at **Game start** (no autoplay)
- Saving an event stamps `VideoOffsetSeconds` from the player clock on **create** (edits keep the existing time, except an unstamped team throw is stamped when the next ball is saved) and **slots the event by video time** among existing timestamps (unstamped still append; Insert below still uses the selected row); timeline times are editable (type m:ss or **From video**); select seeks; team-throw rows share the event time chip
- Every game has a **Game start** event (ordinal 1) with an editable timestamp; cannot be deleted
- GitHub Pages–safe iframe (`origin` + referrer policy); embed failures don’t block scoring

### Finish after team wipe

- Last elimination stays on the **Throw** tab — press **Done** (`X`) before advancing to Finish
- Finish then opens with the surviving team pre-selected
- **Enter** (or Done) confirms; wipe prompt does not auto-commit the finish
- Then lands on **Game Complete** with timeline still visible

## Hotkeys

Permanent bindings for the life of a game (by team + stable name order), not remapped when players are eliminated or sides switch in the throw UI.

| Area | Keys |
|------|------|
| Home players | `A S D F W E` |
| Away players | `J K L ; I O` (`I` badge uses a serif face so it is distinct from `L`) |
| Throw results | `R T Y U G H P` |
| Deflection (after `Z`) | receiver = defending player keys; result = `R Y U G H` |
| Recovered None | `M` |
| Actions | `Z` deflect, `X` done, `C` add throw, `V` restore draft, `B` insert below, `N` delete selected |
| Undo / redo last event | `-` undo, `+` redo |
| Confirm wipe finish | `X` Done after last out, then `Enter` |
| YouTube layout | `[` small/docked, `]` tall |
| YouTube playback | `Space` play/pause, `←`/`→` ±5s (tall view: keyboard tooltip on the player bar) |
| YouTube frame (paused) | `,` back, `.` forward |

Same permanent map is used on Match / Game roster screens and Track Game throw/error flows. Re-pressing a player/result key toggles the selection off where applicable.

## Statistics & interop

- In-app **Stats** pages: league (`/stats`), match (`/matches/:id/stats`), game (`/matches/:id/games/:id/stats`); player names link to the player page
- Stats page **Match / Game / Player** dropdowns jump to league totals, a match, a game, or a player page
- Entry points: drawer **Stats**, Overview **League stats**, Matches/Match **See stats**, Track Match per-game **See stats**, Team roster player names
- Sortable **player table** with leaderboard toggles (Kills, Catches, K/D, Hit%, Games won) and min-games filter; also **Caught%**, **Catch%**, **Elu%**, **Eff%**, **Net**, **VOR**, and **WAR**
- League stats **Leaderboards** tab: top 5 graphic per highlight stat (1st avatar center, 2nd left, 3rd right) — Caught%, Catch%, Elusiveness%, Efficiency%, Net score, VOR, WAR; uses **League Stat Settings** minimums (default 15 games, 2 matches, 20 throws & targets)
- **Counts vs Credit** toggle (session): integer involvement vs league-weighted kill/death credit; Efficiency / Net / VOR / WAR follow the toggle
- Optional columns when the league policy enables them: assists, double/triple/quad kills, multi-catches, deflection catches
- **Team standings** (game W-L-T + match W-L from finished games) and match series scoreboard
- Charts (`@mui/x-charts`): throw-result mix, top-N bars, home vs away, game elimination timeline; thrower→target heatmap on match/game
- Display metrics (catches, recoveries, rates, VOR/WAR) sit on top of the engine — **golden CSV unchanged** under the default Legacy policy
- Highlight formulas: **Caught%** = catches thrown / throws (lower is better); **Catch%** = catches / times targeted; **Elusiveness%** = (targeted − hit) / targeted (hit = incoming Hit or failed block); **Efficiency%** = kills / throws; **Net** = 2×catches + kills − eliminations − 2×catches thrown; **VOR** = equal-weight average of z-scores vs the median of those five among qualifier-eligible players (Caught% inverted); **WAR** = VOR / 6
- Match statistics **CSV download / copy** (TSV for spreadsheet paste); league/match CSV also from the Stats page
- Domain statistics service aligned with legacy kill/death/catch aggregates; credit is a recalculated view over persisted events
- **Golden fixture** tests vs original WASM/scorekeeper CSV output
- Playwright coverage for workflow, import/export, and statistics

## Stat credit policy

League-scoped settings (`LeagueSettings` table, synced with roster) control highlight-leaderboard minimums and how stats award team throws and deflections. Default credit policy is **Legacy** (today’s engine) so existing `.scrkpr` files and golden CSV stay stable until a league opts in. Highlight minimums default to **15 games**, **2 matches**, and **20 throws & targets** (each can be turned off or retuned on **League Stat Settings**).

| Preset | Behavior |
|--------|----------|
| **Legacy** | Each hitting throw counts a full kill; same-target team throws can double-count deaths; credit is `1/N` including non-hitters. Deflection kills are full weight (1.0). |
| **Shared credit** | One death per unique target; hitters split credit; non-hitting teammates get an assist; deflection kills and deflection-catch deaths at 0.5 |
| **Full credit each** | One death per unique target; every hitter gets 1.0; assists for non-hitters |
| **First-hitter** | One death per unique target; first throw ordinal gets the configured share, remaining hitters split the rest |

First-hitter mode uses `Throw.Ordinal` (order in the team throw). List the first ball to connect first. Catch on a throw still suppresses that throw’s kills. Live elimination is unchanged.

## Technical notes

- Domain logic under `react-app/src/domain/` (events, elimination, hotkeys, roster auto-select, statistics)
- UI under `react-app/src/pages/` and `react-app/src/components/` (including `stats/` and `trackGame/`)
- Unit tests: Vitest; e2e: Playwright in `tests/`
- Deployable as a static SPA (including GitHub Pages)
- Contributor style: [CODE_CONVENTIONS.md](./CODE_CONVENTIONS.md); how to send a PR: [CONTRIBUTING.md](../CONTRIBUTING.md)
