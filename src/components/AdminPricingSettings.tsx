"use client";

import { useEffect, useState } from "react";
import { defaultSeasonalPopupMessage } from "@/lib/pricing";

type Rates = {
  weekdayDayPrice: number;
  weekdayNightPrice: number;
  weekendPrice: number;
};

type Override = Rates & {
  id: string;
  label: string;
  months: number[];
  active: boolean;
  popupMessage: string | null;
};

const RATE_FIELDS: { key: keyof Rates; label: string; hint: string }[] = [
  { key: "weekdayDayPrice", label: "Weekday day rate", hint: "Mon–Fri, 5:00 AM – 4:59 PM (per hour)" },
  { key: "weekdayNightPrice", label: "Weekday night rate", hint: "Mon–Fri, 5:00 PM – 4:59 AM (per hour)" },
  { key: "weekendPrice", label: "Weekend rate", hint: "Sat & Sun, all hours (per hour)" },
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function RateInputs({ values, onChange }: { values: Rates; onChange: (key: keyof Rates, value: number) => void }) {
  return (
    <div className="space-y-4">
      {RATE_FIELDS.map((f) => (
        <label key={f.key} className="block text-sm">
          <span className="block mb-1 font-medium text-court-ink/80">{f.label}</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-court-ink/50">₱</span>
            <input
              value={values[f.key]}
              onChange={(e) => onChange(f.key, e.target.value === "" ? 0 : Number(e.target.value.replace(/[^\d.]/g, "")))}
              inputMode="numeric"
              className="w-full rounded-xl border-2 border-court-ink/15 pl-7 pr-3 py-2"
            />
          </div>
          <span className="block mt-1 text-xs text-court-ink/50">{f.hint}</span>
        </label>
      ))}
    </div>
  );
}

function MonthPicker({ selected, onToggle }: { selected: number[]; onToggle: (month: number) => void }) {
  return (
    <div>
      <span className="block mb-1.5 text-sm font-medium text-court-ink/80">Applies during</span>
      <div className="flex flex-wrap gap-1.5">
        {MONTH_LABELS.map((label, i) => {
          const month = i + 1;
          const active = selected.includes(month);
          return (
            <button
              key={month}
              type="button"
              onClick={() => onToggle(month)}
              className={`focus-ring rounded-full px-3 py-1 text-xs font-semibold border-2 transition-colors ${
                active
                  ? "bg-court-orange text-white border-court-orange"
                  : "bg-white text-court-ink/60 border-court-ink/15 hover:border-court-orange/40"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Lets the admin write the custom text shown in the "rates changed" popup a
// customer sees when they pick a date inside this override's months.
// Leaving it blank falls back to an auto-built default (previewed below the
// textarea) so the admin never has to hand-write a message just to get
// something reasonable on the booking page.
function PopupMessageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const previewLabel = label.trim() || "this override's";
  return (
    <label className="text-xs block">
      <span className="block mb-1 font-medium text-court-ink/70">
        Customer popup message <span className="font-normal text-court-ink/40">(optional)</span>
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={`Dear guest, this date falls outside our soft opening rates. Bookings outside the soft opening period are charged at our regular "${previewLabel}" rates — see below.`}
        className="w-full rounded-lg border-2 border-court-ink/15 px-2.5 py-1.5 text-sm focus-ring resize-y"
      />
      <span className="block mt-1 text-[11px] text-court-ink/45">
        Shown once to a customer when they pick a date in the months above, along with the day/night/weekend rates
        below. Leave blank to use the default message shown as the placeholder above; clearing existing text goes
        back to that default too.
      </span>
    </label>
  );
}

function OverrideCard({ override, onChanged }: { override: Override; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ label: string; months: number[]; rates: Rates; popupMessage: string }>({
    label: override.label,
    months: override.months,
    rates: {
      weekdayDayPrice: override.weekdayDayPrice,
      weekdayNightPrice: override.weekdayNightPrice,
      weekendPrice: override.weekendPrice,
    },
    popupMessage: override.popupMessage ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pricing/seasonal/${override.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update.");
      onChanged();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!draft.label.trim()) {
      setError("Give this override a name.");
      return;
    }
    if (draft.months.length === 0) {
      setError("Pick at least one month.");
      return;
    }
    const ok = await patch({
      label: draft.label,
      months: draft.months,
      ...draft.rates,
      // Empty string clears the custom message server-side, falling back
      // to the auto-built default — see updateSeasonalOverride().
      popupMessage: draft.popupMessage,
    });
    if (ok) setEditing(false);
  }

  async function handleDelete() {
    if (!confirm(`Remove the "${override.label}" pricing override? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pricing/seasonal/${override.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete.");
      onChanged();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  function toggleMonth(month: number) {
    setDraft((d) => ({
      ...d,
      months: d.months.includes(month) ? d.months.filter((m) => m !== month) : [...d.months, month].sort((a, b) => a - b),
    }));
  }

  function cancelEdit() {
    setDraft({
      label: override.label,
      months: override.months,
      rates: {
        weekdayDayPrice: override.weekdayDayPrice,
        weekdayNightPrice: override.weekdayNightPrice,
        weekendPrice: override.weekendPrice,
      },
      popupMessage: override.popupMessage ?? "",
    });
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-xl border-2 border-court-orange/40 bg-white p-4 space-y-3.5">
        <label className="text-xs block">
          <span className="block mb-1 font-medium text-court-ink/70">Name</span>
          <input
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="e.g. Holiday season"
            className="w-full rounded-lg border-2 border-court-ink/15 px-2.5 py-1.5 text-sm focus-ring"
          />
        </label>
        <MonthPicker selected={draft.months} onToggle={toggleMonth} />
        <RateInputs values={draft.rates} onChange={(key, value) => setDraft((d) => ({ ...d, rates: { ...d.rates, [key]: value } }))} />
        <PopupMessageField
          label={draft.label}
          value={draft.popupMessage}
          onChange={(v) => setDraft((d) => ({ ...d, popupMessage: v }))}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="focus-ring rounded-full bg-court-orange text-white px-4 py-1.5 text-xs font-semibold hover:bg-court-orange-dark disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={busy}
            className="focus-ring rounded-full border-2 border-court-ink/15 text-court-ink/70 px-4 py-1.5 text-xs font-semibold hover:border-court-ink/30"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-2 px-4 py-3.5 ${override.active ? "border-court-ink/10" : "border-court-ink/10 opacity-50"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-display font-700 text-sm text-court-ink">{override.label}</p>
          <p className="text-xs text-court-ink/50 mt-0.5">{override.months.map((m) => MONTH_LABELS[m - 1]).join(", ")}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="focus-ring rounded-full px-2.5 py-1 text-xs font-semibold text-court-blue-dark hover:bg-court-blue-light/30"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => patch({ active: !override.active })}
            disabled={busy}
            className={`focus-ring rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
              override.active
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-court-ink/10 text-court-ink/50 hover:bg-court-ink/15"
            }`}
          >
            {override.active ? "Active" : "Off"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            aria-label={`Delete ${override.label}`}
            className="focus-ring rounded-full h-7 w-7 inline-flex items-center justify-center text-court-ink/40 hover:text-red-600 hover:bg-red-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-court-ink/5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-court-ink/45">Day</p>
          <p className="font-display font-700 text-sm text-court-ink">₱{override.weekdayDayPrice}</p>
        </div>
        <div className="rounded-lg bg-court-ink/5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-court-ink/45">Night</p>
          <p className="font-display font-700 text-sm text-court-ink">₱{override.weekdayNightPrice}</p>
        </div>
        <div className="rounded-lg bg-court-ink/5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-court-ink/45">Weekend</p>
          <p className="font-display font-700 text-sm text-court-ink">₱{override.weekendPrice}</p>
        </div>
      </div>
      <p className="mt-2.5 text-[11px] text-court-ink/45">
        {override.popupMessage ? (
          <>Custom popup message: <span className="italic">&ldquo;{override.popupMessage}&rdquo;</span></>
        ) : (
          <>Popup message: default (&ldquo;{defaultSeasonalPopupMessage({ label: override.label })}&rdquo;)</>
        )}
      </p>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

const EMPTY_NEW = {
  label: "",
  months: [] as number[],
  rates: { weekdayDayPrice: 0, weekdayNightPrice: 0, weekendPrice: 0 } as Rates,
  popupMessage: "",
};

export default function AdminPricingSettings() {
  const [values, setValues] = useState<Rates | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [overrides, setOverrides] = useState<Override[] | null>(null);
  const [newOverride, setNewOverride] = useState(EMPTY_NEW);
  const [addingOverride, setAddingOverride] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  function reloadOverrides() {
    fetch("/api/admin/pricing/seasonal")
      .then((r) => r.json())
      .then((d) => setOverrides(d.overrides ?? []));
  }

  useEffect(() => {
    fetch("/api/admin/pricing")
      .then((r) => r.json())
      .then((d) => setValues(d.settings))
      .finally(() => setLoading(false));
    reloadOverrides();
  }, []);

  function updateField(key: keyof Rates, num: number) {
    if (!values) return;
    setSaved(false);
    setValues({ ...values, [key]: num });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save pricing.");
      setValues(data.settings);
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleNewMonth(month: number) {
    setNewOverride((d) => ({
      ...d,
      months: d.months.includes(month) ? d.months.filter((m) => m !== month) : [...d.months, month].sort((a, b) => a - b),
    }));
  }

  async function handleAddOverride(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!newOverride.label.trim()) {
      setAddError("Give this override a name.");
      return;
    }
    if (newOverride.months.length === 0) {
      setAddError("Pick at least one month.");
      return;
    }
    setAddingOverride(true);
    try {
      const res = await fetch("/api/admin/pricing/seasonal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newOverride.label,
          months: newOverride.months,
          ...newOverride.rates,
          popupMessage: newOverride.popupMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add pricing override.");
      setNewOverride(EMPTY_NEW);
      setShowAddForm(false);
      reloadOverrides();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddingOverride(false);
    }
  }

  if (loading || !values) {
    return <p className="text-court-ink/50">Loading pricing…</p>;
  }

  return (
    <div className="space-y-5 max-w-xl">
      {/* ── Main pricing ── */}
      <form onSubmit={handleSave} className="rounded-court glass-panel p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Main pricing</h3>
        <p className="text-sm text-court-ink/60 mb-5">
          The default rates used every month unless a seasonal override below applies. Changes apply immediately to
          new bookings and the live schedule — existing bookings keep their original price. Paddle &amp; ball rental
          pricing is managed separately below.
        </p>

        <RateInputs values={values} onChange={updateField} />

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
        {saved && !error && <p className="text-sm text-green-600 mt-4">Pricing updated.</p>}

        <button
          type="submit"
          disabled={saving}
          className="focus-ring mt-5 rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save main pricing"}
        </button>
      </form>

      {/* ── Seasonal / monthly overrides ── */}
      <div className="rounded-court glass-panel p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Seasonal pricing</h3>
        <p className="text-sm text-court-ink/60 mb-5">
          Set an adjusted rate that automatically takes over during specific months — e.g. a higher rate for
          December, or a discount for a slow season. The main pricing above stays as the fallback for every month
          that isn&apos;t covered here. A customer who picks a date in a covered month sees a one-time popup — with
          this override&apos;s message and rates — so a rate change never surprises them mid-booking.
        </p>

        {overrides === null ? (
          <p className="text-sm text-court-ink/50">Loading…</p>
        ) : overrides.length === 0 && !showAddForm ? (
          <p className="text-sm text-court-ink/50 mb-4">No seasonal pricing set — every month uses the main rates above.</p>
        ) : (
          <div className="space-y-2.5 mb-5">
            {overrides.map((o) => (
              <OverrideCard key={o.id} override={o} onChanged={reloadOverrides} />
            ))}
          </div>
        )}

        {showAddForm ? (
          <form onSubmit={handleAddOverride} className="rounded-xl border-2 border-dashed border-court-ink/15 p-4 space-y-3.5">
            <p className="text-xs font-semibold text-court-ink/70">New seasonal override</p>
            <label className="text-xs block">
              <span className="block mb-1 font-medium text-court-ink/70">Name</span>
              <input
                value={newOverride.label}
                onChange={(e) => setNewOverride({ ...newOverride, label: e.target.value })}
                placeholder="e.g. Holiday season"
                className="w-full rounded-lg border-2 border-court-ink/15 px-2.5 py-1.5 text-sm focus-ring"
              />
            </label>
            <MonthPicker selected={newOverride.months} onToggle={toggleNewMonth} />
            <RateInputs
              values={newOverride.rates}
              onChange={(key, value) => setNewOverride((d) => ({ ...d, rates: { ...d.rates, [key]: value } }))}
            />
            <PopupMessageField
              label={newOverride.label}
              value={newOverride.popupMessage}
              onChange={(v) => setNewOverride((d) => ({ ...d, popupMessage: v }))}
            />
            {addError && <p className="text-xs text-red-600">{addError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={addingOverride}
                className="focus-ring rounded-full bg-court-orange text-white px-4 py-1.5 text-sm font-semibold hover:bg-court-orange-dark disabled:opacity-50"
              >
                {addingOverride ? "Adding…" : "+ Add override"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewOverride(EMPTY_NEW);
                  setAddError(null);
                }}
                disabled={addingOverride}
                className="focus-ring rounded-full border-2 border-court-ink/15 text-court-ink/70 px-4 py-1.5 text-sm font-semibold hover:border-court-ink/30"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="focus-ring rounded-full border-2 border-dashed border-court-ink/20 text-court-ink/60 px-4 py-2 text-sm font-semibold hover:border-court-orange/40 hover:text-court-orange-dark"
          >
            + Add seasonal override
          </button>
        )}
      </div>
    </div>
  );
}
