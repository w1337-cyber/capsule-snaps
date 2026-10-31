# Capsule: snaps that open later

A camera-first group app for iOS and Android with a Snapchat-style UI. It opens straight into the camera; Chat sits bottom-left. Friends make a group, pick an open date (say 31 December), and send photos and videos all year. Text chat in the group works normally, but snaps are sealed. Everything stays sealed until that moment. The **server** enforces the lock, so nobody can open the snaps early, not even the person who sent them. When the date arrives, everyone gets a notification and can play the capsule back like a story.

## How it works

| Piece | What it does |
|---|---|
| **Expo / React Native** | One codebase for both the iPhone and Android apps |
| **Firebase Auth (anonymous)** | Sign-in with no password, just a name |
| **Firestore** | Groups, members, invite codes, and who sent what and when |
| **Firebase Storage** | The photos and videos. `storage.rules` refuses every download before the open time. |
| **expo-notifications** | Sends each phone a local "your capsule is open!" alert at the open time |

Everything lives in Google's cloud. Nothing depends on your computer being on.

---

## 1. Set up Firebase (about 15 minutes, free to start)

1. Go to <https://console.firebase.google.com> and click **Add project**. Name it something like `capsule-snaps`. You can skip Analytics.
2. **Upgrade to the Blaze (pay-as-you-go) plan.** Google now requires this for Cloud Storage. It still includes a free monthly allowance (5 GB of stored files plus daily download quota), so a friend group will most likely pay $0. Set a budget alert of, for example, $5.
3. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
4. **Build → Firestore Database → Create database.** Choose the `eur3` location (Europe) and production mode.
5. **Build → Storage → Get started.** Use the same region.
6. **Project settings (gear icon) → Your apps → Web (`</>`)**. Register an app called "Capsule" and copy the `firebaseConfig` values.
7. In this folder, copy `.env.example` to `.env` and paste the values in.
8. Deploy the security rules. **This is the step that makes the lock real:**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add          # pick your project
   npm run deploy:rules
   ```

## 2. Run it on your phone (free, no Apple account needed)

```bash
npm install
npx expo install --fix      # aligns every package to the installed Expo SDK version
npx expo start
```

The camera, video and notifications need a **development build**, not Expo Go:

```bash
npm install -g eas-cli
eas login                   # free Expo account
eas build --profile development --platform android   # gives you an .apk to install
eas build --profile development --platform ios       # needs an Apple Developer account
```

Install the build on your phone, run `npx expo start`, and scan the QR code.

## 3. Publish to the App Store and Google Play

| | Apple App Store | Google Play |
|---|---|---|
| Account | Apple Developer Program, **$99/year** | Google Play Console, **$25 one-time** |
| Build | `eas build --platform ios --profile production` | `eas build --platform android --profile production` |
| Upload | `eas submit --platform ios` | `eas submit --platform android` |
| Review | Usually 1–3 days | Usually a few days. New personal accounts must run a closed test with 12 testers for 14 days first. |

Before you submit, you'll need:
- **A privacy policy URL.** The app stores photos, videos and a display name. A simple page on your own site works.
- **Account deletion.** Apple requires a way to delete your account. Add a "Delete my data" button before public release (see *Next steps*).
- **Content reporting/blocking.** Apps with user-generated content need a way to report or block content. For a private friends-only app, you can also publish through **TestFlight** (iOS) or **internal testing** (Android) and skip public review.
- Screenshots (6.7" iPhone plus an Android phone) and an App Store description.

> Easiest route for one friend group: use **TestFlight** and **Google Play internal testing**. Your friends install it like a normal app, and you avoid most of the public-store paperwork.

## Change the bundle ID

`app.json` uses `com.williamjannert.capsule`. Change it before your first store build if you want something else. It can't be changed after publishing.

---

## Security model (why nobody can peek)

- `storage.rules`: `allow read: if isMember() && request.time >= group.unlockAt`. Before the open time, Google's servers refuse to hand out any file, whatever the app's code does.
- `firestore.rules`: the open date can't be edited after the group is created. Snaps can only be added before the open time. Nobody can edit or delete a sealed snap.
- Uploads must be images or videos under 150 MB, and each file name is tied to the uploader's user ID.

Caveat: sign-in is anonymous. If someone deletes the app, they get a new identity. They can rejoin with the code, and everything they sent before is still in the capsule, just credited to their old name.

## Next steps (ideas)

- Sign in with Apple / Google, so identity survives reinstalls
- "Delete my data" button (needed for the App Store)
- A push notification to everyone when someone seals a snap ("Alex sealed 3 snaps")
- Export the whole capsule as a video montage on opening day
- A memory "teaser" each month: "47 snaps sealed so far"

## Web app (installable, live camera): `web-pwa/`

A full version that runs in the phone's browser and installs to the home screen (opens full-screen like a native app). Live camera: tap for photo, hold for video.

**Backend: Supabase** project `capsule-snaps` (Stockholm, free plan). Schema, rules and the lock are in `supabase/schema.sql` and already applied.
- Required setting: Authentication → Sign In / Providers → **Allow anonymous sign-ins** = on.
- The lock lives in Postgres row-level security + Storage policies: files can only be downloaded after `unlock_at`.

**Hosting:** any static host (Netlify, Cloudflare Pages, GitHub Pages). Upload the `web-pwa/` folder. It must be HTTPS for the camera to work.

**Preview without a backend:** serve the folder locally and open `index.html#demo`.

**Install on a phone:**
- iPhone (Safari): Share → *Add to Home Screen*
- Android (Chrome): ⋮ menu → *Install app* / *Add to Home screen*

## Project layout

```
App.tsx                  navigation + session
src/firebase.ts          Firebase init (reads .env)
src/api.ts               groups, invites, chat, upload, lock-aware download, notifications
src/theme.ts             colors (white + orange), time helpers
src/ui.tsx               buttons, avatars, header, bottom tab bar (Chat · Camera · Memories)
src/icons.tsx            line icons (react-native-svg)
src/screens/
  CameraScreen.tsx       home: full-screen camera, flip/flash/video rail, shutter, gallery
  PreviewScreen.tsx      review + caption, "Send To"
  SendToScreen.tsx       pick groups, orange send bar
  ChatScreen.tsx         chat list with status squares (sealed / chat / opened)
  NewChatScreen.tsx      sheet: New Group / Join with Code
  NewGroupScreen.tsx     name, icon, open date, then invite code
  JoinScreen.tsx         join with a 6-letter code
  ThreadScreen.tsx       group chat: sender-colored blocks, sealed snaps, countdown bar, composer
  MemoriesScreen.tsx     opened capsules to rewatch + still-sealed ones
  ViewerScreen.tsx       story-style playback
firestore.rules          database rules (incl. chat)
storage.rules            file lock rules (the real lock)
```
