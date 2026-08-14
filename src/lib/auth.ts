import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

const COOKIE_NAME = "coa_admin_session";
const OTP_COOKIE = "coa_admin_otp";
const OTP_RESEND_COOKIE = "coa_admin_otp_sent_at";
const TRUSTED_DEVICE_COOKIE = "coa_trusted_device";

export const secretKey = () =>
  new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET || "dev-only-fallback-secret-change-me");

function cookieOpts(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

// ---------------------------------------------------------------------
// Full admin session — unchanged from before. This is the ONE cookie
// middleware.ts checks; it only ever gets set after the admin has cleared
// password + 2FA (email code, a trusted device, or a passkey).
// ---------------------------------------------------------------------

export async function createAdminSession() {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey());

  cookies().set(COOKIE_NAME, token, cookieOpts(60 * 60 * 12));
}

export async function clearAdminSession() {
  cookies().delete(COOKIE_NAME);
}

export async function isAdminAuthed(): Promise<boolean> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}

export { COOKIE_NAME };

// ---------------------------------------------------------------------
// Email one-time code (second factor). Deliberately stateless — the
// pending code's hash lives only in a short-lived signed cookie, never in
// the database, so there's nothing to clean up and nothing for a DB leak
// to expose.
// ---------------------------------------------------------------------

const OTP_TTL_SECONDS = 10 * 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 30;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Generates a fresh 6-digit code, stores its hash in a signed httpOnly
// cookie, and returns the plaintext so the caller can email it.
export async function createOtpChallenge(email: string): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const token = await new SignJWT({ purpose: "admin-otp", email, codeHash: hashCode(code), attempts: 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${OTP_TTL_SECONDS}s`)
    .sign(secretKey());

  cookies().set(OTP_COOKIE, token, cookieOpts(OTP_TTL_SECONDS));
  cookies().set(OTP_RESEND_COOKIE, String(Date.now()), cookieOpts(OTP_TTL_SECONDS));

  return code;
}

// Seconds remaining before "resend code" is allowed again; 0 means it's
// allowed right now.
export function otpResendCooldownRemaining(): number {
  const sentAt = Number(cookies().get(OTP_RESEND_COOKIE)?.value || 0);
  if (!sentAt) return 0;
  const elapsed = (Date.now() - sentAt) / 1000;
  return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed));
}

export async function pendingOtpEmail(): Promise<string | null> {
  const token = cookies().get(OTP_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export async function verifyOtpChallenge(
  inputCode: string
): Promise<{ ok: true } | { ok: false; error: string; locked?: boolean }> {
  const token = cookies().get(OTP_COOKIE)?.value;
  if (!token) return { ok: false, error: "That code has expired. Request a new one." };

  let payload;
  try {
    ({ payload } = await jwtVerify(token, secretKey()));
  } catch {
    cookies().delete(OTP_COOKIE);
    return { ok: false, error: "That code has expired. Request a new one." };
  }

  const attempts = typeof payload.attempts === "number" ? payload.attempts : 0;
  const codeHash = typeof payload.codeHash === "string" ? payload.codeHash : "";
  const email = typeof payload.email === "string" ? payload.email : "";

  if (attempts >= OTP_MAX_ATTEMPTS) {
    cookies().delete(OTP_COOKIE);
    return { ok: false, error: "Too many incorrect attempts. Request a new code.", locked: true };
  }

  if (!/^\d{6}$/.test(inputCode) || !safeEqualHex(hashCode(inputCode), codeHash)) {
    const nextAttempts = attempts + 1;
    if (nextAttempts >= OTP_MAX_ATTEMPTS) {
      cookies().delete(OTP_COOKIE);
      return { ok: false, error: "Too many incorrect attempts. Request a new code.", locked: true };
    }
    // Re-sign with the attempt count bumped, preserving the original expiry
    // so retrying doesn't quietly extend the window.
    const exp = typeof payload.exp === "number" ? payload.exp : Math.floor(Date.now() / 1000) + OTP_TTL_SECONDS;
    const retoken = await new SignJWT({ purpose: "admin-otp", email, codeHash, attempts: nextAttempts })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(secretKey());
    cookies().set(OTP_COOKIE, retoken, cookieOpts(Math.max(1, exp - Math.floor(Date.now() / 1000))));
    return { ok: false, error: `Incorrect code. ${OTP_MAX_ATTEMPTS - nextAttempts} attempt(s) left.` };
  }

  cookies().delete(OTP_COOKIE);
  cookies().delete(OTP_RESEND_COOKIE);
  return { ok: true };
}

export function clearOtpChallenge() {
  cookies().delete(OTP_COOKIE);
  cookies().delete(OTP_RESEND_COOKIE);
}

// ---------------------------------------------------------------------
// Trusted devices — lets the admin skip the email code on a device
// they've already verified once. Selector/verifier pattern: `selector`
// names the DB row, `verifier` only ever lives in the httpOnly cookie, so
// a DB leak alone can never forge trust.
// ---------------------------------------------------------------------

const TRUSTED_DEVICE_TTL_DAYS = 30;

export async function createTrustedDeviceCookie(label: string) {
  const selector = randomBytes(12).toString("hex");
  const verifier = randomBytes(32).toString("hex");
  const verifierHash = hashCode(verifier);
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.adminTrustedDevice.create({ data: { selector, verifierHash, label, expiresAt } });

  const token = await new SignJWT({ selector, verifier })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TRUSTED_DEVICE_TTL_DAYS}d`)
    .sign(secretKey());

  cookies().set(TRUSTED_DEVICE_COOKIE, token, cookieOpts(TRUSTED_DEVICE_TTL_DAYS * 24 * 60 * 60));
}

// True (and refreshes lastUsedAt) if this browser already carries a valid,
// unexpired, unrevoked trusted-device cookie.
export async function verifyTrustedDeviceCookie(): Promise<boolean> {
  const token = cookies().get(TRUSTED_DEVICE_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const selector = typeof payload.selector === "string" ? payload.selector : "";
    const verifier = typeof payload.verifier === "string" ? payload.verifier : "";
    if (!selector || !verifier) return false;

    const row = await prisma.adminTrustedDevice.findUnique({ where: { selector } });
    if (!row || row.expiresAt < new Date()) return false;
    if (!safeEqualHex(hashCode(verifier), row.verifierHash)) return false;

    await prisma.adminTrustedDevice.update({ where: { selector }, data: { lastUsedAt: new Date() } });
    return true;
  } catch {
    return false;
  }
}

export function clearTrustedDeviceCookie() {
  cookies().delete(TRUSTED_DEVICE_COOKIE);
}

// ---------------------------------------------------------------------
// small shared helpers
// ---------------------------------------------------------------------

export function deviceLabelFromUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (/ipad/i.test(ua)) return "iPad";
  if (/iphone/i.test(ua)) return "iPhone";
  if (/android/i.test(ua)) return "Android device";
  if (/macintosh/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows PC";
  if (/linux/i.test(ua)) return "Linux device";
  return "Browser";
}

// "j***y@g***l.com" — enough for the admin to recognize their own inbox on
// the OTP screen without fully displaying it over someone's shoulder.
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const maskPart = (s: string) => (s.length <= 2 ? s[0] + "*" : s[0] + "*".repeat(Math.max(1, s.length - 2)) + s.slice(-1));
  const domainParts = domain.split(".");
  return `${maskPart(user)}@${maskPart(domainParts[0])}.${domainParts.slice(1).join(".")}`;
}
