# Lispo

A lightly gamified daily routine tracker for Android. You plan one week of tasks with reminder times. That week repeats every week. Each day you clear everything lights up on the calendar.

- **Routines:** several routine profiles, one active at a time. Switching asks for confirmation. Calendar and streak are shared across profiles.
- **Today:** a weekly streak tracker, then today's tasks. Swipe **left** to mark a task done (swipe again to undo). Swipe **right** to edit or delete.
- **Reminders:** local notifications at each task's time, with a **Mark done** button and an optional follow-up reminder (one global delay). No server needed.
- **Calendar:** month and year views, GitHub-style shading for partial days, current and longest streak, completion %, and your most-missed task.
- **Fix yesterday:** tick off tasks from yesterday you forgot to mark. Only yesterday can be changed.
- **Backup:** export or import a JSON file from Settings.
- Follows the system light/dark mode.

Stack: Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router · expo-sqlite · expo-notifications · Gesture Handler v3 + Reanimated 4.

---

## 1. One-time: create your signing key

**Why:** Android only installs an update over an existing app when both are signed with the *same* key. Without your own key, CI signs with a debug key. You'd risk having to uninstall (and lose your data) between builds. You create the key once and keep it as GitHub Secrets, so it never goes into git.

`keytool` comes with any JDK. If you have Android Studio, it's at `C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe`.

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore lispo-release.keystore -alias lispo -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a password and your name. For PKCS12, use the **same password** for the store and the key.

Turn the keystore into base64 text so it fits in a secret:

```powershell
# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("lispo-release.keystore")) | Set-Content keystore.base64.txt
```
```bash
# macOS / Linux
base64 -w0 lispo-release.keystore > keystore.base64.txt
```

Then add these secrets in GitHub (**Settings → Secrets and variables → Actions → New repository secret**):

| Secret | Value |
|---|---|
| `LISPO_KEYSTORE_BASE64` | contents of `keystore.base64.txt` |
| `LISPO_KEYSTORE_PASSWORD` | your password |
| `LISPO_KEY_ALIAS` | `lispo` |
| `LISPO_KEY_PASSWORD` | your password |

Or, with the GitHub CLI: `gh secret set LISPO_KEYSTORE_BASE64 < keystore.base64.txt` (and the same for the others).

**Back up `lispo-release.keystore` somewhere safe** (a password manager or a cloud drive). If you lose it, future builds can't update the installed app. `.gitignore` already excludes `*.keystore` and `keystore.base64.txt`.

**Other ways to do this:**
- *Skip the secrets.* The workflow still builds, signed with the debug key, and prints a warning. Fine for a first try.
- *EAS Build (Expo Services).* Expo manages the key in the cloud with `eas build -p android --profile preview`. It's less setup, but it needs an Expo account and uses their build queue instead of GitHub's runners.

## 2. Build

Push to `main`, or run the workflow by hand: **Actions → Build Android APK → Run workflow**.

The workflow (`.github/workflows/android-apk.yml`) does the following:
1. Runs `npm ci`, then the typecheck and the logic tests. A broken build fails here, which is faster than failing in Gradle.
2. Runs `expo prebuild` to generate the `android/` folder from `app.json` and the config plugins. That folder is never committed (Continuous Native Generation), so native config always lives in `app.json`.
3. Restores your keystore from the secret into the runner's temp folder.
4. Runs `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`. Building only arm64 covers every modern phone, including your S25 Ultra, and is about 4× faster than all four ABIs.
5. Uploads `lispo-<version>-build<N>.apk` as a run artifact. Pushing a tag like `v1.0.0` also attaches it to a GitHub Release.

`versionCode` is set to the workflow run number (`app.config.js`), so every new APK installs as an update.

## 3. Install on your phone

1. Download the artifact zip from the Actions run, unzip it, and open the APK on your phone.
2. Allow "Install unknown apps" for your browser or file manager when prompted.
3. When Lispo asks, allow **notifications**. "Exact timing" is already granted through `USE_EXACT_ALARM`.
4. **Samsung tip:** go to Settings → Apps → Lispo → Battery → **Unrestricted**. One UI's battery saver can otherwise delay reminders.

## 4. Run locally (optional)

```bash
npm install
npm test            # streak/date logic + data layer against in-memory SQLite
npm run typecheck
npx expo run:android   # needs Android Studio / SDK; builds a dev client
```

Expo Go won't fully work: the background "Mark done" task and the custom notification setup need a real build.

---

## How it works

```
src/
  app/                 Expo Router screens (file = route)
    index.tsx          opens on Today if a routine is active, else Routines
    (tabs)/            today · calendar · routines
    profile/new.tsx    3-step setup wizard
    profile/[id].tsx   edit / enable / delete a routine
    settings.tsx
  components/          shadcn-style primitives (ui.tsx), swipe card, sheets, grids
  db/client.ts         SQLite connection + migrations (PRAGMA user_version)
  db/repo.ts           all reads/writes
  lib/streak.ts        pure streak + metrics rules (unit tested)
  lib/notifications.ts rolling reminder scheduling
  lib/backgroundTask.ts handles "Mark done" while the app is closed
plugins/withReleaseSigning.js   config plugin that wires the keystore into Gradle
```

**Template vs. snapshot.** A routine is a weekly *template*. The first time a day is seen, its tasks are copied into a *day snapshot*, and marking done writes to the snapshot. Editing a task updates the template and today's snapshot (keeping its done state). Past days never change, so history stays accurate. Days the app wasn't opened still get snapshotted on next launch, so they show as missed instead of vanishing.

**Streak rules.** A day is *lit* when it has tasks and all are done. Days with no tasks are *rest* days and don't count either way. Today never breaks the streak while it's still in progress.

**Reminders.** Every time data changes or the app opens, Lispo cancels and re-schedules reminders for the next days (up to 14, fewer if you have many tasks, to stay under Android's ~500 pending-alarm limit). This is simpler and safer than updating alarms one by one. Reminders keep coming for about two weeks without opening the app, and expo-notifications restores them after a reboot.
