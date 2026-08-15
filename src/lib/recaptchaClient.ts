"use client";

// Client-side half of the invisible reCAPTCHA v3 check on the booking form
// (see src/lib/recaptcha.ts for server-side verification). If
// NEXT_PUBLIC_RECAPTCHA_SITE_KEY isn't set, getRecaptchaToken() resolves to
// null immediately and the server simply skips verification — so this is
// safe to call unconditionally even before the feature is configured.

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(siteKey: string): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.grecaptcha) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Call on mount so the script (and its little badge) is ready before the
// user ever hits submit — avoids a visible delay at the moment they click.
export function preloadRecaptcha(): void {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) return;
  loadScript(siteKey).catch(() => {});
}

// Resolves to a fresh token scoped to the "submit_booking" action, or null
// if reCAPTCHA isn't configured / fails to load (fail-open — see above).
export async function getRecaptchaToken(): Promise<string | null> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) return null;

  try {
    await loadScript(siteKey);
    return await new Promise<string>((resolve, reject) => {
      window.grecaptcha!.ready(() => {
        window
          .grecaptcha!.execute(siteKey, { action: "submit_booking" })
          .then(resolve)
          .catch(reject);
      });
    });
  } catch {
    return null;
  }
}
