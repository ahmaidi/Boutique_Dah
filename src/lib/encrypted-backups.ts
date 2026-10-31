import { z } from "zod";
import { MAX_BACKUP_BYTES, parseBackup } from "./backups";

export const MAX_BACKUP_FILE_BYTES = 32 * 1024 * 1024;
const envelope = z.object({
  format: z.literal("boutique-dah-encrypted-backup"),
  version: z.literal(1),
  kdf: z.literal("PBKDF2-SHA256"),
  iterations: z.literal(210000),
  salt: z.string().max(24),
  iv: z.string().max(16),
  ciphertext: z.string().max(Math.ceil((MAX_BACKUP_BYTES + 16) / 3) * 4),
});
export function isEncryptedBackup(text: string) {
  try {
    return JSON.parse(text)?.format === "boutique-dah-encrypted-backup";
  } catch {
    return false;
  }
}
function decode(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw new Error("Invalid encoding");
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}
export async function decryptBackup(text: string, password: string) {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_FILE_BYTES)
    throw new Error("ملف النسخة أكبر من الحد المسموح");
  const parsed = envelope.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("صيغة النسخة المشفرة غير مدعومة");
  const value = parsed.data;
  let plaintext: ArrayBuffer;
  try {
    const salt = decode(value.salt), iv = decode(value.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error("Invalid parameters");
    const material = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"],
    );
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: value.iterations },
      material, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
    );
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode("boutique-dah-encrypted-backup:v1") },
      key, decode(value.ciphertext),
    );
  } catch {
    throw new Error("كلمة المرور غير صحيحة أو ملف النسخة تالف");
  }
  return parseBackup(new TextDecoder("utf-8", { fatal: true }).decode(plaintext));
}
