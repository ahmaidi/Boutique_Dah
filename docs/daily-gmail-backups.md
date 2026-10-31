# Daily encrypted Gmail backups — Boutique Dah

The APK remains a standalone, offline parcel app. Daily email is optional and runs
on the phone using Android WorkManager and Google's Gmail API. There is no hosted
website, backup server, Gmail password embedded in the APK, or developer mailbox.

## One-time Google setup (on a computer)

Google requires registration of this Android app before it can obtain permission
to send email. Installing the APK alone does **not** complete this registration.

1. Sign in to [Google Cloud Console](https://console.cloud.google.com/) with the
   Google account you will use for backups. Create a project named **Boutique Dah**.
2. Open **APIs & Services → Library**, search for **Gmail API**, and enable it.
3. Open **Google Auth Platform**. Set up the app's branding/name and your contact
   email. Use **External** audience for an ordinary personal Gmail account.
4. Under **Data Access**, add only
   `https://www.googleapis.com/auth/gmail.send`. The app does not request permission
   to read your inbox or delete messages.
5. Under **Clients → Create client**, select **Android** and enter:

   - Package: `com.boutiquedah.app`
   - SHA-1 signing certificate:
     `DA:5B:68:CE:EE:C0:56:51:E5:FB:41:77:AC:98:DB:FB:EA:62:A6:CD`

6. While the project is in **Testing**, add your Gmail account under **Audience →
   Test users**. Testing authorization can expire after seven days for this scope,
   so it is unsuitable for unattended long-term backups. Review Google's
   [testing and publishing rules](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).
   Move to **In production** for ongoing personal use. Google may show an
   unverified-app warning; personal-use verification exceptions and user limits
   are governed by Google. Do not present the app as verified or bypass a block.

The Android OAuth registration is matched by package and signing certificate.
This implementation needs no client-secret file, web client, backend refresh-token
service, or `google-services.json`. Keep the existing APK signing identity for
updates. Do not send anyone your Google password or backup recovery password.

Google's current console labels/publishing requirements can change. Official
references: [Android authorization](https://developer.android.com/identity/authorization),
[Gmail send permission](https://developers.google.com/workspace/gmail/api/auth/scopes),
[sending email](https://developers.google.com/workspace/gmail/api/guides/sending).

## Enable on the Samsung

1. Export a manual backup before updating. Install the latest **Boutique Dah APK** over the
   existing app; do not uninstall it or clear its data. This build requires Android
   8 or newer (the Galaxy A12 is supported).
2. Ensure the same Google account is added in the phone's Android settings and
   Google Play services is available and up to date.
3. Open Boutique Dah → **الإعدادات**. Enter your Gmail under **بريد النسخ
   الاحتياطية**, then save settings.
4. In **نسخة يومية مشفّرة إلى Gmail**, tap **ربط حساب Google**. Approve Google's
   send-email permission. You must be online for this step.
5. Enter a new backup recovery password (12–128 characters) and confirm it. This
   is **not** your Google password. Keep it outside the phone, for example in a
   password manager or a private written copy. Check the confirmation box and
   tap **تفعيل النسخ اليومي**.
6. The first encrypted email is queued immediately; subsequent work is scheduled
   approximately every 24 hours. The status **آخر إرسال أكّده Gmail** changes only
   after Google's API returns a successful message ID. It confirms Gmail accepted
   the email, not that it has been read or reached a specific inbox folder.
7. Verify the first attachment appears in your Gmail. Download it and test
   password decryption via **استعادة نسخة احتياطية**; review the preview, then
   cancel without replacing your records. Keep the password and attachment safe.

The scheduler waits for a network connection and retries transient failures with
backoff. Android/Samsung battery restrictions can delay it, so **exact 24-hour
delivery is not guaranteed**. Removing the app from Recents does not cancel the
schedule; after **Force stop**, reopen the app. A powered-off phone cannot send.
If necessary, allow background battery use in Samsung Settings → Apps → Boutique
Dah → Battery (labels vary by Android version). No exact-alarm or battery-exemption
permission is requested by the app.

If permission expires or is revoked, open app Settings and renew Google permission.
If Google reports a setup problem, verify the enabled Gmail API, account, scope,
package and SHA-1. Use **إرسال نسخة مشفّرة الآن** after correcting it and verify the
success date. Check this status regularly; automatic scheduling is not a guarantee
against loss, a full mailbox, provider failures, or a lost phone before its next send.

## Restore after losing the phone

1. Install Boutique Dah on the replacement phone.
2. Sign in to your Gmail and download the newest `boutique-dah-encrypted-*.json`
   attachment with an adequate snapshot date.
3. In Boutique Dah Settings, choose **استعادة نسخة احتياطية** and select it.
4. Enter the recovery password used when that file was created. The app decrypts
   the file locally, validates its records, and displays a preview.
5. Confirm replacement only after reviewing it. A local safety copy is made first.
6. Configure daily Gmail backups again on the replacement phone.

The attachment is portable: restoration does not need the old device or its
Keystore. **A forgotten recovery password cannot be recovered.** Changing it by
disabling/re-enabling affects new backups only; old attachments still require
their old password.

## Implementation and limits

- PBKDF2-HMAC-SHA-256, 210,000 iterations, 16-byte random salt, AES-256-GCM with
  a fresh 12-byte IV for each snapshot and a fixed version-specific AAD string.
- The password is not saved. The derived key for background updates is wrapped by
  a device-specific Android Keystore key and stored privately. Account access
  tokens are obtained by Google Play services and used only in native memory.
- Each successful save/restore refreshes an atomic encrypted snapshot from the
  authoritative IndexedDB records. The worker sends that last prepared snapshot
  without opening a hidden WebView. An abrupt process/power failure between the
  database commit and snapshot update can leave the snapshot one save behind;
  reopening the app refreshes it. The settings show both send time and the date of
  the snapshot actually sent. Failed snapshot updates are visible and prevent
  sending the known-stale snapshot until refreshed.
- The maximum plain snapshot for automatic email is 12 MiB, allowing space for
  encrypted JSON/base64 and MIME overhead within Gmail's attachment limits.
  Manual JSON exports retain their existing 20 MiB limit. Encrypted imports accept
  files up to 32 MiB and enforce the decrypted backup validation/size limits.
- **Manual export and the older Gmail draft button still create unencrypted JSON.**
  Daily automatic emails and **إرسال نسخة مشفّرة الآن** use encryption.
- The native WebView still blocks remote pages/requests. Only the native worker
  sends the encrypted attachment to the fixed HTTPS Gmail API endpoint; it rejects
  redirects. The only requested Google scope is `gmail.send`.
- Disabling cancels queued work and removes the local mirrored key/snapshot.
  A request already transmitted cannot be recalled. Authorization can separately
  be revoked in your Google Account's third-party connections settings.
- A network interruption after Gmail accepts a message but before the phone sees
  the response can produce a duplicate email on retry. It does not duplicate or
  modify parcel/financial records. Success status is never fabricated.
- New duplicate parcel references are rejected atomically. Older repeated business
  references are preserved in exports/restores; unique internal IDs still protect
  record integrity.

## Verification boundary

JavaScript tests cover encryption compatibility, incorrect passwords, tampering,
parameter bounds, duplicate-code rejection and legacy record preservation. Native
unit tests cover cryptographic round trips, an independent Unicode PBKDF2 vector,
and MIME header-injection rejection. Build/lint/signature checks do not substitute
for a successful Google authorization and email/restore test on the Samsung. No
phone or Google Cloud project was connected during development.
