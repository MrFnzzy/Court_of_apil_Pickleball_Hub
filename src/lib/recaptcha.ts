// Verifies a Google reCAPTCHA v3 token against Google's siteverify endpoint.
// v3 is invisible (no checkbox, no puzzle) — it just scores how bot-like the
// request looked (0 = definitely a bot, 1 = definitely human) — so it adds
// zero friction for real customers while still blocking scripted spam.
//
// If RECAPTCHA_SECRET_KEY isn't set, verification is skipped and every
// booking passes — this is intentional so local development and any
// deployment that hasn't configured it yet doesn't get blocked outright.
// Set the key (see DEPLOYMENT.md) to actually enforce this.
const MIN_SCORE = 0.5;

export async function verifyRecaptcha(token: string | null | undefined): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return { ok: true };

  if (!token || typeof token !== "string") {
    return { ok: false, reason: "Missing verification token." };
  }

  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();

    if (!data.success) {
      return { ok: false, reason: "Verification failed." };
    }
    // action lets us confirm the token was generated for this specific
    // form (not replayed from somewhere else on the site).
    if (data.action && data.action !== "submit_booking") {
      return { ok: false, reason: "Verification action mismatch." };
    }
    if (typeof data.score === "number" && data.score < MIN_SCORE) {
      return { ok: false, reason: "Verification score too low." };
    }
    return { ok: true };
  } catch {
    // Network hiccup talking to Google shouldn't itself block a genuine
    // customer's booking — fail open rather than closed.
    return { ok: true };
  }
}
