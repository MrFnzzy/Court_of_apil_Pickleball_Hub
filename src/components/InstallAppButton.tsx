"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallAppButton({
  swScope,
  appName,
  accentClassName = "bg-gradient-to-r from-court-orange to-court-orange-dark",
}: {
  /** Route this PWA is scoped to, e.g. "/book" or "/admin" */
  swScope: string;
  appName: string;
  accentClassName?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Register the (shared) service worker, scoped to this app's route so
    // the customer and admin apps install/behave independently.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: swScope }).catch(() => {
        // Non-fatal — the site still works without SW, it just won't be installable.
      });
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent;
    setIsIOS(/iphone|ipad|ipod/i.test(ua));

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, [swScope]);

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIOS) return null; // nothing installable to offer

  async function handleInstallClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSHelp((v) => !v);
    }
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 rounded-2xl border-2 border-court-blue-dark/20 bg-white px-4 py-3 shadow-court">
        <button
          type="button"
          onClick={handleInstallClick}
          className={`focus-ring flex-shrink-0 rounded-full ${accentClassName} text-white px-4 py-2 text-sm font-semibold shadow-court hover:shadow-court-lg transition-all`}
        >
          Install {appName}
        </button>
        <p className="text-xs text-court-ink/60 flex-1">
          Add {appName} to your home screen for one-tap access.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="focus-ring flex-shrink-0 text-court-ink/40 hover:text-court-ink/70 text-lg leading-none px-1"
        >
          &times;
        </button>
      </div>
      {showIOSHelp && (
        <p className="mt-2 text-xs text-court-ink/70 bg-court-blue-light/40 rounded-xl px-3 py-2">
          On iPhone: tap the <strong>Share</strong> icon in Safari, then{" "}
          <strong>Add to Home Screen</strong>.
        </p>
      )}
    </div>
  );
}
