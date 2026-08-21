"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PaddleIcon from "@/components/icons/PaddleIcon";

type Step = "password" | "otp";

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);
  const [emailHint, setEmailHint] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Passkeys need both browser WebAuthn support and, ideally, a platform
    // authenticator (Face ID / Touch ID / Windows Hello) — but a security
    // key works even without one, so only gate on the base API existing.
    import("@simplewebauthn/browser").then(({ browserSupportsWebAuthn }) => {
      setPasskeySupported(browserSupportsWebAuthn());
    });
  }, []);

  useEffect(() => {
    if (step === "otp") codeInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed.");

      if (data.stage === "otp") {
        setEmailHint(data.emailHint || "");
        setResendCooldown(30);
        setStep("otp");
      } else if (data.warning) {
        // Give the admin a moment to actually read why 2FA didn't kick in
        // before whisking them off to the dashboard.
        setWarning(data.warning);
        setTimeout(() => {
          router.push("/admin");
          router.refresh();
        }, 2500);
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, trustDevice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed.");
      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    try {
      const res = await fetch("/api/admin/login/otp/resend", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't resend the code.");
      setEmailHint(data.emailHint || emailHint);
      setResendCooldown(30);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handlePasskeyLogin() {
    setPasskeyBusy(true);
    setError(null);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");

      const optionsRes = await fetch("/api/admin/passkey/login-options", { method: "POST" });
      const optionsData = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(optionsData.error || "No passkey is set up yet.");

      const authResponse = await startAuthentication({ optionsJSON: optionsData.options });

      const verifyRes = await fetch("/api/admin/passkey/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: authResponse }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "Couldn't verify that passkey.");

      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      // A cancelled/dismissed browser prompt isn't a real error worth
      // showing — just quietly let them try something else.
      if (err?.name !== "NotAllowedError") {
        setError(err.message || "Passkey sign-in failed.");
      }
    } finally {
      setPasskeyBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-court-blue-light/45 via-court-cream to-court-orange-light/25 px-4">
      <div className="w-full max-w-sm rounded-court glass-panel p-8">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-court-orange text-white">
            <PaddleIcon className="h-5 w-5" />
          </span>
          <span className="font-display font-700 text-lg text-court-ink">Court manager</span>
        </div>

        {step === "password" && (
          <form onSubmit={handlePasswordSubmit}>
            <label className="block text-sm mb-4">
              <span className="block mb-1 font-medium text-court-ink/80">Admin password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border-2 border-court-ink/15 px-4 py-2.5 focus:outline-none focus:border-court-blue-dark"
                required
                autoFocus
              />
            </label>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-court-orange text-white py-3 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

            {passkeySupported && (
              <>
                <div className="flex items-center gap-3 my-4">
                  <div className="h-px flex-1 bg-court-ink/10" />
                  <span className="text-xs text-court-ink/40 font-medium">or</span>
                  <div className="h-px flex-1 bg-court-ink/10" />
                </div>
                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={passkeyBusy}
                  className="w-full rounded-full border-2 border-court-ink/15 text-court-ink py-3 font-semibold hover:bg-court-ink/5 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span aria-hidden="true">🔑</span> {passkeyBusy ? "Waiting for your device…" : "Sign in with a passkey"}
                </button>
              </>
            )}
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleOtpSubmit}>
            <p className="text-sm text-court-ink/70 mb-4 text-center">
              Enter the 6-digit code sent to <span className="font-semibold text-court-ink">{emailHint}</span>.
            </p>
            <label className="block text-sm mb-3">
              <span className="sr-only">Verification code</span>
              <input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-xl border-2 border-court-ink/15 px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-court-blue-dark"
                required
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-court-ink/70 mb-4">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                className="h-4 w-4 rounded border-court-ink/30"
              />
              Trust this device for 30 days
            </label>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full rounded-full bg-court-orange text-white py-3 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify & sign in"}
            </button>
            <div className="flex items-center justify-between mt-4 text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("password");
                  setCode("");
                  setError(null);
                }}
                className="text-court-ink/50 hover:text-court-ink/80"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-court-blue-dark font-medium disabled:opacity-40"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        {warning && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-4">{warning}</p>}
      </div>
    </main>
  );
}
