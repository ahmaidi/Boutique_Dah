import { test } from "node:test";
import assert from "node:assert/strict";
import { pbkdf2Sync, createCipheriv } from "node:crypto";
import { decryptBackup, isEncryptedBackup } from "../src/lib/encrypted-backups";
import { makeBackup } from "../src/lib/backups";
import { emptyStore } from "../src/lib/empty-store";

const password = "كلمة-مرور-آمنة-123";
function encrypted() {
  const backup = makeBackup(emptyStore());
  const salt = Buffer.from("000102030405060708090a0b0c0d0e0f", "hex");
  const iv = Buffer.from("101112131415161718191a1b", "hex");
  const key = pbkdf2Sync(password, salt, 210000, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("boutique-dah-encrypted-backup:v1"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(backup)), cipher.final(), cipher.getAuthTag()]);
  const envelope = { format: "boutique-dah-encrypted-backup", version: 1, kdf: "PBKDF2-SHA256", iterations: 210000,
    salt: salt.toString("base64"), iv: iv.toString("base64"), ciphertext: ciphertext.toString("base64") };
  return { backup, envelope };
}
test("password-encrypted backup restores all records using portable Web Crypto", async () => {
  const { backup, envelope } = encrypted();
  assert.equal(isEncryptedBackup(JSON.stringify(envelope)), true);
  assert.deepEqual(await decryptBackup(JSON.stringify(envelope), password), backup);
});
test("wrong password, tampering and unbounded key-derivation parameters are rejected", async () => {
  const { envelope } = encrypted();
  await assert.rejects(decryptBackup(JSON.stringify(envelope), "wrong-password"), /غير صحيحة/);
  const altered = Buffer.from(envelope.ciphertext, "base64"); altered[0] ^= 1;
  await assert.rejects(decryptBackup(JSON.stringify({ ...envelope, ciphertext: altered.toString("base64") }), password), /تالف/);
  await assert.rejects(decryptBackup(JSON.stringify({ ...envelope, iterations: 999999999 }), password), /غير مدعومة/);
});
