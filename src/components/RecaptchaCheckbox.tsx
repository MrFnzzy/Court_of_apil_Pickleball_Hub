"use client";

// Visible "I'm not a robot" reCAPTCHA v2 checkbox for the booking form.
// Unlike the old invisible v3 check (score-based, no user interaction),
// this renders an actual checkbox widget and — if Google's risk analysis
// wants more confidence — automatically follows up with an image puzzle
// challenge. The parent form should keep the submit button disabled until
// onVerify has fired with a token.
//
// Renders nothing (and the parent should treat the form as unprotected,
// same fail-open behavior as before) if NEXT_PUBLIC_RECAPTCHA_SITE_KEY
// isn't configured.

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        container: HTMLElement,
        params: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => number;
      reset: (widgetId?: number) => void;
    };
    onRecaptchaLoaded?: () => void;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.grecaptcha?.render) {
      resolve();
      return;
    }
    window.onRecaptchaLoaded = () => resolve();
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoaded&render=explicit";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function RecaptchaCheckbox({
  onVerify,
  onExpire,
}: {
  onVerify: (token: string | null) => void;
  onExpire?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<number | null>(null);
  const [failedToLoad, setFailedToLoad] = useState(false);

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || widgetId.current !== null) return;
        widgetId.current = window.grecaptcha!.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onVerify(token),
          "expired-callback": () => {
            onVerify(null);
            onExpire?.();
          },
          "error-callback": () => {
            onVerify(null);
            setFailedToLoad(true);
          },
        });
      })
      .catch(() => setFailedToLoad(true));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  // Not configured: nothing to render, parent treats booking as
  // unprotected (same as before this feature existed).
  if (!siteKey) return null;

  return (
    <div className="mt-4">
      <div ref={containerRef} />
      {failedToLoad && (
        <p className="mt-2 text-xs text-red-600">
          Couldn't load the verification check. Please refresh the page and try again.
        </p>
      )}
    </div>
  );
}
