package com.boutiquedah.app;

import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

public class BackupCryptoTest {
    @Test public void unicodePasswordMatchesWebCryptoKdf() throws Exception {
        byte[] salt = new byte[16]; for (int i = 0; i < salt.length; i++) salt[i] = (byte) i;
        byte[] key = BackupCrypto.derive("كلمة-مرور-آمنة-123".toCharArray(), salt);
        StringBuilder hex = new StringBuilder(); for (byte value : key) hex.append(String.format("%02x", value));
        assertEquals("f95e43735213a4f5c8744e95f501bc11a4b98c2a8ab0a7c6f24676f10008ac46", hex.toString());
    }
    @Test public void passwordIsPortableAndTamperingFails() throws Exception {
        byte[] salt = BackupCrypto.random(16), iv = BackupCrypto.random(12);
        byte[] key = BackupCrypto.derive("كلمة-مرور-آمنة-123".toCharArray(), salt);
        byte[] plain = "customer records — بوتيك الداه".getBytes(StandardCharsets.UTF_8);
        byte[] encrypted = BackupCrypto.encrypt(plain, key, iv);
        assertArrayEquals(plain, BackupCrypto.decrypt(encrypted,
            BackupCrypto.derive("كلمة-مرور-آمنة-123".toCharArray(), salt), iv));
        encrypted[0] ^= 1;
        assertThrows(javax.crypto.AEADBadTagException.class, () -> BackupCrypto.decrypt(encrypted, key, iv));
        assertFalse(Arrays.equals(key, BackupCrypto.derive("different password".toCharArray(), salt)));
    }
    @Test public void mimeContainsOnlyEncryptedAttachmentAndRejectsHeaderInjection() throws Exception {
        byte[] attachment = "{\"ciphertext\":\"encrypted\"}".getBytes(StandardCharsets.UTF_8);
        String mime = new String(GmailMime.message("test@gmail.com", attachment, "test-boundary"), StandardCharsets.UTF_8);
        assertTrue(mime.contains("To: test@gmail.com\r\n"));
        assertTrue(mime.contains(java.util.Base64.getEncoder().encodeToString(attachment)));
        assertFalse(mime.contains("{\"ciphertext\""));
        assertThrows(IllegalArgumentException.class, () -> GmailMime.message("test@gmail.com\r\nBcc: attacker@example.com", attachment, "boundary"));
    }
}
