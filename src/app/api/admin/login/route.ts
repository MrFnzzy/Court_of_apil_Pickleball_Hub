import { NextRequest, NextResponse } from "next/server";
import { createAdminSession, createOtpChallenge, verifyTrustedDeviceCookie, maskEmail } from "@/lib/auth";
import { sendAdminOtpEmail } from "@/lib/email";
import { resolveAdminLoginEmail } from "@/lib/siteSettings";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Admin password not configured on server." }, { status: 500 });
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  // A device that already completed the email code once (and was told to
  // be trusted) skips straight through — no code needed this time.
  if (await verifyTrustedDeviceCookie()) {
    await createAdminSession();
    return NextResponse.json({ success: true, stage: "done" });
  }

  const email = await resolveAdminLoginEmail();
  if (!email) {
    // No 2FA email configured anywhere (no adminLoginEmail set in Security
    // settings, and no GMAIL_USER to fall back to) — don't lock the admin
    // out of their own dashboard over a missing setting; let the password
    // alone be enough, same as before this feature existed.
    await createAdminSession();
    return NextResponse.json({
      success: true,
      stage: "done",
      warning: "No 2FA email is configured yet — set one from the Security tab to turn this on.",
    });
  }

  const code = await createOtpChallenge(email);
  try {
    await sendAdminOtpEmail(email, code);
  } catch {
    return NextResponse.json({ error: "Couldn't send the verification email. Try again in a moment." }, { status: 500 });
  }

  return NextResponse.json({ success: true, stage: "otp", emailHint: maskEmail(email) });
}
