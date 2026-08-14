import { NextResponse } from "next/server";
import { createOtpChallenge, otpResendCooldownRemaining, pendingOtpEmail, maskEmail } from "@/lib/auth";
import { sendAdminOtpEmail } from "@/lib/email";

export async function POST() {
  // Only resendable while there's actually a pending login (i.e. the
  // password step already succeeded) — otherwise this would let anyone
  // trigger an email send without a password.
  const email = await pendingOtpEmail();
  if (!email) {
    return NextResponse.json({ error: "No sign-in in progress. Enter your password again." }, { status: 400 });
  }

  const cooldown = otpResendCooldownRemaining();
  if (cooldown > 0) {
    return NextResponse.json({ error: `Please wait ${cooldown}s before requesting another code.` }, { status: 429 });
  }

  const code = await createOtpChallenge(email);
  try {
    await sendAdminOtpEmail(email, code);
  } catch {
    return NextResponse.json({ error: "Couldn't send the verification email. Try again in a moment." }, { status: 500 });
  }

  return NextResponse.json({ success: true, emailHint: maskEmail(email) });
}
