"use client";

import { useEffect, useState } from "react";

type Colors = {
  colorOrange: string;
  colorOrangeDark: string;
  colorOrangeLight: string;
  colorBlue: string;
  colorBlueDark: string;
  colorBlueLight: string;
  colorInk: string;
  colorCream: string;
};

const FIELDS: { key: keyof Colors; label: string; hint: string }[] = [
  { key: "colorOrange", label: "Orange", hint: "Primary accent — buttons, links, highlights" },
  { key: "colorOrangeDark", label: "Orange (dark)", hint: "Hover state for orange buttons" },
  { key: "colorOrangeLight", label: "Orange (light)", hint: "Soft accents, night/weekend rate" },
  { key: "colorBlue", label: "Blue", hint: "Court color, weekday rate" },
  { key: "colorBlueDark", label: "Blue (dark)", hint: "Focus ring, deeper blue accents" },
  { key: "colorBlueLight", label: "Blue (light)", hint: "Soft badge backgrounds" },
  { key: "colorInk", label: "Ink", hint: "Main text color and dark sections" },
  { key: "colorCream", label: "Cream", hint: "Page background" },
];

const HEX_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export default function AdminColors() {
  const [values, setValues] = useState<Colors | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-settings")
      .then((r) => r.json())
      .then((d) =>
        setValues({
          colorOrange: d.settings.colorOrange,
          colorOrangeDark: d.settings.colorOrangeDark,
          colorOrangeLight: d.settings.colorOrangeLight,
          colorBlue: d.settings.colorBlue,
          colorBlueDark: d.settings.colorBlueDark,
          colorBlueLight: d.settings.colorBlueLight,
          colorInk: d.settings.colorInk,
          colorCream: d.settings.colorCream,
        })
      )
      .finally(() => setLoading(false));
  }, []);

  function updateField(key: keyof Colors, value: string) {
    if (!values) return;
    setSaved(false);
    setValues({ ...values, [key]: value });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setError(null);
    setSaved(false);

    for (const f of FIELDS) {
      if (!HEX_PATTERN.test(values[f.key])) {
        setError(`"${values[f.key]}" isn't a valid hex color for ${f.label}. Use a format like #F46036.`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save colors.");
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !values) {
    return <p className="text-court-ink/50">Loading colors…</p>;
  }

  return (
    <form onSubmit={handleSave} className="rounded-court bg-white border-2 border-court-orange/30 shadow-court p-5 sm:p-6 max-w-2xl">
      <h3 className="font-display font-600 text-lg text-court-ink mb-1">Brand colors</h3>
      <p className="text-sm text-court-ink/60 mb-5">
        These colors apply across the entire site — buttons, headings, backgrounds — as soon as you save.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">{f.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={HEX_PATTERN.test(values[f.key]) && values[f.key].length === 7 ? values[f.key] : "#000000"}
                onChange={(e) => updateField(f.key, e.target.value)}
                className="h-10 w-12 rounded-lg border-2 border-court-ink/15 cursor-pointer shrink-0"
              />
              <input
                value={values[f.key]}
                onChange={(e) => updateField(f.key, e.target.value)}
                className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 font-mono text-sm"
              />
            </div>
            <span className="block mt-1 text-xs text-court-ink/50">{f.hint}</span>
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      {saved && !error && <p className="text-sm text-green-600 mt-4">Colors updated across the site.</p>}

      <button
        type="submit"
        disabled={saving}
        className="focus-ring mt-5 rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save colors"}
      </button>
    </form>
  );
}
