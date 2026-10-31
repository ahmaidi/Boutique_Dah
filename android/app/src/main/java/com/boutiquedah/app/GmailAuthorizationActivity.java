package com.boutiquedah.app;

import android.accounts.Account;
import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;

/** Google owns the account/consent UI. No password or OAuth token crosses into JavaScript. */
public class GmailAuthorizationActivity extends Activity {
    static final String SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
    private String email;
    private boolean waitingForConsent;
    static AuthorizationRequest request(String email) {
        return AuthorizationRequest.builder().setAccount(new Account(email, "com.google"))
            .setRequestedScopes(Collections.singletonList(new Scope(SEND_SCOPE))).build();
    }
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        email = getIntent().getStringExtra("email");
        if (email == null || !android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) { finish(); return; }
        if (savedInstanceState != null && savedInstanceState.getBoolean("waitingForConsent", false)) {
            waitingForConsent = true; return;
        }
        Identity.getAuthorizationClient(this).authorize(request(email))
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    try { waitingForConsent = true; startIntentSenderForResult(result.getPendingIntent().getIntentSender(), 41, null, 0, 0, 0); }
                    catch (Exception e) { fail(); }
                } else complete(result);
            }).addOnFailureListener(e -> fail());
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        state.putBoolean("waitingForConsent", waitingForConsent); super.onSaveInstanceState(state);
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != 41) return;
        if (resultCode != RESULT_OK || data == null) { setResult(RESULT_CANCELED); finish(); return; }
        try { complete(Identity.getAuthorizationClient(this).getAuthorizationResultFromIntent(data)); }
        catch (Exception e) { fail(); }
    }
    private void complete(AuthorizationResult result) {
        if (result.getAccessToken() == null || !result.getGrantedScopes().contains(SEND_SCOPE)) { fail(); return; }
        synchronized (AutomaticBackupStore.LOCK) {
            // Changing account always requires enabling again with a recovery password.
            android.content.SharedPreferences prefs = AutomaticBackupStore.prefs(this);
            android.content.SharedPreferences.Editor editor = prefs.edit().putString("account", email)
                .putBoolean("authorized", true).putString("error", "");
            if (!email.equals(prefs.getString("account", ""))) editor.putLong("lastSentAt", 0).putLong("lastSentSnapshotAt", 0);
            if (!editor.commit()) { fail(); return; }
        }
        setResult(RESULT_OK); finish();
    }
    private void fail() {
        setResult(RESULT_FIRST_USER, new Intent().putExtra("error",
            "تعذّر ربط Google. تحقق من الإنترنت وإعداد مشروع Google Cloud وحساب الهاتف، ثم حاول مجدداً."));
        finish();
    }
}
