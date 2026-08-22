// Verifies a Google reCAPTCHA v2 ("I'm not a robot" checkbox, with an
// image-puzzle challenge as a fallback when Google's risk analysis wants
// more confidence) token against Google's siteverify endpoint.
//
// If RECAPTCHA_SECRET_KEY isn't set, verification is skipped and every
// booking passes — this is intentional so local development and any
// deployment that hasn't configured it yet doesn't get blocked outright.
// Set the key (see DEPLOYMENT.md) to actually enforce this.
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
    return { ok: true };
  } catch {
    // Network hiccup talking to Google shouldn't itself block a genuine
    // customer's booking — fail open rather than closed.
    return { ok: true };
  }
}
