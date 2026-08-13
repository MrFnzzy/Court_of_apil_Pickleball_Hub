"use client";

import { useEffect, useState } from "react";

type TrustedDevice = { id: string; label: string; createdAt: string; lastUsedAt: string | null; expiresAt: string };
type Passkey = { id: string; label: string; deviceType: string; createdAt: string; lastUsedAt: string | null };

function formatDate(iso: string | null): string {
  if (!iso) return "Never used";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminSecuritySettings() {
  const [loginEmail, setLoginEmail] = useState("");
  const [emailSaved, setEmailSaved] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [revokingDevice, setRevokingDevice] = useState<string | null>(null);

  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(true);
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [revokingPasskey, setRevokingPasskey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/site-settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setLoginEmail(d.settings.adminLoginEmail || "");
          setEmailSaved(d.settings.adminLoginEmail || "");
        }
      });
    refreshDevices();
    refreshPasskeys();
    import("@simplewebauthn/browser").then(({ browserSupportsWebAuthn }) => {
      setPasskeySupported(browserSupportsWebAuthn());
    });
  }, []);

  function refreshDevices() {
    setDevicesLoading(true);
    fetch("/api/admin/security/trusted-devices")
      .then((r) => r.json())
      .then((d) => setDevices(d.devices || []))
      .finally(() => setDevicesLoading(false));
  }

  function refreshPasskeys() {
    setPasskeysLoading(true);
    fetch("/api/admin/security/passkeys")
      .then((r) => r.json())
      .then((d) => setPasskeys(d.passkeys || []))
      .finally(() => setPasskeysLoading(false));
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailBusy(true);
    setEmailError(null);
    setEmailSuccess(false);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminLoginEmail: loginEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save.");
      setEmailSaved(loginEmail);
      setEmailSuccess(true);
      setTimeout(() => setEmailSuccess(false), 2500);
    } catch (err: any) {
      setEmailError(err.message);
    } finally {
      setEmailBusy(false);
    }
  }

  async function revokeDevice(id: string) {
    setRevokingDevice(id);
    try {
      await fetch("/api/admin/security/trusted-devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setRevokingDevice(null);
    }
  }

  async function addPasskey() {
    setAddingPasskey(true);
    setPasskeyError(null);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");

      const optionsRes = await fetch("/api/admin/security/passkeys/register-options", { method: "POST" });
      const optionsData = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(optionsData.error || "Couldn't start passkey registration.");

      const regResponse = await startRegistration({ optionsJSON: optionsData.options });

      const label = window.prompt("Name this passkey (e.g. \"My iPhone\")", "") || undefined;

      const verifyRes = await fetch("/api/admin/security/passkeys/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: regResponse, label }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "Couldn't save that passkey.");

      refreshPasskeys();
    } catch (err: any) {
      if (err?.name !== "NotAllowedError") {
        setPasskeyError(err.message || "Couldn't add a passkey.");
      }
    } finally {
      setAddingPasskey(false);
    }
  }

  async function revokePasskey(id: string) {
    setRevokingPasskey(id);
    try {
      await fetch("/api/admin/security/passkeys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setRevokingPasskey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-court glass-panel p-5 sm:p-6">
        <h3 className="font-display font-600 text-base text-court-ink mb-0.5">Two-factor email</h3>
        <p className="text-xs text-court-ink/60 mb-4">
          After the password, a 6-digit code is sent to this address before admin sign-in completes. Leave blank to fall back to the account's own sending inbox.
        </p>
        <form onSubmit={saveEmail} className="flex flex-wrap gap-2 items-start">
          <input
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 min-w-[220px] rounded-xl border-2 border-court-ink/15 px-4 py-2.5 text-sm focus:outline-none focus:border-court-blue-dark"
          />
          <button
            type="submit"
            disabled={emailBusy || loginEmail === emailSaved}
            className="rounded-full bg-court-orange text-white px-5 py-2.5 text-sm font-semibold hover:bg-court-orange-dark disabled:opacity-50"
          >
            {emailBusy ? "Saving…" : "Save"}
          </button>
        </form>
        {emailError && <p className="text-xs text-red-600 mt-2">{emailError}</p>}
        {emailSuccess && <p className="text-xs text-emerald-700 mt-2">✅ Saved.</p>}
      </div>

      <div className="rounded-court glass-panel p-5 sm:p-6">
        <h3 className="font-display font-600 text-base text-court-ink mb-0.5">Passkeys</h3>
        <p className="text-xs text-court-ink/60 mb-4">
          Sign in with Face ID, Touch ID, Windows Hello, or a security key — no password or email code needed.
        </p>

        {!passkeySupported && (
          <p className="text-sm text-court-ink/50 italic mb-3">This browser doesn't support passkeys.</p>
        )}

        {passkeySupported && (
          <button
            type="button"
            onClick={addPasskey}
            disabled={addingPasskey}
            className="rounded-full bg-court-orange text-white px-5 py-2.5 text-sm font-semibold hover:bg-court-orange-dark disabled:opacity-50 mb-4"
          >
            {addingPasskey ? "Waiting for your device…" : "+ Add a passkey"}
          </button>
        )}
        {passkeyError && <p className="text-xs text-red-600 mb-3">{passkeyError}</p>}

        {passkeysLoading ? (
          <p className="text-sm text-court-ink/50">Loading…</p>
        ) : passkeys.length === 0 ? (
          <p className="text-sm text-court-ink/50 italic">No passkeys registered yet.</p>
        ) : (
          <ul className="space-y-2">
            {passkeys.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-court-ink/5 px-4 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-court-ink">{p.label}</p>
                  <p className="text-xs text-court-ink/50">
                    Added {formatDate(p.createdAt)} · Last used {formatDate(p.lastUsedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revokePasskey(p.id)}
                  disabled={revokingPasskey === p.id}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 flex-shrink-0"
                >
                  {revokingPasskey === p.id ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-court glass-panel p-5 sm:p-6">
        <h3 className="font-display font-600 text-base text-court-ink mb-0.5">Trusted devices</h3>
        <p className="text-xs text-court-ink/60 mb-4">
          Devices that checked "trust this device" after the email code — they skip straight past it for 30 days. Revoke one to make it require the code again next time.
        </p>

        {devicesLoading ? (
          <p className="text-sm text-court-ink/50">Loading…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-court-ink/50 italic">No trusted devices yet.</p>
        ) : (
          <ul className="space-y-2">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl bg-court-ink/5 px-4 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-court-ink">{d.label || "Device"}</p>
                  <p className="text-xs text-court-ink/50">
                    Trusted {formatDate(d.createdAt)} · Last used {formatDate(d.lastUsedAt)} · Expires {formatDate(d.expiresAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revokeDevice(d.id)}
                  disabled={revokingDevice === d.id}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 flex-shrink-0"
                >
                  {revokingDevice === d.id ? "Revoking…" : "Revoke"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
