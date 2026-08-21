"use client";

import { useEffect, useState } from "react";
import { ALL_HOURS, labelForSlot } from "@/lib/pricing";

const OVERNIGHT_PRESET = [1, 2, 3, 4];

export default function AdminOperationsSettings() {
  const [loading, setLoading] = useState(true);

  // Closed hours
  const [closedHours, setClosedHours] = useState<number[]>([]);
  const [savedClosedHours, setSavedClosedHours] = useState<number[]>([]);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);

  // Notification email
  const [notifyEmail, setNotifyEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Blocked months
  const [blockedMonths, setBlockedMonths] = useState<string[]>([]);
  const [savedBlockedMonths, setSavedBlockedMonths] = useState<string[]>([]);
  const [blockedMonthsMessage, setBlockedMonthsMessage] = useState("");
  const [savedBlockedMonthsMessage, setSavedBlockedMonthsMessage] = useState("");
  const [monthInput, setMonthInput] = useState("");
  const [savingBlocked, setSavingBlocked] = useState(false);
  const [blockedSaved, setBlockedSaved] = useState(false);
  const [blockedError, setBlockedError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/site-settings")
      .then((r) => r.json())
      .then((d) => {
        const hrs: number[] = d.settings?.closedHours ?? [];
        setClosedHours(hrs);
        setSavedClosedHours(hrs);
        setNotifyEmail(d.settings?.adminNotificationEmail ?? "");
        const months: string[] = d.settings?.blockedMonths ?? [];
        setBlockedMonths(months);
        setSavedBlockedMonths(months);
        const msg: string = d.settings?.blockedMonthsMessage ?? "";
        setBlockedMonthsMessage(msg);
        setSavedBlockedMonthsMessage(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleHour(hour: number) {
    setHoursSaved(false);
    setClosedHours((prev) => (prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour].sort((a, b) => a - b)));
  }

  const dirty = JSON.stringify(closedHours) !== JSON.stringify(savedClosedHours);

  async function saveClosedHours() {
    setHoursError(null);
    setHoursSaved(false);
    setSavingHours(true);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closedHours }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save hours.");
      const hrs: number[] = data.settings.closedHours;
      setClosedHours(hrs);
      setSavedClosedHours(hrs);
      setHoursSaved(true);
    } catch (err: any) {
      setHoursError(err.message);
    } finally {
      setSavingHours(false);
    }
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailSaved(false);
    setSavingEmail(true);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotificationEmail: notifyEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setNotifyEmail(data.settings.adminNotificationEmail);
      setEmailSaved(true);
    } catch (err: any) {
      setEmailError(err.message);
    } finally {
      setSavingEmail(false);
    }
  }

  function addBlockedMonth() {
    if (!monthInput) return;
    setBlockedSaved(false);
    setBlockedMonths((prev) => (prev.includes(monthInput) ? prev : [...prev, monthInput].sort()));
    setMonthInput("");
  }

  function removeBlockedMonth(month: string) {
    setBlockedSaved(false);
    setBlockedMonths((prev) => prev.filter((m) => m !== month));
  }

  function monthLabel(month: string): string {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  }

  const blockedDirty =
    JSON.stringify(blockedMonths) !== JSON.stringify(savedBlockedMonths) || blockedMonthsMessage !== savedBlockedMonthsMessage;

  async function saveBlockedMonths() {
    setBlockedError(null);
    setBlockedSaved(false);
    setSavingBlocked(true);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockedMonths, blockedMonthsMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save blocked months.");
      setBlockedMonths(data.settings.blockedMonths);
      setSavedBlockedMonths(data.settings.blockedMonths);
      setBlockedMonthsMessage(data.settings.blockedMonthsMessage);
      setSavedBlockedMonthsMessage(data.settings.blockedMonthsMessage);
      setBlockedSaved(true);
    } catch (err: any) {
      setBlockedError(err.message);
    } finally {
      setSavingBlocked(false);
    }
  }

  if (loading) {
    return <p className="text-court-ink/50">Loading…</p>;
  }

  const isOvernightPreset =
    closedHours.length === OVERNIGHT_PRESET.length && OVERNIGHT_PRESET.every((h) => closedHours.includes(h));

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Closed hours */}
      <div className="rounded-court glass-panel p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Closed hours</h3>
        <p className="text-sm text-court-ink/60 mb-4">
          Hours you mark closed here are hidden from booking on <strong>every day</strong> — customers just see them as
          unavailable, with no mention that an admin can reopen them. Tap an hour below to close or reopen it, then save.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => {
              setHoursSaved(false);
              setClosedHours(OVERNIGHT_PRESET);
            }}
            className={`focus-ring rounded-full px-3 py-1.5 text-xs font-semibold border-2 transition-colors ${
              isOvernightPreset
                ? "bg-court-orange text-white border-court-orange"
                : "bg-white text-court-ink/70 border-court-ink/15 hover:border-court-orange"
            }`}
          >
            1:00 AM – 5:00 AM (overnight)
          </button>
          <button
            type="button"
            onClick={() => {
              setHoursSaved(false);
              setClosedHours([]);
            }}
            disabled={closedHours.length === 0}
            className="focus-ring rounded-full px-3 py-1.5 text-xs font-semibold border-2 bg-white text-court-ink/70 border-court-ink/15 hover:border-court-orange disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Open all hours
          </button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {ALL_HOURS.map((hour) => {
            const isClosed = closedHours.includes(hour);
            return (
              <button
                key={hour}
                type="button"
                onClick={() => toggleHour(hour)}
                className={`focus-ring rounded-xl border-2 px-2 py-2.5 text-xs font-semibold transition-all ${
                  isClosed
                    ? "border-dashed border-court-orange-dark/50 bg-court-orange/10 text-court-orange-dark"
                    : "border-court-blue-dark/25 bg-white text-court-ink/70 hover:border-court-orange"
                }`}
              >
                {labelForSlot(hour)}
                <span className="block text-[10px] font-medium mt-0.5 uppercase tracking-wide opacity-70">
                  {isClosed ? "Closed" : "Open"}
                </span>
              </button>
            );
          })}
        </div>

        {hoursError && <p className="text-sm text-red-600 mt-4">{hoursError}</p>}
        {hoursSaved && !dirty && !hoursError && <p className="text-sm text-green-600 mt-4">Hours updated.</p>}

        <button
          type="button"
          onClick={saveClosedHours}
          disabled={savingHours || !dirty}
          className="focus-ring mt-5 rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
        >
          {savingHours ? "Saving…" : dirty ? "Save closed hours" : "Saved"}
        </button>
      </div>

      {/* Blocked months */}
      <div className="rounded-court glass-panel p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Blocked months</h3>
        <p className="text-sm text-court-ink/60 mb-4">
          Close off entire calendar months — e.g. for a renovation or off-season — without touching your daily closed
          hours above. While a month is blocked, customers who land on any date inside it see your message below
          instead of the schedule; nothing about existing bookings changes, and you can still manage the month from
          the admin dashboard as normal.
        </p>

        <div className="flex flex-wrap items-end gap-2 mb-4">
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Add a month</span>
            <input
              type="month"
              value={monthInput}
              onChange={(e) => setMonthInput(e.target.value)}
              className="rounded-xl border-2 border-court-ink/15 px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={addBlockedMonth}
            disabled={!monthInput}
            className="focus-ring rounded-full border-2 border-court-orange text-court-orange-dark px-4 py-2 text-sm font-semibold hover:bg-court-orange/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Block month
          </button>
        </div>

        {blockedMonths.length === 0 ? (
          <p className="text-sm text-court-ink/40 italic mb-5">No months blocked — every month within the booking window is open.</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-5">
            {blockedMonths.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-court-orange-dark/40 bg-court-orange/10 text-court-orange-dark px-3 py-1.5 text-sm font-semibold"
              >
                {monthLabel(m)}
                <button
                  type="button"
                  onClick={() => removeBlockedMonth(m)}
                  aria-label={`Unblock ${monthLabel(m)}`}
                  className="focus-ring rounded-full hover:bg-court-orange-dark/20 leading-none w-4 h-4 flex items-center justify-center"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <label className="text-sm block">
          <span className="block mb-1 font-medium text-court-ink/80">Message shown to customers</span>
          <textarea
            value={blockedMonthsMessage}
            onChange={(e) => {
              setBlockedMonthsMessage(e.target.value);
              setBlockedSaved(false);
            }}
            rows={3}
            className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 resize-y"
          />
          <span className="block mt-1 text-xs text-court-ink/40">
            Shown in place of the schedule whenever a customer lands on a date inside a blocked month — make it fun!
          </span>
        </label>

        {blockedError && <p className="text-sm text-red-600 mt-4">{blockedError}</p>}
        {blockedSaved && !blockedDirty && !blockedError && <p className="text-sm text-green-600 mt-4">Blocked months updated.</p>}

        <button
          type="button"
          onClick={saveBlockedMonths}
          disabled={savingBlocked || !blockedDirty}
          className="focus-ring mt-5 rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
        >
          {savingBlocked ? "Saving…" : blockedDirty ? "Save blocked months" : "Saved"}
        </button>
      </div>

      {/* Manual booking notifications */}
      <form onSubmit={saveEmail} className="rounded-court glass-panel p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Manual booking alerts</h3>
        <p className="text-sm text-court-ink/60 mb-4">
          Whenever you add a manual (walk-in / phone-in) booking from the dashboard, we&apos;ll email a copy of the
          details to this address. Leave blank to use the account&apos;s default sending email.
        </p>
        <label className="text-sm block">
          <span className="block mb-1 font-medium text-court-ink/80">Notification email</span>
          <input
            type="email"
            value={notifyEmail}
            onChange={(e) => {
              setNotifyEmail(e.target.value);
              setEmailSaved(false);
            }}
            placeholder="you@example.com"
            className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2"
          />
        </label>

        {emailError && <p className="text-sm text-red-600 mt-3">{emailError}</p>}
        {emailSaved && !emailError && <p className="text-sm text-green-600 mt-3">Saved.</p>}

        <button
          type="submit"
          disabled={savingEmail}
          className="focus-ring mt-4 rounded-full bg-court-blue-dark text-white px-6 py-2.5 font-semibold hover:brightness-95 disabled:opacity-50"
        >
          {savingEmail ? "Saving…" : "Save email"}
        </button>
      </form>
    </div>
  );
}
