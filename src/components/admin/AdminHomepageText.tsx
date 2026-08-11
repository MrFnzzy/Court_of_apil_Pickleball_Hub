"use client";

import { useEffect, useState } from "react";

type TextFields = {
  heroBadgeText: string;
  heroHeadlineLine1: string;
  heroHeadlineLine2: string;
  heroSubtext: string;
  heroPrimaryButtonText: string;
  heroSecondaryButtonText: string;
  heroCardTitle: string;
  heroCardSubtitle: string;
  aboutHeading: string;
  aboutText: string;
  aboutBullets: string;
  footerTagline: string;
  footerLocationText: string;
  footerMapUrl: string;
  footerHoursText: string;
};

export default function AdminHomepageText() {
  const [values, setValues] = useState<TextFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-settings")
      .then((r) => r.json())
      .then((d) => {
        const s = d.settings;
        setValues({
          heroBadgeText: s.heroBadgeText,
          heroHeadlineLine1: s.heroHeadlineLine1,
          heroHeadlineLine2: s.heroHeadlineLine2,
          heroSubtext: s.heroSubtext,
          heroPrimaryButtonText: s.heroPrimaryButtonText,
          heroSecondaryButtonText: s.heroSecondaryButtonText,
          heroCardTitle: s.heroCardTitle,
          heroCardSubtitle: s.heroCardSubtitle,
          aboutHeading: s.aboutHeading,
          aboutText: s.aboutText,
          aboutBullets: s.aboutBullets,
          footerTagline: s.footerTagline,
          footerLocationText: s.footerLocationText,
          footerMapUrl: s.footerMapUrl,
          footerHoursText: s.footerHoursText,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  function updateField(key: keyof TextFields, value: string) {
    if (!values) return;
    setSaved(false);
    setValues({ ...values, [key]: value });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !values) {
    return <p className="text-court-ink/50">Loading homepage text…</p>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div className="rounded-court bg-white border-2 border-court-orange/30 shadow-court p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-4">Hero section</h3>
        <div className="space-y-4">
          <TextField label="Badge text" value={values.heroBadgeText} onChange={(v) => updateField("heroBadgeText", v)} />
          <div className="grid sm:grid-cols-2 gap-4">
            <TextField label="Headline — line 1" value={values.heroHeadlineLine1} onChange={(v) => updateField("heroHeadlineLine1", v)} />
            <TextField label="Headline — line 2 (accent color)" value={values.heroHeadlineLine2} onChange={(v) => updateField("heroHeadlineLine2", v)} />
          </div>
          <TextArea label="Subtext" value={values.heroSubtext} onChange={(v) => updateField("heroSubtext", v)} rows={3} />
          <div className="grid sm:grid-cols-2 gap-4">
            <TextField label="Primary button text" value={values.heroPrimaryButtonText} onChange={(v) => updateField("heroPrimaryButtonText", v)} />
            <TextField label="Secondary button text" value={values.heroSecondaryButtonText} onChange={(v) => updateField("heroSecondaryButtonText", v)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <TextField label="Floating card title" value={values.heroCardTitle} onChange={(v) => updateField("heroCardTitle", v)} />
            <TextField label="Floating card subtitle" value={values.heroCardSubtitle} onChange={(v) => updateField("heroCardSubtitle", v)} />
          </div>
        </div>
      </div>

      <div className="rounded-court bg-white border-2 border-court-orange/30 shadow-court p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-4">About section</h3>
        <div className="space-y-4">
          <TextField label="Heading" value={values.aboutHeading} onChange={(v) => updateField("aboutHeading", v)} />
          <TextArea label="Body text" value={values.aboutText} onChange={(v) => updateField("aboutText", v)} rows={4} />
          <TextArea
            label="Bullet points (one per line)"
            value={values.aboutBullets}
            onChange={(v) => updateField("aboutBullets", v)}
            rows={4}
          />
        </div>
      </div>

      <div className="rounded-court bg-white border-2 border-court-orange/30 shadow-court p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-4">Footer</h3>
        <div className="space-y-4">
          <TextArea label="Tagline" value={values.footerTagline} onChange={(v) => updateField("footerTagline", v)} rows={3} />
          <TextField label="Location text" value={values.footerLocationText} onChange={(v) => updateField("footerLocationText", v)} />
          <TextField label="Google Maps link" value={values.footerMapUrl} onChange={(v) => updateField("footerMapUrl", v)} />
          <TextField label="Hours text" value={values.footerHoursText} onChange={(v) => updateField("footerHoursText", v)} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-green-600">Homepage text updated.</p>}

      <button
        type="submit"
        disabled={saving}
        className="focus-ring rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save homepage text"}
      </button>
    </form>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 font-medium text-court-ink/80">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2" />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 font-medium text-court-ink/80">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2"
      />
    </label>
  );
}
