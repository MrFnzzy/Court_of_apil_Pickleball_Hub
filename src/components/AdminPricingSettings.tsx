"use client";

import { useEffect, useState } from "react";

type Pricing = {
  weekdayDayPrice: number;
  weekdayNightPrice: number;
  weekendPrice: number;
  rental1Price: number;
  rental2Price: number;
};

const FIELDS: { key: keyof Pricing; label: string; hint: string }[] = [
  { key: "weekdayDayPrice", label: "Weekday day rate", hint: "Mon–Fri, 6:00 AM – 4:59 PM (per hour)" },
  { key: "weekdayNightPrice", label: "Weekday night rate", hint: "Mon–Fri, 5:00 PM – 5:59 AM (per hour)" },
  { key: "weekendPrice", label: "Weekend rate", hint: "Sat & Sun, all hours (per hour)" },
  { key: "rental1Price", label: "1 paddle rental", hint: "1 paddle with 2 balls" },
  { key: "rental2Price", label: "2 paddle rental", hint: "2 paddles with 3 balls" },
];

export default function AdminPricingSettings() {
  const [values, setValues] = useState<Pricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/pricing")
      .then((r) => r.json())
      .then((d) => setValues(d.settings))
      .finally(() => setLoading(false));
  }, []);

  function updateField(key: keyof Pricing, raw: string) {
    if (!values) return;
    setSaved(false);
    const num = raw === "" ? 0 : Number(raw.replace(/[^\d.]/g, ""));
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

  if (loading || !values) {
    return <p className="text-court-ink/50">Loading pricing…</p>;
  }

  return (
    <form onSubmit={handleSave} className="rounded-court bg-white border-2 border-court-orange/30 shadow-court p-5 sm:p-6 max-w-xl">
      <h3 className="font-display font-600 text-lg text-court-ink mb-1">Court & rental pricing</h3>
      <p className="text-sm text-court-ink/60 mb-5">
        Changes apply immediately to new bookings and the live schedule — existing bookings keep their original price.
      </p>

      <div className="space-y-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">{f.label}</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-court-ink/50">₱</span>
              <input
                value={values[f.key]}
                onChange={(e) => updateField(f.key, e.target.value)}
                inputMode="numeric"
                className="w-full rounded-xl border-2 border-court-ink/15 pl-7 pr-3 py-2"
              />
            </div>
            <span className="block mt-1 text-xs text-court-ink/50">{f.hint}</span>
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      {saved && !error && <p className="text-sm text-green-600 mt-4">Pricing updated.</p>}

      <button
        type="submit"
        disabled={saving}
        className="focus-ring mt-5 rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save pricing"}
      </button>
    </form>
  );
}
