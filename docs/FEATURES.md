# Feature summary

## Data & sync

- Browser **session storage** (`SCOREKEEPER_DATA`) for the working `.scrkpr` database; Overview import/export unchanged
- Optional **local league label** in session storage (`SCOREKEEPER_LOCAL_LEAGUE_LABEL`): set when loading a file or the sample league (filename without `.scrkpr`, or “Sample league (demo)”); shown in the drawer sync bar; cleared when cloud data replaces the session
- Last opened cloud league id in **localStorage** (`SCOREKEEPER_ACTIVE_LEAGUE`): auto-opens on sign-in when membership is still active; cleared on **Leave league**; kept across sign-out for the next session
- Last scoring target in **localStorage** (`SCOREKEEPER_LAST_SCORING`): **Resume game** / **Resume match** in the drawer and on Overview — jumps to the in-progress game, or to Track Match after a finish is recorded; hidden if the match/game is gone
- Appearance (System / Light / Dark) in **localStorage** (`SCOREKEEPER_COLOR_MODE`); default **System** follows the OS; Track Game timeline and VOD chrome stay dark; the match **digital scoreboard** is always dark (high-contrast digits)
- Optional **Firebase** shared leagues (Google sign-in): directory on Overview, join requests, admin approve, per-match cloud docs, 30s idle / game-complete flush — see [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
- Optional **https image URLs** (`ImageRef`: display URL now, storage path later): team logos and player photos in the `.scrkpr` roster; cloud league **logo / banner** on `LeagueMeta` (admin paste-only; no Cloud Storage yet)

## App shell

- **Overview** — Google sign-in / league directory (when Firebase configured) with league logos and an optional slim banner when a league is open, **Resume** last game/match, **League stats**, download database, **Load from file** (`.scrkpr`), **Load sample league (demo)** (six teams with a distinct DiceBear avatar style each, Minnesota Dodgeball VODs with stamped Game start / events / finish advancing across the 12 games per match, starred catches/deflections/double-kills, so highlight minimums are met), sync status chip; admin-only confirm to replace an open cloud league from import
- **Teams / Players** — manage teams and rosters; rename or delete (blocked if used in a match); paste https logo / photo URLs (thumbnails + initials fallback); player name opens **Player** (`/players/:id`) with a large photo, league stats row (including Caught% / Catch% / Elu% / Eff% / Net / VOR / WAR), ranks (kills / catches / hit%), starred highlights they appear in, and links to games played; guest/sub rows can **link** to a known league player (asterisked sub stats, unlink on the canonical page); linked guests redirect to that player
- **Matches** — create matches, select players, **See stats**, download/copy match statistics CSV; **Delete** (with confirm) for local data or league admins
- **Track Match / Games** — add games; list shows **Scoring complete** vs **In progress**; **See stats** per game; **Add Game** always opens the game roster screen (auto-select fills up to the league’s players-per-side limit, default 6, then you can adjust); opening an existing game with a roster goes straight to Track Game (skip “who’s playing”); empty games still open the roster screen; game roster heading shows **Game N**; **match score** (home–away game wins) on match roster, Track Match, game roster, Track Game, and Game Complete, shown as a large high-contrast **digital scoreboard**; game roster has **Previous / Next game** (Next creates a game if needed); Track Game / Game Complete have **Edit roster** back to that game’s on-court selection; after **Game Complete**, **Back to match** and **Next game**; **Delete** game (with confirm) for local data, league admins, or the member who created the match
- **Stats** — in-app leaderboards, standings, and charts for the open league, a match, or a single game; Match / Game / Player dropdowns jump between those views and player pages
- **League Stat Settings** — players per team per game (default 6), highlight-leaderboard minimums (15 games / 2 matches / 20 throws & targets, each toggleable, default on), plus stat-credit policy (team throws, deflection weights, multi-kills/catches); local always editable, cloud admin-only; cloud admin can paste league logo and banner URLs
- **History** — commit log for local mutations
- **MUI shell** — drawer nav (light gray / dark charcoal by theme), primary blue (`#1565c0`), appearance menu next to the Scorekeeper title (System / Light / Dark); sync bar shows **Local only**, a named **Local league** pill after loading a `.scrkpr`/sample (outlined), or **Syncing** plus a filled primary pill for the open cloud league; Playwright-friendly class names where needed; resume-scoring control when a last game/match is stored; wrapped **button rows** keep an 8px vertical gap so stacked buttons do not touch

## Roster & match setup

- **Match & game roster selection** with home/away columns; game roster heading is **Game N**; team logos on banners and player photos on rows; optional tall YouTube VOD on both roster screens; roster hotkeys match Track Game for the first 6 per side, then `Q 1 2 3 4 5` / `P 0 9 8 7 6` for players 7–12, assigned in on-screen order (starters then subs; reassigned when sub status changes)
- **Add / remove players on Match and Game roster screens** (creates a team player and includes them on the match, and on this game when added from Game); mark **Sub** officially instead of a “(sub)” name suffix; typing a name suggests other league players to **link** by any part of the name (first, last, or substring; picking another team auto-checks Sub; same-team hits select the existing roster row); **Remove** is only for players added from those screens, not the core team roster; it confirms, rolls back any events they appear in, drops them from this match’s games, and deletes them from the team if they aren’t on another match
- **Players per team per game** (League Stat Settings, default 6) caps who can be on court; match roster can still include extra subs
- **Auto-select** up to that limit per side when a match is opened, or when a **new empty** game is created (does not overwrite an existing game roster); game auto-select prefers non-subs, then fills with subs if needed
- **Edit roster** from Track Game returns to that game’s player selection (not Teams). Removing someone who already appears in events warns, then after confirm deletes every event from their first involvement onward (Game start is kept)
- **Live elimination on Game page** — outs grayed, sorted to bottom, active counts, game-over hint; subs sort below starters; roster hotkeys follow that order

## Track Game

Main scoring surface: optional **YouTube player** (tall / small-docked / hide) with a center editor + dark **timeline sidebar**. A dark **digital scoreboard** (`sk-scoreboard`) shows **match score**, **match running time**, and **players remaining** in large tabular digits. Match time is the VOD clock minus this game’s **Game start** stamp (or the first stamped Game start in the match); it is not a wall clock. Empty states: **No video** when the match has no VOD, **Stamp Game start** when no start offset exists, and **—** when the player is hidden, not ready, or still before Game start.

### Event types

| Tab | Purpose |
|-----|---------|
| **Throw** | Thrower, target, result (Hit, Dodge, Block, Disarm, Catch, Miss), optional deflections, catch recovery |
| **Other** | Offender + mistake (line-out, wasted ball, illegal block during no blocking), or **No Blocking Started** (player-less game marker) |
| **Finish** | Winner (home / away / tie) |

### Editor UX

- Three-column grid (home / away / result) with slightly taller team banners separated from player rows (result column spacer keeps tops aligned); six player buttons stretch to the same total height as the six result rows
- Throw results shown with **MUI icons**; result can be chosen before thrower
- **Deflections** chain on eligible results (Hit, Block, Disarm); `Z` focuses the new row so player keys pick the receiver and `R Y U G` set the deflection result (Dodge/Miss stay on the throw)
- **Catch recovery** — pick a teammate (including outs) or **None** (`M`)
- Auto-commit when a draft is complete and dirty; **Done / Restore / Insert below / Delete**
- **Undo / Redo** (`-` / `+`) remove or restore the last entered event (session redo stack; cleared when a new event is committed). Distinct from `N` (delete selected) and `V` (restore draft from saved selection)
- **Game Complete** idle state after a finish is recorded (undo/redo still work); **Edit roster** still available there
- Timeline lists events (newest-oriented virtualized list); select to edit

### Live elimination

Derived from persisted events (not a separate toggle):

- **Disarm** → target (or deflection receiver) out immediately; a later deflection **Catch** still outs the thrower but does **not** save the disarmed player
- Hit (and legacy failed block/catch stored on old saves, shown as Hit) → target out unless saved by a deflection catch
- Catch (throw or deflection) → thrower out
- Line-out / wasted ball / illegal block (no blocking) → offender out (illegal block on **Other** tab only)
- **No Blocking Started** — manual game marker on **Other**; no live elimination effect
- **Recovered** player on a catch is removed from the eliminated set
- Outs sort to the bottom and show “(out)”
- When one side has **zero active players**, the game is live-over

### YouTube match VOD

- Match page: optional **YouTube URL** field; **tall VOD player** on Match and Game roster screens (playback hotkeys, no Track Game action tooltip) so you can see who is playing vs subbing
- Track Game layouts (session preference):
  - **Tall** (`]`) — large fill-height 16:9 player; compact throw/error editor band below (all controls still visible); keyboard-icon tooltip on the player bar for playback (`Space` `←`/`→` `,` `.`) and action keys (Done, Delete, Undo, …)
  - **Small** (`[`) — player centered in the editor column; timeline rises full-height beside it
  - **Hide** — scoring only (timestamps pause)
  - **Pop-out** — second window for the VOD; persists across games in the same match (and match/game roster screens). Closes when you leave the match, dock back, or close the window. Opening Track Game with an active pop-out seeks to **Game start** (finished games) or the **latest stamped event** (in progress); if nothing is stamped yet, the player is left where it is until Game start is marked. While the pop-out catches up, both windows show a short **Seeking to m:ss…** spinner
- Playback and Track Game hotkeys stay on the page: clicking the embed returns keyboard focus so `Space` / arrows / scoring keys keep working (`Space` play/pause, `←`/`→` ±5s, `,`/`.` frame step when paused)
- **On open**: unfinished games start paused at the last stamped event; finished games start paused at **Game start** (no autoplay). Same seek rules apply to an active pop-out when attaching to a game; with no stamps yet, the pop-out is left where it is until Game start is marked
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
| Home players (Track Game + roster 1–6) | `A S D F W E` |
| Away players (Track Game + roster 1–6) | `J K L ; I O` (`I` badge uses a serif face so it is distinct from `L`) |
| Match / Game roster 7–12 (home) | `Q 1 2 3 4 5` |
| Match / Game roster 7–12 (away) | `P 0 9 8 7 6` |
| Throw results | `R T Y U G H` |
| Other tab (line-out, wasted ball, illegal block, no blocking started) | `1 2 3 4` (fixed order; re-press toggles off) |
| Deflection (after `Z`) | receiver = defending player keys; result = `R Y U G` |
| Recovered None | `M` |
| Actions | `Z` deflect, `X` done, `C` add throw, `V` restore draft, `B` insert below, `N` delete selected |
| Undo / redo last event | `-` undo, `+` redo |
| Confirm wipe finish | `X` Done after last out, then `Enter` |
| YouTube layout | `[` small/docked, `]` tall |
| YouTube playback | `Space` play/pause, `←`/`→` ±5s (tall view: keyboard tooltip on the player bar) |
| YouTube frame (paused) | `,` back, `.` forward |

Match / Game roster keys follow on-screen order (starters, then subs; outs last on the game roster) and are reassigned when that order changes. Track Game throw/error keeps a stable name-order map. Slots 7–12 on roster select use the overflow keys. Re-pressing a player/result key toggles the selection off where applicable.

## Statistics & interop

- In-app **Stats** pages: league (`/stats`), match (`/matches/:id/stats`), game (`/matches/:id/games/:id/stats`); player names link to the player page
- Stats page **Match / Game / Player** dropdowns jump to league totals, a match, a game, or a player page
- Entry points: drawer **Stats**, Overview **League stats**, Matches/Match **See stats**, Track Match per-game **See stats**, Team roster player names
- Sortable **player table** with leaderboard toggles (Kills, Catches, K/D, Hit%, Games won) and min-games filter; **Deaths** (hit/error only), **Caught** (times throw was caught), also **Caught%**, **Catch%**, **Elu%**, **Eff%**, **Net**, **VOR**, and **WAR**
- League stats **Leaderboards** tab: top 5 graphic per highlight stat (1st avatar center, 2nd left, 3rd right) — Caught%, Catch%, Elusiveness%, Efficiency%, Net score, VOR, WAR; uses **League Stat Settings** minimums (default 15 games, 2 matches, 20 throws & targets)
- **Counts vs Credit** toggle (session): integer involvement vs league-weighted kill/death credit; Efficiency / Net / VOR / WAR follow the toggle
- **Include / Exclude sub stats** toggle on league stats and the player page (session, default include): appearances marked **Sub** (own-team bench or cross-team linked guest) sit in a separate bucket; excluding them is O(players) after one event walk. Linked guests merge into the canonical player’s league row. When sub stats are included, names with any sub bucket show `*` (tooltip: games / kills as sub); exclude hides the mark. Match/game tables show `*` on sub roster slots without merging identity. CSV stays per physical `Player.Id` (golden Legacy unchanged)
- Optional columns when the league policy enables them: assists, double/triple/quad kills, multi-catches, deflection catches
- **Team standings** (game W-L-T + match W-L from finished games) and match series scoreboard
- Charts (`@mui/x-charts`): throw-result mix, top-N bars, home vs away, game elimination timeline; thrower→target heatmap on match/game
- Display metrics (catches, recoveries, rates, VOR/WAR) sit on top of the engine — **golden CSV unchanged** under the default Legacy policy
- Highlight formulas: **Caught%** = catches thrown / throws (lower is better); **Catch%** = catches / times targeted; **Elusiveness%** = (targeted − hit) / targeted (hit = incoming Hit, Disarm, or legacy failed block); **Efficiency%** = kills / throws; **Net** = 2×catches + kills − hit/error deaths − 2×times caught (Deaths exclude catch-outs; times caught is separate); **VOR** = equal-weight average of z-scores vs the median of those five among qualifier-eligible players (Caught% inverted); **WAR** = VOR / 6
- **Legacy CSV export** keeps the original column layout: Disarm and deprecated failed block/catch fold into **Hit**; `BlockFailed` / `CatchFailed` columns emit **0**
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

- Domain logic under `src/domain/` (events, elimination, hotkeys, roster auto-select, statistics)
- UI under `src/pages/` and `src/components/` (including `stats/` and `trackGame/`)
- Unit tests: Vitest; e2e: Playwright in `tests/`
- Deployable as a static SPA (including GitHub Pages)
- Contributor style: [CODE_CONVENTIONS.md](./CODE_CONVENTIONS.md); how to send a PR: [CONTRIBUTING.md](../CONTRIBUTING.md)
