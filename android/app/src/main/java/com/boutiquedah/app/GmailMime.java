package com.boutiquedah.app;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

final class GmailMime {
    private GmailMime() {}
    static byte[] message(String email, byte[] attachment, String boundary) {
        if (email == null || email.contains("\r") || email.contains("\n") || !email.matches("[^<>\\s@]+@[^<>\\s@]+"))
            throw new IllegalArgumentException("Invalid email");
        if (!boundary.matches("[a-zA-Z0-9-]+")) throw new IllegalArgumentException("Invalid boundary");
        String filename = "boutique-dah-encrypted-" + System.currentTimeMillis() + ".json";
        String encoded = Base64.getMimeEncoder(76, new byte[]{13, 10}).encodeToString(attachment);
        String mime = "From: " + email + "\r\nTo: " + email + "\r\n"
            + "Subject: Boutique Dah - encrypted daily backup\r\nMIME-Version: 1.0\r\n"
            + "Content-Type: multipart/mixed; boundary=\"" + boundary + "\"\r\n\r\n"
            + "--" + boundary + "\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n"
            + "Encrypted Boutique Dah backup. Keep this file and your recovery password separately.\r\n"
            + "Restore this JSON file from Settings in Boutique Dah using your recovery password.\r\n"
            + "--" + boundary + "\r\nContent-Type: application/json; name=\"" + filename + "\"\r\n"
            + "Content-Disposition: attachment; filename=\"" + filename + "\"\r\n"
            + "Content-Transfer-Encoding: base64\r\n\r\n" + encoded + "\r\n--" + boundary + "--\r\n";
        return mime.getBytes(StandardCharsets.UTF_8);
    }
}
