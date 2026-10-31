package com.boutiquedah.app;

import android.app.Activity;
import android.content.Intent;
import android.content.ClipData;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Android's document picker saves outside app data, without broad storage permissions. */
@CapacitorPlugin(name = "BackupFiles")
public class BackupFilesPlugin extends Plugin {
    private static final int MAX_BYTES = 20 * 1024 * 1024;

    @PluginMethod
    public void email(PluginCall call) {
        String text = call.getString("text");
        String filename = call.getString("filename");
        String recipient = call.getString("recipient");
        if (text == null || filename == null || !filename.matches("boutique-dah[-a-zA-Z0-9.]+\\.json") || recipient == null || !android.util.Patterns.EMAIL_ADDRESS.matcher(recipient).matches()) {
            call.reject("تحقق من بريد النسخ الاحتياطية"); return;
        }
        execute(() -> {
            try {
                byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
                if (bytes.length > MAX_BYTES) { call.reject("حجم النسخة أكبر من ٢٠ ميغابايت"); return; }
                File folder = new File(getContext().getCacheDir(), "backup-mail");
                if (!folder.exists() && !folder.mkdirs()) throw new IllegalStateException("Cannot prepare attachment");
                // Keep recent drafts readable; clean only app-created attachments older than 7 days.
                File[] previous = folder.listFiles();
                if (previous != null) for (File file : previous)
                    if (file.isFile() && file.lastModified() < System.currentTimeMillis() - 7L * 24 * 60 * 60 * 1000) file.delete();
                File attachment = new File(folder, filename);
                try (OutputStream out = new FileOutputStream(attachment)) { out.write(bytes); }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", attachment);
                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType("application/json");
                intent.setPackage("com.google.android.gm");
                intent.putExtra(Intent.EXTRA_EMAIL, new String[]{recipient});
                intent.putExtra(Intent.EXTRA_SUBJECT, "نسخة احتياطية — بوتيك الداه");
                intent.putExtra(Intent.EXTRA_TEXT, "نسخة احتياطية من سجلات بوتيك الداه. احتفظ بالمرفق لاستعادة البيانات عند الحاجة.");
                intent.putExtra(Intent.EXTRA_STREAM, uri);
                intent.setClipData(ClipData.newUri(getContext().getContentResolver(), "Boutique Dah backup", uri));
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().runOnUiThread(() -> {
                    try { getActivity().startActivity(intent); call.resolve(); }
                    catch (android.content.ActivityNotFoundException e) { call.reject("ثبّت تطبيق Gmail وسجّل الدخول إليه أولاً", e); }
                    catch (Exception e) { call.reject("تعذّر فتح Gmail بالمرفق", e); }
                });
            } catch (Exception e) { call.reject("تعذّر تجهيز مرفق النسخة", e); }
        });
    }

    @PluginMethod
    public void save(PluginCall call) {
        String text = call.getString("text");
        String filename = call.getString("filename");
        if (text == null || filename == null || !filename.matches("boutique-dah[-a-zA-Z0-9.]+\\.json")) {
            call.reject("ملف النسخة غير صالح");
            return;
        }
        execute(() -> {
            try {
                byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
                if (bytes.length > MAX_BYTES) { call.reject("حجم النسخة أكبر من ٢٠ ميغابايت"); return; }
                File pending = File.createTempFile("boutique-backup-", ".json", getContext().getCacheDir());
                try (OutputStream out = new FileOutputStream(pending)) { out.write(bytes); }
                // Keep large customer records out of Android's saved-activity Bundle.
                call.getData().remove("text");
                call.getData().put("cacheName", pending.getName());
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, filename);
                getActivity().runOnUiThread(() -> {
                    try { startActivityForResult(call, intent, "saved"); }
                    catch (Exception e) { pending.delete(); call.reject("تعذّر فتح نافذة حفظ الملفات", e); }
                });
            } catch (Exception e) { call.reject("تعذّر تجهيز النسخة الاحتياطية", e); }
        });
    }

    @ActivityCallback
    private void saved(PluginCall call, ActivityResult result) {
        if (call == null) return;
        String cacheName = call.getString("cacheName", "");
        if (!cacheName.matches("boutique-backup-[a-zA-Z0-9-]+\\.json")) { call.reject("ملف النسخة غير متاح"); return; }
        File pending = new File(getContext().getCacheDir(), cacheName);
        Uri uri = selectedUri(call, result);
        if (uri == null) { pending.delete(); return; }
        execute(() -> {
            try (InputStream in = new FileInputStream(pending);
                 OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (out == null) throw new IllegalStateException("No output stream");
                byte[] buffer = new byte[8192];
                int count;
                while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
                out.flush();
            } catch (Exception e) {
                call.reject("تعذّر حفظ النسخة. تحقق من المساحة وأعد المحاولة", e);
                return;
            } finally {
                pending.delete();
            }
            call.resolve(new JSObject().put("cancelled", false));
        });
    }

    @PluginMethod
    public void open(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        // Some file providers label JSON as text/plain or application/octet-stream.
        intent.setType("*/*");
        try {
            startActivityForResult(call, intent, "opened");
        } catch (Exception e) {
            call.reject("تعذّر فتح نافذة اختيار الملفات", e);
        }
    }

    @ActivityCallback
    private void opened(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = selectedUri(call, result);
        if (uri == null) return;
        execute(() -> {
            try (InputStream in = getContext().getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                if (in == null) throw new IllegalStateException("No input stream");
                byte[] buffer = new byte[8192];
                int count;
                while ((count = in.read(buffer)) != -1) {
                    if (bytes.size() + count > 32 * 1024 * 1024) {
                        call.reject("اختر نسخة أصغر من ٣٢ ميغابايت");
                        return;
                    }
                    bytes.write(buffer, 0, count);
                }
                call.resolve(new JSObject().put("cancelled", false).put("text", bytes.toString(StandardCharsets.UTF_8.name())));
            } catch (Exception e) {
                call.reject("تعذّر قراءة النسخة الاحتياطية", e);
            }
        });
    }

    private Uri selectedUri(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.resolve(new JSObject().put("cancelled", true));
            return null;
        }
        Uri uri = result.getData() != null ? result.getData().getData() : null;
        if (uri == null) call.reject("لم يتم اختيار ملف");
        return uri;
    }
}
