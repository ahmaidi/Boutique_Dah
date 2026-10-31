package com.boutiquedah.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

final class AutomaticBackupStore {
    static final Object LOCK = new Object();
    static final int MAX_PLAIN_BYTES = 12 * 1024 * 1024;
    private static final String KEY_ALIAS = "boutique-dah-backup-key-v1";
    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences("automatic-backups", Context.MODE_PRIVATE);
    }
    static AtomicFile snapshot(Context context) {
        return new AtomicFile(new File(context.getFilesDir(), "daily-backup-encrypted.json"));
    }
    static String encode(byte[] value) { return Base64.encodeToString(value, Base64.NO_WRAP); }
    static byte[] decode(String value) { return Base64.decode(value, Base64.NO_WRAP); }
    private static SecretKey wrappingKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(KEY_ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(KEY_ALIAS, null);
    }
    private static String wrap(byte[] value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, wrappingKey());
        return encode(cipher.getIV()) + ":" + encode(cipher.doFinal(value));
    }
    private static byte[] unwrap(String value) throws Exception {
        String[] parts = value.split(":", -1);
        if (parts.length != 2) throw new IllegalStateException("Missing backup key");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, wrappingKey(), new GCMParameterSpec(128, decode(parts[0])));
        return cipher.doFinal(decode(parts[1]));
    }
    static long revision(String text) throws Exception {
        if (text == null || text.getBytes(StandardCharsets.UTF_8).length > MAX_PLAIN_BYTES)
            throw new IllegalArgumentException("النسخ التلقائي يدعم حتى ١٢ ميغابايت؛ صدّر نسخة يدوية");
        JSONObject value = new JSONObject(text);
        if (!"boutique-dah-backup".equals(value.getString("format")) || value.getInt("version") != 1)
            throw new IllegalArgumentException("نسخة غير صالحة");
        long revision = value.getJSONObject("data").getLong("revision");
        if (revision < 0) throw new IllegalArgumentException("نسخة غير صالحة");
        return revision;
    }
    private static void write(Context context, String text, byte[] key, byte[] salt) throws Exception {
        byte[] iv = BackupCrypto.random(12);
        byte[] encrypted = BackupCrypto.encrypt(text.getBytes(StandardCharsets.UTF_8), key, iv);
        JSONObject envelope = new JSONObject().put("format", "boutique-dah-encrypted-backup")
            .put("version", 1).put("kdf", "PBKDF2-SHA256").put("iterations", BackupCrypto.ITERATIONS)
            .put("salt", encode(salt)).put("iv", encode(iv)).put("ciphertext", encode(encrypted));
        AtomicFile file = snapshot(context);
        FileOutputStream stream = null;
        try {
            stream = file.startWrite(); stream.write(envelope.toString().getBytes(StandardCharsets.UTF_8));
            file.finishWrite(stream);
        } catch (Exception e) { if (stream != null) file.failWrite(stream); throw e; }
    }
    static void enable(Context context, String password, String text) throws Exception {
        if (password == null || password.length() < 12 || password.length() > 128)
            throw new IllegalArgumentException("اختر كلمة مرور من ١٢ إلى ١٢٨ حرفاً");
        long revision = revision(text);
        synchronized (LOCK) {
            SharedPreferences prefs = prefs(context);
            if (!prefs.getBoolean("authorized", false)) throw new IllegalStateException("اربط حساب Gmail أولاً");
            byte[] salt = BackupCrypto.random(16);
            byte[] key = BackupCrypto.derive(password.toCharArray(), salt);
            try {
                String wrapped = wrap(key);
                // A failed reconfiguration must never send a snapshot with uncertain settings.
                if (!prefs.edit().putBoolean("enabled", false).commit()) throw new IllegalStateException("تعذّر حفظ الإعدادات");
                write(context, text, key, salt);
                if (!prefs.edit().putString("key", wrapped).putString("salt", encode(salt))
                    .putString("generation", UUID.randomUUID().toString()).putLong("revision", revision)
                    .putLong("lastSnapshotAt", System.currentTimeMillis()).putString("error", "")
                    .putBoolean("snapshotError", false).putBoolean("enabled", true).commit())
                    throw new IllegalStateException("تعذّر حفظ إعدادات النسخ");
            } finally { Arrays.fill(key, (byte) 0); }
        }
    }
    static void sync(Context context, String text) throws Exception {
        long revision = revision(text);
        synchronized (LOCK) {
            SharedPreferences prefs = prefs(context);
            if (!prefs.getBoolean("enabled", false) || revision < prefs.getLong("revision", -1)) return;
            if (revision == prefs.getLong("revision", -1) && !prefs.getBoolean("snapshotError", false)
                && snapshot(context).getBaseFile().exists()) return;
            byte[] key = unwrap(prefs.getString("key", ""));
            try { write(context, text, key, decode(prefs.getString("salt", ""))); }
            finally { Arrays.fill(key, (byte) 0); }
            SharedPreferences.Editor editor = prefs.edit().putLong("revision", revision)
                .putLong("lastSnapshotAt", System.currentTimeMillis()).putBoolean("snapshotError", false);
            if (prefs.getBoolean("snapshotError", false)) editor.putString("error", "");
            if (!editor.commit()) throw new IllegalStateException("تعذّر تأكيد تجهيز النسخة");
        }
    }
    static void disable(Context context) throws Exception {
        synchronized (LOCK) {
            if (!prefs(context).edit().putBoolean("enabled", false).remove("key").remove("salt")
                .remove("generation").putString("error", "").commit()) throw new IllegalStateException("تعذّر إيقاف النسخ");
            snapshot(context).delete();
        }
    }
}
