package com.boutiquedah.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.activity.result.ActivityResult;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "AutomaticBackups")
public class AutomaticBackupsPlugin extends Plugin {
    private static final String DAILY = "boutique-dah-daily-gmail";
    private static final String NOW = "boutique-dah-gmail-now";
    private static Constraints constraints() { return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(); }
    private static void schedule(Context context) throws Exception {
        PeriodicWorkRequest work = new PeriodicWorkRequest.Builder(GmailBackupWorker.class, 24, TimeUnit.HOURS)
            .setInitialDelay(24, TimeUnit.HOURS).setConstraints(constraints())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.MINUTES).build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(DAILY, ExistingPeriodicWorkPolicy.CANCEL_AND_REENQUEUE, work).getResult().get();
    }
    private static void sendNow(Context context) throws Exception {
        OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(GmailBackupWorker.class).setConstraints(constraints())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.MINUTES).build();
        WorkManager.getInstance(context).enqueueUniqueWork(NOW, ExistingWorkPolicy.KEEP, work).getResult().get();
    }
    @PluginMethod public void status(PluginCall call) {
        synchronized (AutomaticBackupStore.LOCK) {
            SharedPreferences p = AutomaticBackupStore.prefs(getContext());
            call.resolve(new JSObject().put("enabled", p.getBoolean("enabled", false)).put("account", p.getString("account", ""))
                .put("authorized", p.getBoolean("authorized", false)).put("lastSentAt", p.getLong("lastSentAt", 0))
                .put("lastSnapshotAt", p.getLong("lastSnapshotAt", 0)).put("lastSentSnapshotAt", p.getLong("lastSentSnapshotAt", 0))
                .put("error", p.getString("error", "")));
        }
    }
    @PluginMethod public void authorize(PluginCall call) {
        String email = call.getString("email", "");
        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) { call.reject("أدخل بريد Gmail الصحيح أولاً"); return; }
        synchronized (AutomaticBackupStore.LOCK) {
            SharedPreferences p = AutomaticBackupStore.prefs(getContext());
            if (p.getBoolean("enabled", false) && !email.equals(p.getString("account", ""))) {
                call.reject("أوقف النسخ التلقائي قبل تغيير الحساب"); return;
            }
        }
        Intent intent = new Intent(getContext(), GmailAuthorizationActivity.class).putExtra("email", email);
        try { startActivityForResult(call, intent, "authorized"); }
        catch (Exception e) { call.reject("تعذّر فتح إذن Google", e); }
    }
    @ActivityCallback private void authorized(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() == Activity.RESULT_OK) call.resolve(new JSObject().put("cancelled", false));
        else if (result.getResultCode() == Activity.RESULT_CANCELED) call.resolve(new JSObject().put("cancelled", true));
        else call.reject(result.getData() != null ? result.getData().getStringExtra("error") : "تعذّر ربط Google");
    }
    @PluginMethod public void enable(PluginCall call) {
        String password = call.getString("password"), text = call.getString("text");
        call.getData().remove("password"); call.getData().remove("text");
        execute(() -> {
            try {
                AutomaticBackupStore.enable(getContext(), password, text);
                schedule(getContext()); sendNow(getContext()); call.resolve();
            } catch (Exception e) {
                try { AutomaticBackupStore.disable(getContext()); } catch (Exception ignored) {}
                call.reject("لم يتم تفعيل النسخ التلقائي: " + e.getMessage());
            }
        });
    }
    @PluginMethod public void sync(PluginCall call) {
        String text = call.getString("text"); call.getData().remove("text");
        execute(() -> {
            try { AutomaticBackupStore.sync(getContext(), text); call.resolve(); }
            catch (Exception e) {
                synchronized (AutomaticBackupStore.LOCK) {
                    AutomaticBackupStore.prefs(getContext()).edit().putBoolean("snapshotError", true)
                        .putString("error", "تعذّر تحديث النسخة التلقائية. " + e.getMessage()).commit();
                }
                call.reject("السجلات محفوظة، لكن تعذّر تحديث النسخة التلقائية. راجع الإعدادات.");
            }
        });
    }
    @PluginMethod public void sendNow(PluginCall call) {
        execute(() -> {
            try {
                if (!AutomaticBackupStore.prefs(getContext()).getBoolean("enabled", false)) throw new IllegalStateException("فعّل النسخ أولاً");
                sendNow(getContext()); call.resolve();
            } catch (Exception e) { call.reject("تعذّر جدولة إرسال النسخة", e); }
        });
    }
    @PluginMethod public void disable(PluginCall call) {
        execute(() -> {
            try {
                AutomaticBackupStore.disable(getContext());
                WorkManager manager = WorkManager.getInstance(getContext());
                manager.cancelUniqueWork(DAILY).getResult().get(); manager.cancelUniqueWork(NOW).getResult().get();
                call.resolve();
            } catch (Exception e) { call.reject("تعذّر إيقاف النسخ التلقائي", e); }
        });
    }
}
