import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
let cachedKey = null;

const getKey = () => {
  if (cachedKey) return cachedKey;

  const secret = process.env.PAYOUT_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("PAYOUT_ENCRYPTION_KEY is not set — check your .env file");
  }

  cachedKey = crypto.scryptSync(secret, "salt", 32);
  return cachedKey;
};

export const encryptSecret = (plainText) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
};

export const decryptSecret = (payload) => {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
};
