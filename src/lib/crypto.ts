import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

// Password hashing with Node's built-in scrypt — no third-party dep (no bcrypt).
// Stored format: "<saltHex>:<derivedKeyHex>".
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, keyHex] = stored.split(":");
  if (!salt || !keyHex) return false;

  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const storedKey = Buffer.from(keyHex, "hex");

  // Lengths must match before timingSafeEqual, and the compare is constant-time.
  if (storedKey.length !== derived.length) return false;
  return timingSafeEqual(storedKey, derived);
}
