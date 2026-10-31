# Boutique Dah Android app

The Android project packages every application screen, font, icon and script inside the APK. It has no hosted `server.url`, login server, Google Sheets connection, or production service worker. It does not require Chrome to run. Android's system WebView renders the bundled interface.

Startup uses one AndroidX splash screen with both the parcel logo and **بوتيك الداه** included in the same vector drawable. There is no second custom splash overlay. The bundled Cairo font is shaped into paths at build preparation time, so the name is present from the first launch frame. The screen stays until the local page loads, then exits without a second intro animation. `node scripts/generate-launch-brand.mjs` regenerates the checked-in drawable using Java 21 and the bundled Cairo WOFF font.

## Build on a computer

Requirements: Node.js 22+, Java 21, Android SDK Platform 36 and Build Tools 36.0.0. Android Studio can supply these tools. The SDK's licence must be reviewed and accepted by its user before installing SDK components. Nothing in this repository automatically accepts SDK licences.

```powershell
npm ci
npm run android:apk
```

The build stages a separate static Next.js project in `.android-web/` and copies its assets to `android/`. Explicit `index.html` paths ensure all five screens work with Capacitor's asset server. The browser development preview remains usable; the Android APK is the installed application.

`scripts/build-apk.ps1` locates Java and the SDK, creates the signing identity once, compiles a signed release APK, and copies it to `artifacts/Boutique-Dah.apk`. A successful static bundle alone is **not** an APK or a native Android test.

The build also runs `scripts/verify-apk.ps1` to verify the APK signature, release package identity, all five bundled screens and absence of a hosted server URL or private build files. It writes `artifacts/Boutique-Dah.apk.sha256` for file-integrity checks.

Keep `.android-signing/boutique-dah.jks` and `.android-signing/signing.properties` together in a secure backup on the computer. They are private and ignored by Git. Every future APK update must use this same key and application ID (`com.boutiquedah.app`); increase `versionCode` in `android/app/build.gradle` for new releases. Do not delete or replace a missing signing key to work around an update failure.

## Install the resulting APK on Samsung

1. Copy `Boutique-Dah.apk` to the phone with USB or another trusted file-transfer method.
2. In Samsung My Files, tap the APK. Follow Android's prompts to allow installation from that file source if needed, then install.
3. Open **بوتيك الداه** from its own launcher icon. The app files are already present; no website visit, Chrome installation, account, or first-run internet download is needed.
4. For an existing browser database, first export its backup in that browser. In the Android app choose **الإعدادات → استعادة نسخة احتياطية** and select that file. Records do not transfer automatically between Chrome and the standalone app.
5. Test a sample parcel in airplane mode before entering real records.

## Records and backups

- Records live in IndexedDB inside this app's private Android WebView data. Updates signed with the same key and package identity preserve app data; uninstalling or clearing app storage removes it. The app does not depend on a browser profile.
- **تصدير نسخة احتياطية** opens Android's **Save** document picker. Choose a folder outside the application, such as Documents or Downloads, or an available Google Drive document provider. Saving is reported only after the document provider finishes writing. Cancelling does not update the backup timestamp.
- Keep a separate copy off the phone. A file saved only on the phone cannot protect against its loss. Uploading to Drive requires connectivity; exporting to a local folder works offline. There is no automatic cloud sync.
- **استعادة نسخة احتياطية** opens Android's file picker. The existing JSON validation, replacement confirmation and pre-restore safety copy still apply. Older backups remain readable, including saved manual parcel codes, Diyar prices and list closed marks.
- Android's system app backup is disabled. Manual JSON exports and optional daily encrypted Gmail backups provide recovery. Keep manual backups private; they include customer phone numbers. See [daily Gmail setup and recovery](daily-gmail-backups.md).
- WhatsApp drafts launch WhatsApp Business directly, falling back to WhatsApp if Business is absent. The user still presses Send manually. Missing WhatsApp shows an error and does not advance the notification queue.
- In Settings, enter **بريد النسخ الاحتياطية**, save settings, then choose **إرسال نسخة إلى Gmail**. Gmail opens with the JSON attachment and recipient; press Send yourself and verify receipt. Opening a draft does not mean it was sent, so it does not update the saved-backup timestamp.
- The app's WebView only permits its bundled `https://localhost` pages/resources; a native request filter and Content Security Policy block remote resources and navigation. WhatsApp and the older Gmail draft button are explicit native app actions. If daily encrypted backups are enabled, a native background worker obtains send-only authorization from Google Play services and uploads the encrypted attachment to Google's fixed Gmail HTTPS API. Parcel work still runs offline.
- Newly earned commission is recorded only when **خلصت** confirms a fully paid/collected list. Existing financial history from older versions remains intact.

## Verification before distributing an APK

Run `npm run test`, `npm run lint`, and `npm run android:sync`. Then compile with `npm run android:apk` and verify on a Samsung or emulator:

1. Fresh launch in airplane mode; navigate to all five screens and restart.
2. Save parcels with manual codes and Diyar prices; reopen and check totals.
3. Complete a list, tap **خلصت**, restart and verify its button stays hidden.
4. Save a JSON backup to Documents; cancel another save and check the timestamp does not change.
5. Restore from Documents/Drive, reject malformed JSON, cancel restoration, and check the safety copy.
6. Launch a WhatsApp draft without sending a test message; return and check queue progress.
7. Install a newer APK with the same signing key over the existing app and verify records remain.

Native file-picker, launcher, Android back navigation and update behavior require a real Android build/device check; a browser preview cannot verify them.
