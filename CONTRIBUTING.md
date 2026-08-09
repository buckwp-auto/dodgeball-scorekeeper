# Contributing

Thanks for helping with the dodgeball scorekeeper. This is a small MIT-licensed app; focused PRs that match existing patterns are easiest to review.

- Product behavior: [docs/FEATURES.md](docs/FEATURES.md)
- Style & architecture: [docs/CODE_CONVENTIONS.md](docs/CODE_CONVENTIONS.md)
- Firebase setup (optional): [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)

## Local setup

```bash
npm install
npm ci --prefix react-app
npx playwright install chromium

npm run dev          # http://127.0.0.1:5173/
npm test             # Vitest
npm run test:e2e     # Playwright
npm run test:interop # golden CSV + fixture e2e
```

See the [README](README.md) for layout, GitHub Pages, and data keys. You do not need Firebase for local scoring; without env vars the app stays on session storage + `.scrkpr` import/export.

## What we look for

1. Domain logic in `react-app/src/domain/`, UI in `pages/` + `components/`.
2. Tests: Vitest next to changed domain code; Playwright if a workflow changed.
3. Golden CSV unchanged unless you intentionally changed the Legacy stats engine.
4. `docs/FEATURES.md` updated for user-facing behavior.
5. No secrets, `.env`, or unrelated refactors.

Read [CODE_CONVENTIONS.md](docs/CODE_CONVENTIONS.md) before writing code (or before prompting an agent).

---

## Using an AI coding agent

Cursor, Claude Code, and Codex are welcome **as long as you review the diff**. Agents should load [AGENTS.md](AGENTS.md) (Claude Code also reads [CLAUDE.md](CLAUDE.md)). Start every task by having the agent read those plus this file and the conventions.

### Prompt to paste

Replace the task, then send this in Agent / `claude` / `codex`:

```text
Read CONTRIBUTING.md and docs/CODE_CONVENTIONS.md (and docs/FEATURES.md if this is user-facing).

Implement: <describe the change and acceptance criteria>.

Follow existing patterns. Keep scoring/stats/roster rules in react-app/src/domain/ with no React. Keep .scrkpr DTO fields PascalCase. Do not change tests/fixtures/*.golden.csv under the default Legacy policy. Sync react-app/src/domain/limits.ts with firestore.rules if you add/change string limits. Update docs/FEATURES.md if players or admins see new behavior. Add Vitest tests next to domain modules; extend Playwright specs in tests/ if a UI workflow changed.

Run npm test. If you touched Track Game, roster, Overview, import/export, or stats UI, also run npm run test:e2e and/or npm run test:interop.

Then open a PR against upstream main from this fork/branch (allow maintainer edits). Title and body should explain why, plus a short test plan. Do not push to upstream main.
```

Keep the agent on a **feature branch**. Review every commit before you push. You are the author of record.

### Cursor

1. Open this repo in [Cursor](https://cursor.com/).
2. Use **Agent** (`Cmd/Ctrl+I`) — not Ask — so it can edit files and run tests. For a large feature, start in **Plan**, approve the plan, then implement.
3. `@`-mention `AGENTS.md`, `CONTRIBUTING.md`, `docs/CODE_CONVENTIONS.md`, and any files already in play.
4. After the diff looks right: “Commit these changes, push to origin, and open a PR against upstream `main` with `gh pr create`.”

External guidance:

- [Cursor Agent](https://cursor.com/docs/agent/overview)
- [Agent mode (help)](https://cursor.com/help/ai-features/agent)
- [Best practices for coding with agents](https://cursor.com/blog/agent-best-practices)
- [Cloud agents](https://cursor.com/docs/cloud-agent) (optional: agent clones the repo, works on a branch, opens a PR)

### Claude Code

1. Install and run in this directory: [Claude Code overview](https://code.claude.com/docs/en/overview) (`claude`).
2. `CLAUDE.md` already points at [AGENTS.md](AGENTS.md) ([memory / CLAUDE.md](https://code.claude.com/docs/en/memory)).
3. Paste the prompt above. For PRs: “create a pr” after you have reviewed the diff ([common workflows](https://code.claude.com/docs/en/common-workflows)).
4. Prefer **plan mode** (`Shift+Tab` or `--permission-mode plan`) for multi-file scoring/stats work.

External guidance:

- [Claude Code overview](https://code.claude.com/docs/en/overview)
- [Common workflows](https://code.claude.com/docs/en/common-workflows) (explore, test, create PRs)
- [Best practices](https://code.claude.com/docs/en/best-practices)
- [GitHub Actions (`@claude`)](https://code.claude.com/docs/en/github-actions) — not required for this repo

### Codex

1. Install [Codex CLI](https://developers.openai.com/codex/cli) or use [Codex in ChatGPT](https://chatgpt.com/codex).
2. Run `codex` in this repo, paste the prompt above, and keep permissions tight until you trust the task.
3. Use `/review` (CLI) on the diff before committing. Ask it to push to **your** `origin` and open a PR against **upstream** `main`.
4. [AGENTS.md](AGENTS.md) is already in the repo — don’t let `/init` overwrite it with a generic stub.

External guidance:

- [Codex documentation](https://developers.openai.com/codex)
- [Codex CLI](https://developers.openai.com/codex/cli)
- [openai/codex](https://github.com/openai/codex)

---

## Opening a pull request

Work on a branch. Never commit directly to `main`.

### Collaborators (push access)

```bash
git checkout main && git pull
git checkout -b feat/short-description
# … implement, test …
git push -u origin HEAD
gh pr create --base main --title "…" --body "…"
```

Or create the PR in the GitHub UI: [Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).

### From a fork (most contributors)

Follow GitHub’s guides rather than inventing a flow:

1. [Fork the repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo)
2. Clone **your fork**, add upstream, create a branch:

   ```bash
   git clone https://github.com/<you>/<repo>.git
   cd <repo>
   git remote add upstream https://github.com/<upstream-owner>/<repo>.git
   git fetch upstream
   git checkout -b feat/short-description upstream/main
   ```

3. Implement, test, commit, push to **your** fork: `git push -u origin HEAD`
4. [Create a pull request from a fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork) (compare across forks; base = upstream `main`, head = your branch)
5. Check **Allow edits from maintainers** so review fixes can land on your branch
6. Keep the fork current: [Syncing a fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/syncing-a-fork)

CLI equivalent after push:

```bash
gh pr create --repo <upstream-owner>/<repo> --base main --head <you>:<branch> \
  --title "…" --body "…"
```

[`gh pr create`](https://cli.github.com/manual/gh_pr_create) works from a fork or a branch; tell the agent to target **upstream** `<upstream-owner>/<repo>`, not only your fork’s `main`.

### PR description

Include:

- **Why** this change exists (bug, UX, interop, docs)
- What testers should click / which commands you ran
- Notes on golden CSV, Firestore rules, or FEATURES.md if those moved

Example body:

```markdown
## Summary
- Slot timeline events by video timestamp so out-of-order scoring still sorts.

## Test plan
- [ ] `npm test`
- [ ] `npm run test:e2e` (game tracking / wipe finish)
- [ ] Manual: stamp two throws out of order on a VOD and confirm timeline order
```

## License

Contributions are accepted under the [MIT License](LICENSE).
