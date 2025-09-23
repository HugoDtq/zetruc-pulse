import crypto from "crypto";

const keyB64 = process.env.ENCRYPTION_KEY_BASE64;
if (!keyB64) throw new Error("ENCRYPTION_KEY_BASE64 is required");
const key = Buffer.from(keyB64, "base64");
if (key.length !== 32) throw new Error("ENCRYPTION_KEY_BASE64 must be 32 bytes base64");

export function encrypt(text: string) {
  const iv = crypto.randomBytes(12); // GCM IV 96-bit
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decrypt(ciphertextB64: string, ivB64: string, tagB64: string) {
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}
