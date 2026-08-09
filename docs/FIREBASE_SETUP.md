# Firebase setup how-to (dodgeball-score shared leagues)

Step-by-step console and CLI setup for shared cloud leagues. The web app config is public by design; security comes from Auth, App Check, and Firestore rules—not from hiding keys.

Related: [`firestore.rules`](../firestore.rules), [`react-app/.env.example`](../react-app/.env.example).

---

## What you will create

| Piece | Purpose |
|-------|---------|
| Firebase project (Spark / free) | Host Auth + Firestore + App Check |
| Google sign-in provider | League admin / member identity |
| Authorized domains | Allow GH Pages + localhost OAuth |
| Cloud Firestore | Leagues, members, roster, matches, rate limits |
| App Check (reCAPTCHA) | Reduce abuse of the public web API key |
| Web app config → Vite env | Client can talk to Firebase |
| Deployed `firestore.rules` | Auth, membership, string limits, 100 writes/hour, admin-only league logo/banner |

You do **not** need Cloud Functions, Cloud Storage, or Blaze billing for the MVP. League logo/banner are optional https URLs on `LeagueMeta` (admin update only).

---

## 1. Create the Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. **Add project** → name it (e.g. `dodgeball-score`).
3. Google Analytics: optional at create time. You can link it later (see [§11](#11-google-analytics-optional)); the CLI cannot enable it.
4. Confirm you are on the **Spark** (no billing) plan under **Usage and billing**.

---

## 2. Register the web app

1. Project overview → **Add app** → **Web** (`</>`).
2. App nickname: e.g. `dodgeball-score-gh-pages`.
3. **Do not** check Firebase Hosting (you use GitHub Pages).
4. Register → copy the `firebaseConfig` object. You will map it to Vite env vars (step 8).

Example shape (values are not secret, but do not commit production keys to a *public* fork if you prefer to keep your project private—still treat rules as the real lock):

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "G-...", // present after Analytics is linked
};
```

---

## 3. Enable Google Authentication

1. **Build → Authentication → Get started**.
2. **Sign-in method → Google → Enable**.
3. Set a project support email → Save.
4. **Settings → Authorized domains** — ensure these exist:
   - `localhost` (local dev)
   - your GitHub Pages host, e.g. `willbuck.github.io`  
     (Firebase matches the **hostname** only; path `/dodgeball-score/` is fine.)
5. If you later use a custom domain for Pages, add that hostname too.

**OAuth consent (Google Cloud):** Firebase usually wires this. If Google sign-in fails with a consent/OAuth error:

1. Open [Google Cloud Console](https://console.cloud.google.com/) → same project.
2. **APIs & Services → OAuth consent screen** — External (or Internal if Workspace-only); add yourself as a test user while the app is in Testing.
3. **Credentials → OAuth 2.0 Client IDs** — Web client should list authorized JavaScript origins:
   - `http://localhost:5173` (Vite)
   - `https://willbuck.github.io`

---

## 4. Create Cloud Firestore

1. **Build → Firestore Database → Create database**.
2. Start in **production mode** (you will deploy rules immediately; do not leave open test rules).
3. Pick a region close to users (e.g. `nam5` / `us-central1`) — **region cannot be changed later**.
4. Create.

Collections are created automatically on first write. Expected shape from the plan (no manual console seeding required):

```
leagues/{leagueId}                          # directory metadata
leagues/{leagueId}/roster/current           # Team / Player / TeamPlayer
leagues/{leagueId}/matches/{matchId}        # match-scoped tables
leagues/{leagueId}/members/{uid}            # pending | active | rejected
rateLimits/{uid}/hours/{yyyyMMddHH}         # write quota counter
```

Optional: in **Firestore → Rules**, paste a temporary deny-all until the app’s `firestore.rules` is deployed:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 5. Enable App Check (reCAPTCHA)

App Check reduces abuse of your public Firebase config from random scripts.

1. **Build → App Check → Get started**.
2. Register your **web** app with **reCAPTCHA v3** (or Enterprise if you already use it).
3. Create a reCAPTCHA v3 site key in [reCAPTCHA Admin](https://www.google.com/recaptcha/admin) (or via the Firebase flow):
   - Domains: `localhost`, `willbuck.github.io` (and custom domain if any)
4. Paste the site key into App Check for the web app.
5. In App Check → **APIs** (or product enforcement):
   - Turn **Firestore** enforcement to **Enforced** once the client ships App Check tokens (use **Monitor** first for a day if you want to avoid locking yourself out during development).
   - Same for **Authentication** if offered.

Keep the **reCAPTCHA secret** only in Google/Firebase consoles—never in the GitHub repo. The **site key** goes in Vite env (public).

---

## 6. Install Firebase CLI and link the repo (local)

On your machine (not required for GH Pages build, only for deploying rules):

```bash
npm install -g firebase-tools
firebase login
cd /path/to/dodgeball-score
firebase initiatives:list   # optional
firebase projects:list
firebase use <your-project-id>
```

When the feature lands in-repo you will typically have:

- `firebase.json` — points at rules file
- `firestore.rules` — auth, membership, string lengths, rate limit
- `.firebaserc` — default project id (ok to commit project id)

Deploy rules only (no hosting):

```bash
firebase deploy --only firestore:rules
```

**Do not** use `firebase deploy` hosting to replace GitHub Pages unless you intentionally switch hosts.

---

## 7. Security rules checklist (what deploy must enforce)

Confirm the deployed rules match the plan before inviting real users:

- [ ] **No unauthenticated writes** (and no public writes to league data)
- [ ] **League metadata** readable by any signed-in user (directory)
- [ ] **League logo/banner** updatable only by admin (`logo` / `banner` ImageRef or null; identity fields unchanged)
- [ ] **Roster + matches** read/write only if `members/{uid}.status == 'active'`
- [ ] Users can create **only their own** member doc as `pending` (cannot set `active` / `admin` themselves)
- [ ] Only **adminUid** can approve/reject members
- [ ] String length caps (league/team/player names, notes, etc.)
- [ ] Payload / array sanity checks on roster & match docs
- [ ] Each mutating batch increments `rateLimits/{uid}/hours/{yyyyMMddHH}` and rejects when `count >= 100`

After deploy, use the **Rules playground** in the console to try: unsigned write (deny), pending member match write (deny), active member write (allow).

Optional but recommended: Firebase Emulator Suite + rules unit tests in CI later.

---

## 8. Vite environment variables

In `react-app` (local `.env` / `.env.local`, and GitHub Actions secrets or vars for Pages builds):

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_APPCHECK_SITE_KEY=
VITE_FIREBASE_MEASUREMENT_ID=   # optional; G-… after linking Analytics
```

Map 1:1 from the Firebase web config + App Check site key.

**GitHub Pages:** add the same values under repo **Settings → Secrets and variables → Actions**, then pass them into the build step in `.github/workflows/gh-pages.yml` as `VITE_*` env vars. Never put service account JSON or reCAPTCHA **secrets** in the workflow.

Local example: `react-app/.env.local` (gitignored).

---

## 9. Smoke test before sharing with trackers

1. Run the app locally with env set → **Sign in with Google**.
2. Create a league → confirm docs appear under `leagues/{id}` and `members/{yourUid}` (`admin` / `active`).
3. Second Google account: see league on home → **Request to join** → `pending`.
4. Admin: approve → second user can open league and flush a save after debounce / game complete.
5. Confirm `rateLimits/{uid}/hours/...` increments on cloud flush.
6. Sign out → confirm cloud writes fail / UI stays local-only.
7. Deploy Pages build with `VITE_*` → repeat sign-in on `https://<user>.github.io/<repo>/` (authorized domain must match).

---

## 10. Ongoing ops (lightweight)

- **Usage:** Firebase Console → Usage — watch Firestore reads/writes vs Spark free quotas.
- **Auth users:** disable/delete abusive accounts under Authentication.
- **App Check:** if enforcement blocks a real browser, check domain list and reCAPTCHA domains.
- **Rules changes:** always `firebase deploy --only firestore:rules`; never temporarily set `allow read, write: if true` on a public app.
- **Rotate:** if a key is abused, restrict API keys in Google Cloud Console (HTTP referrer = your Pages origin + localhost) and rotate App Check / OAuth clients as needed.

### Optional API key referrer restriction

1. Google Cloud Console → **APIs & Services → Credentials**.
2. Browser API key used by Firebase → **Application restrictions → HTTP referrers**:
   - `http://localhost:5173/*`
   - `https://willbuck.github.io/*`
3. Save. (Misconfiguration breaks local/prod until referrers are correct.)

---

## 11. Google Analytics (optional)

Linking Analytics **must** be done in the Firebase / Google consoles. There is no `firebase` CLI command to create a GA4 property or attach it to the project.

1. Firebase Console → **Project settings → Integrations → Google Analytics → Enable / Link**.
2. Create a new GA4 property or link an existing one. Accept the defaults unless you already have a property.
3. After linking, Project settings → Your apps → Web app → **SDK snippet / Config** should include `measurementId` (`G-…`).
4. Optionally print the same config from the CLI:

   ```bash
   firebase apps:sdkconfig WEB
   ```

5. Add `VITE_FIREBASE_MEASUREMENT_ID` to `.env.local` and (for Pages) a repo Actions secret of the same name. It is **optional**: the JS SDK v7.20+ can fetch `measurementId` dynamically once Analytics is linked. The env var is a fallback.

The app sends:

| Event | When | Params (no names / PII) |
|-------|------|-------------------------|
| `page_view` | Client-side route change | `page_path`, `page_name` (`overview`, `track_game`, …) |
| `video_player_mode` | Tall / docked / hidden / popout | `from_mode`, `to_mode` |
| `video_timeline_seek` | Timeline click that jumps the video | `offset_seconds`, `event_type` |
| `item_deleted` | Team, player, match, game, or game event delete | `item_kind` |

Analytics is **on for production builds** (`npm run build` / GitHub Pages) when Firebase is configured. Local `npm run dev` does not send events unless you set `VITE_FIREBASE_ANALYTICS=1`. Check **GA4 DebugView** or **Realtime** after a Pages deploy.

Custom event parameters show in Realtime immediately. For Explorations / standard reports, register them as custom dimensions in the GA4 property (Admin → Data display → Custom definitions).

---

## Out of scope for this setup

- Firebase Hosting (GH Pages remains the static host)
- Cloud Functions / email on join request
- Blaze plan / billing alerts (add later if you leave Spark)
- Cloud Storage (Phase 1 uses paste-only https image URLs on `LeagueMeta` + roster rows)

---

## Quick reference: console paths

| Task | Path |
|------|------|
| Web config | Project settings → Your apps |
| Google sign-in | Authentication → Sign-in method |
| OAuth domains | Authentication → Settings → Authorized domains |
| Database | Firestore → Data / Rules |
| App Check | App Check → Apps / APIs |
| Usage | Project settings → Usage and billing |
| Analytics | Project settings → Integrations → Google Analytics |
