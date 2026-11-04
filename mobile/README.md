# Daybook for iPhone

A React Native (Expo) version of Daybook: Today, all tasks with search, add/edit with alerts, quick-add
(`Essay fri 5pm #school`), color schemes, and alerts that arrive as real iPhone notifications **even when the app
is closed**. It reuses the web app's tested logic straight from `../src` (dates, recurrence, quick-add parser,
alerts, backup format, colors), so both apps behave the same.

Everything stays on your phone. No account, no server, no App Store listing.

## Set up (once)

```bash
npm install            # in the repo root (shared code)
cd mobile
npm install
```

## Option A: try it now with Expo Go (no Xcode)

1. Install **Expo Go** from the App Store on your iPhone (it's Expo's free viewer app, not a listing for Daybook).
2. On the laptop: `cd mobile && npx expo start`
3. Scan the QR code with the iPhone Camera. Phone and laptop must be on the same Wi-Fi (on campus Wi-Fi that
   blocks this, use `npx expo start --tunnel`).

Good for trying it out. Expo Go loads the app from your laptop, so the laptop has to be running `expo start`
when you open it.

## Option B: install it as a real app on your phone (no laptop needed after)

This builds Daybook and installs it directly from your Mac over a cable.

1. Install **Xcode** from the Mac App Store (about 10 GB), open it once, and sign in with your Apple ID under
   Xcode → Settings → Accounts.
2. On the iPhone: Settings → Privacy & Security → **Developer Mode** → on (it restarts).
3. Plug the iPhone in, then run:

   ```bash
   cd mobile
   npx expo run:ios --device --configuration Release
   ```

   Pick your phone when asked. The first build takes a few minutes.
4. On the iPhone: Settings → General → VPN & Device Management → trust your Apple ID.

**The catch with a free Apple ID:** Apple makes free-signed apps expire after **7 days**. Your data stays on the
phone, but the app won't open until you plug in and re-run step 3 (about 2 minutes). A paid Apple Developer
account ($99/year) makes the install last a year; students can sometimes get the fee waived through their school.

## Notifications

Settings tab → **Notifications** on → allow when iOS asks → **Send a test notification**. Daybook schedules the next
two weeks of alerts plus a 7:00 AM morning briefing on the phone itself, so they fire with the app closed. It
re-plans whenever you edit a task or open the app (iOS allows at most 64 queued, so it keeps the soonest 60).

## Moving tasks between laptop and phone

There's no server, so each device keeps its own copy. To move everything across:

- **Laptop → phone:** web app Settings → *Download backup*, AirDrop the `.json` file to the phone, then here:
  Settings → *Import backup*.
- **Phone → laptop:** Settings → *Export backup* → AirDrop to the Mac, then web app Settings → *Import*.

Importing replaces what's on that device (it asks first).

## Code

- `src/App.tsx`: tabs, editor sheet, re-planning notifications
- `src/store.ts`: on-device storage (`expo-sqlite` key-value store) in the web backup format
- `src/notifications.ts`: local notification scheduling (`expo-notifications`)
- `src/screens/`: Today, All tasks, Settings, Task editor
- `@/…` imports resolve to the web app's `../src` (see `tsconfig.json` and `metro.config.js`)

Check it with `npx tsc --noEmit` and `npx expo-doctor`.
