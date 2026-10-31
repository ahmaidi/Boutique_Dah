package com.boutiquedah.app;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.ClearTokenRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.tasks.Tasks;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;

public class GmailBackupWorker extends Worker {
    private static final Object SEND_LOCK = new Object();
    public GmailBackupWorker(@NonNull Context context, @NonNull WorkerParameters parameters) { super(context, parameters); }
    @NonNull @Override public Result doWork() {
        synchronized (SEND_LOCK) { return send(); }
    }
    private Result send() {
        Context context = getApplicationContext();
        SharedPreferences prefs = AutomaticBackupStore.prefs(context);
        String account, generation;
        byte[] attachment;
        long snapshotAt;
        synchronized (AutomaticBackupStore.LOCK) {
            if (!prefs.getBoolean("enabled", false)) return Result.success();
            if (prefs.getBoolean("snapshotError", false)) return Result.failure();
            account = prefs.getString("account", ""); generation = prefs.getString("generation", "");
            snapshotAt = prefs.getLong("lastSnapshotAt", 0);
            try { attachment = AutomaticBackupStore.snapshot(context).readFully(); }
            catch (Exception e) { return error("تعذّر قراءة النسخة المحلية. افتح التطبيق لتجهيزها مجدداً.", false, generation); }
        }
        HttpsURLConnection connection = null;
        try {
            // Google Play services renews short-lived tokens. Tokens stay in native memory only.
            AuthorizationResult auth = Tasks.await(Identity.getAuthorizationClient(context)
                .authorize(GmailAuthorizationActivity.request(account)), 60, TimeUnit.SECONDS);
            if (auth.hasResolution() || auth.getAccessToken() == null) {
                synchronized (AutomaticBackupStore.LOCK) {
                    if (generation.equals(prefs.getString("generation", ""))) prefs.edit().putBoolean("authorized", false).commit();
                }
                return error("يلزم تجديد إذن Google. افتح الإعدادات واربط Gmail مجدداً.", false, generation);
            }
            byte[] mime = GmailMime.message(account, attachment, "boutique-" + UUID.randomUUID());
            synchronized (AutomaticBackupStore.LOCK) {
                if (isStopped() || !prefs.getBoolean("enabled", false) || !generation.equals(prefs.getString("generation", ""))) return Result.success();
            }
            connection = (HttpsURLConnection) new URL("https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media").openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(30000); connection.setReadTimeout(30000);
            connection.setRequestMethod("POST"); connection.setDoOutput(true);
            connection.setRequestProperty("Authorization", "Bearer " + auth.getAccessToken());
            connection.setRequestProperty("Content-Type", "message/rfc822");
            connection.setFixedLengthStreamingMode(mime.length);
            try (OutputStream out = connection.getOutputStream()) { out.write(mime); }
            int code = connection.getResponseCode();
            if (code >= 200 && code < 300) {
                // A success date means Gmail accepted the message, never merely that a draft opened.
                byte[] response;
                try (InputStream in = connection.getInputStream()) { response = readResponse(in); }
                if (new JSONObject(new String(response, java.nio.charset.StandardCharsets.UTF_8)).optString("id").isEmpty())
                    return error("لم يؤكد Gmail إرسال النسخة؛ ستتم المحاولة مجدداً.", true, generation);
                synchronized (AutomaticBackupStore.LOCK) {
                    if (generation.equals(prefs.getString("generation", ""))) {
                        SharedPreferences.Editor editor = prefs.edit().putLong("lastSentAt", System.currentTimeMillis())
                            .putLong("lastSentSnapshotAt", snapshotAt);
                        if (!prefs.getBoolean("snapshotError", false)) editor.putString("error", "");
                        if (!editor.commit()) return Result.retry();
                    }
                }
                return Result.success();
            }
            if (code == 401) {
                Tasks.await(Identity.getAuthorizationClient(context).clearToken(
                    ClearTokenRequest.builder().setToken(auth.getAccessToken()).build()), 30, TimeUnit.SECONDS);
                return error("انتهت صلاحية إذن الإرسال؛ ستتم إعادة المحاولة. أعد ربط Google إذا استمر الخطأ.", true, generation);
            }
            if (code == 403) return error("رفض Google الإرسال. تحقق من تفعيل Gmail API وإذن الحساب وإعداد Google Cloud.", false, generation);
            return error("تعذّر الإرسال إلى Gmail (" + code + ").", code == 429 || code >= 500, generation);
        } catch (Exception e) {
            // Do not include tokens, response bodies, or customer data in error messages/logs.
            return error("تعذّر الاتصال بخدمة Google. ستتم المحاولة مجدداً؛ تحقق من الإنترنت وربط الحساب إن استمر الخطأ.", true, generation);
        } finally { if (connection != null) connection.disconnect(); }
    }
    private static byte[] readResponse(InputStream in) throws Exception {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[1024]; int count;
        while ((count = in.read(buffer)) != -1) {
            if (out.size() + count > 16384) throw new IllegalStateException("Oversized response");
            out.write(buffer, 0, count);
        }
        return out.toByteArray();
    }
    private Result error(String message, boolean retry, String generation) {
        synchronized (AutomaticBackupStore.LOCK) {
            SharedPreferences prefs = AutomaticBackupStore.prefs(getApplicationContext());
            if (generation.equals(prefs.getString("generation", "")) && !prefs.getBoolean("snapshotError", false))
                prefs.edit().putString("error", message).commit();
        }
        return retry && getRunAttemptCount() < 8 ? Result.retry() : Result.failure();
    }
}
