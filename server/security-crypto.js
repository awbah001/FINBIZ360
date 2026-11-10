import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
const header = Buffer.from("FINBIZ1\0");
export function securityKey() {
  const value = process.env.FINBIZ_SECURITY_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new Error(
      "Configure FINBIZ_SECURITY_KEY as 64 hexadecimal characters on the server.",
    );
  return Buffer.from(value, "hex");
}
export const keyConfigured = () =>
  /^[a-f0-9]{64}$/i.test(process.env.FINBIZ_SECURITY_KEY || "");
export function encrypt(data, context) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", securityKey(), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([header, iv, cipher.getAuthTag(), ciphertext]);
}
export function decrypt(data, context) {
  if (data.length < 36 || !data.subarray(0, 8).equals(header))
    throw new Error("Invalid encrypted FinBiz file.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    securityKey(),
    data.subarray(8, 20),
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(data.subarray(20, 36));
  return Buffer.concat([decipher.update(data.subarray(36)), decipher.final()]);
}
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(bytes) {
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let result = "";
  for (let i = 0; i < bits.length; i += 5)
    result += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return result;
}
function fromBase32(value) {
  let bits = "";
  for (const c of value) {
    const n = alphabet.indexOf(c);
    if (n < 0) throw Error("Invalid authenticator secret");
    bits += n.toString(2).padStart(5, "0");
  }
  return Buffer.from((bits.match(/.{8}/g) || []).map((b) => parseInt(b, 2)));
}
export function totp(secret, counter, digits = 6) {
  const time = Buffer.alloc(8);
  time.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac("sha1", fromBase32(secret)).update(time).digest(),
    offset = hash.at(-1) & 15;
  return String(
    (hash.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits,
  ).padStart(digits, "0");
}
export function matchTotp(secret, code, last = -1, now = Date.now()) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  for (const step of [current, current - 1, current + 1])
    if (
      step > last &&
      timingSafeEqual(Buffer.from(totp(secret, step)), Buffer.from(code))
    )
      return step;
  return null;
}
export const recoveryHash = (code) =>
  createHash("sha256").update(String(code).trim().toLowerCase()).digest("hex");
