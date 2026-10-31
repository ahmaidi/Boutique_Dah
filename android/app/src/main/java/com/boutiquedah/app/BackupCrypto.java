package com.boutiquedah.app;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/** Portable, password-derived backup encryption: recovery never needs this phone's Keystore. */
public final class BackupCrypto {
    public static final int ITERATIONS = 210000;
    private static final byte[] AAD = "boutique-dah-encrypted-backup:v1".getBytes(StandardCharsets.UTF_8);
    private BackupCrypto() {}
    public static byte[] random(int count) {
        byte[] value = new byte[count]; new SecureRandom().nextBytes(value); return value;
    }
    public static byte[] derive(char[] password, byte[] salt) throws GeneralSecurityException {
        if (salt.length != 16) throw new GeneralSecurityException("Invalid salt");
        PBEKeySpec spec = new PBEKeySpec(password, salt, ITERATIONS, 256);
        try { return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(); }
        finally { spec.clearPassword(); Arrays.fill(password, '\0'); }
    }
    public static byte[] encrypt(byte[] plaintext, byte[] key, byte[] iv) throws GeneralSecurityException {
        return crypt(Cipher.ENCRYPT_MODE, plaintext, key, iv);
    }
    public static byte[] decrypt(byte[] ciphertext, byte[] key, byte[] iv) throws GeneralSecurityException {
        return crypt(Cipher.DECRYPT_MODE, ciphertext, key, iv);
    }
    private static byte[] crypt(int mode, byte[] input, byte[] key, byte[] iv) throws GeneralSecurityException {
        if (iv.length != 12 || key.length != 32) throw new GeneralSecurityException("Invalid parameters");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
        cipher.updateAAD(AAD);
        return cipher.doFinal(input);
    }
}
