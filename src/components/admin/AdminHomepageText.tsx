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

  navScheduleLabel: string;
  navPricingLabel: string;
  navFaqLabel: string;
  navTrackLabel: string;
  navBookNowLabel: string;

  tickerItems: string;

  reservationPreviewEyebrow: string;
  reservationPreviewHeading: string;
  reservationPreviewSubtext: string;

  aboutHeading: string;
  aboutText: string;
  aboutBullets: string;
  locationHeading: string;

  rallyEyebrow: string;
  rallyHeading: string;
  rallyText: string;
  rallyReadyText: string;
  statCard1Value: string;
  statCard1Label: string;
  statCard1Desc: string;
  statCard2Value: string;
  statCard2Label: string;
  statCard2Desc: string;
  statCard3Value: string;
  statCard3Label: string;
  statCard3Desc: string;

  paddleSectionHeading: string;
  rentalNoteText: string;
  ballSectionHeading: string;
  courtRatesHeading: string;
  weekdayDayLabel: string;
  weekdayDayTime: string;
  weekdayNightLabel: string;
  weekdayNightTime: string;
  weekendLabel: string;
  weekendTime: string;

  scheduleSectionHeading: string;
  scheduleBookLinkText: string;

  faqBadgeText: string;
  faqHeading: string;
  faqSubtext: string;
  askAiTitle: string;
  askAiSubtitle: string;

  footerTagline: string;
  footerLocationText: string;
  footerMapUrl: string;
  footerHoursText: string;
};

// Every key in TextFields, so the fetch below always grabs exactly what
// this form needs (and nothing breaks silently if a field gets renamed).
const FIELD_KEYS: (keyof TextFields)[] = [
  "heroBadgeText", "heroHeadlineLine1", "heroHeadlineLine2", "heroSubtext",
  "heroPrimaryButtonText", "heroSecondaryButtonText", "heroCardTitle", "heroCardSubtitle",
  "navScheduleLabel", "navPricingLabel", "navFaqLabel", "navTrackLabel", "navBookNowLabel",
  "tickerItems",
  "reservationPreviewEyebrow", "reservationPreviewHeading", "reservationPreviewSubtext",
  "aboutHeading", "aboutText", "aboutBullets", "locationHeading",
  "rallyEyebrow", "rallyHeading", "rallyText", "rallyReadyText",
  "statCard1Value", "statCard1Label", "statCard1Desc",
  "statCard2Value", "statCard2Label", "statCard2Desc",
  "statCard3Value", "statCard3Label", "statCard3Desc",
  "paddleSectionHeading", "rentalNoteText", "ballSectionHeading", "courtRatesHeading",
  "weekdayDayLabel", "weekdayDayTime", "weekdayNightLabel", "weekdayNightTime", "weekendLabel", "weekendTime",
  "scheduleSectionHeading", "scheduleBookLinkText",
  "faqBadgeText", "faqHeading", "faqSubtext", "askAiTitle", "askAiSubtitle",
  "footerTagline", "footerLocationText", "footerMapUrl", "footerHoursText",
];

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
        const next = {} as TextFields;
        for (const key of FIELD_KEYS) (next as any)[key] = s[key] ?? "";
        setValues(next);
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
      <p className="text-sm text-court-ink/60 -mt-2">
        Every section below controls text that&apos;s currently live on the homepage — changes save immediately to
        everyone once you hit &quot;Save homepage text,&quot; no redeploy needed.
      </p>

      <Section title="Navigation bar">
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label={'"Schedule" link'} value={values.navScheduleLabel} onChange={(v) => updateField("navScheduleLabel", v)} />
          <TextField label={'"Pricing" link'} value={values.navPricingLabel} onChange={(v) => updateField("navPricingLabel", v)} />
          <TextField label={'"FAQ" link'} value={values.navFaqLabel} onChange={(v) => updateField("navFaqLabel", v)} />
          <TextField label={'"Track booking" link'} value={values.navTrackLabel} onChange={(v) => updateField("navTrackLabel", v)} />
          <TextField label={'"Book Now" button'} value={values.navBookNowLabel} onChange={(v) => updateField("navBookNowLabel", v)} />
        </div>
      </Section>

      <Section title="Hero section">
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
      </Section>

      <Section title="Highlight ticker" hint="The scrolling strip of phrases just under the hero. One phrase per line.">
        <TextArea label="Ticker phrases" value={values.tickerItems} onChange={(v) => updateField("tickerItems", v)} rows={4} />
      </Section>

      <Section title={'"Pick your court time" preview'}>
        <TextField label="Eyebrow" value={values.reservationPreviewEyebrow} onChange={(v) => updateField("reservationPreviewEyebrow", v)} />
        <TextField label="Heading" value={values.reservationPreviewHeading} onChange={(v) => updateField("reservationPreviewHeading", v)} />
        <TextArea label="Subtext" value={values.reservationPreviewSubtext} onChange={(v) => updateField("reservationPreviewSubtext", v)} rows={2} />
      </Section>

      <Section title="About section">
        <TextField label="Heading" value={values.aboutHeading} onChange={(v) => updateField("aboutHeading", v)} />
        <TextArea label="Body text" value={values.aboutText} onChange={(v) => updateField("aboutText", v)} rows={4} />
        <TextArea label="Bullet points (one per line)" value={values.aboutBullets} onChange={(v) => updateField("aboutBullets", v)} rows={4} />
        <TextField label={'"Location" sub-heading'} value={values.locationHeading} onChange={(v) => updateField("locationHeading", v)} />
      </Section>

      <Section title={'"Rally rhythm" feature section'}>
        <TextField label="Eyebrow" value={values.rallyEyebrow} onChange={(v) => updateField("rallyEyebrow", v)} />
        <TextField label="Heading" value={values.rallyHeading} onChange={(v) => updateField("rallyHeading", v)} />
        <TextArea label="Body text" value={values.rallyText} onChange={(v) => updateField("rallyText", v)} rows={2} />
        <TextField label={'"Ready when you are" line'} value={values.rallyReadyText} onChange={(v) => updateField("rallyReadyText", v)} />

        <div className="grid sm:grid-cols-3 gap-4 pt-2 border-t border-court-ink/10">
          <StatCardFields
            title="Stat card 1"
            value={values.statCard1Value} label={values.statCard1Label} desc={values.statCard1Desc}
            onValue={(v) => updateField("statCard1Value", v)}
            onLabel={(v) => updateField("statCard1Label", v)}
            onDesc={(v) => updateField("statCard1Desc", v)}
          />
          <StatCardFields
            title="Stat card 2"
            value={values.statCard2Value} label={values.statCard2Label} desc={values.statCard2Desc}
            onValue={(v) => updateField("statCard2Value", v)}
            onLabel={(v) => updateField("statCard2Label", v)}
            onDesc={(v) => updateField("statCard2Desc", v)}
          />
          <StatCardFields
            title="Stat card 3"
            value={values.statCard3Value} label={values.statCard3Label} desc={values.statCard3Desc}
            onValue={(v) => updateField("statCard3Value", v)}
            onLabel={(v) => updateField("statCard3Label", v)}
            onDesc={(v) => updateField("statCard3Desc", v)}
          />
        </div>
      </Section>

      <Section title="Rentals & court rates">
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Paddle section heading" value={values.paddleSectionHeading} onChange={(v) => updateField("paddleSectionHeading", v)} />
          <TextField label="Ball section heading" value={values.ballSectionHeading} onChange={(v) => updateField("ballSectionHeading", v)} />
        </div>
        <TextField label="Rental note (under paddle prices)" value={values.rentalNoteText} onChange={(v) => updateField("rentalNoteText", v)} />
        <TextField label="Court rates heading" value={values.courtRatesHeading} onChange={(v) => updateField("courtRatesHeading", v)} />

        <div className="grid sm:grid-cols-3 gap-4 pt-2 border-t border-court-ink/10">
          <div className="space-y-2">
            <TextField label="Weekday day — label" value={values.weekdayDayLabel} onChange={(v) => updateField("weekdayDayLabel", v)} />
            <TextField label="Weekday day — time range" value={values.weekdayDayTime} onChange={(v) => updateField("weekdayDayTime", v)} />
          </div>
          <div className="space-y-2">
            <TextField label="Weekday night — label" value={values.weekdayNightLabel} onChange={(v) => updateField("weekdayNightLabel", v)} />
            <TextField label="Weekday night — time range" value={values.weekdayNightTime} onChange={(v) => updateField("weekdayNightTime", v)} />
          </div>
          <div className="space-y-2">
            <TextField label="Weekends — label" value={values.weekendLabel} onChange={(v) => updateField("weekendLabel", v)} />
            <TextField label="Weekends — time range" value={values.weekendTime} onChange={(v) => updateField("weekendTime", v)} />
          </div>
        </div>
        <p className="text-xs text-court-ink/50">
          These are display labels only — the actual per-hour rate boundaries (and the ₱ amounts) are set in the
          Pricing tab. Keep these in sync with whatever you set there so the homepage doesn&apos;t show a time
          range that doesn&apos;t match what customers are actually charged.
        </p>
      </Section>

      <Section title="Schedule section">
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Heading" value={values.scheduleSectionHeading} onChange={(v) => updateField("scheduleSectionHeading", v)} />
          <TextField label={'"Book a slot" link text'} value={values.scheduleBookLinkText} onChange={(v) => updateField("scheduleBookLinkText", v)} />
        </div>
      </Section>

      <Section title="FAQ section & Ask AI widget">
        <TextField label={'Badge ("Got questions?")'} value={values.faqBadgeText} onChange={(v) => updateField("faqBadgeText", v)} />
        <TextField label="Heading" value={values.faqHeading} onChange={(v) => updateField("faqHeading", v)} />
        <TextArea label="Subtext" value={values.faqSubtext} onChange={(v) => updateField("faqSubtext", v)} rows={2} />
        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-court-ink/10">
          <TextField label="Ask AI — title" value={values.askAiTitle} onChange={(v) => updateField("askAiTitle", v)} />
          <TextField label="Ask AI — subtitle" value={values.askAiSubtitle} onChange={(v) => updateField("askAiSubtitle", v)} />
        </div>
      </Section>

      <Section title="Footer">
        <TextArea label="Tagline" value={values.footerTagline} onChange={(v) => updateField("footerTagline", v)} rows={3} />
        <TextField label="Location text" value={values.footerLocationText} onChange={(v) => updateField("footerLocationText", v)} />
        <TextField label="Google Maps link" value={values.footerMapUrl} onChange={(v) => updateField("footerMapUrl", v)} />
        <TextField label="Hours text" value={values.footerHoursText} onChange={(v) => updateField("footerHoursText", v)} />
      </Section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-green-600">Homepage text updated.</p>}

      <button
        type="submit"
        disabled={saving}
        className="focus-ring rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50 sticky bottom-4 shadow-lg"
      >
        {saving ? "Saving…" : "Save homepage text"}
      </button>
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-court glass-panel p-5 sm:p-6">
      <h3 className="font-display font-600 text-lg text-court-ink mb-1">{title}</h3>
      {hint && <p className="text-xs text-court-ink/50 mb-3">{hint}</p>}
      <div className={`space-y-4 ${hint ? "" : "mt-4"}`}>{children}</div>
    </div>
  );
}

function StatCardFields({
  title, value, label, desc, onValue, onLabel, onDesc,
}: {
  title: string; value: string; label: string; desc: string;
  onValue: (v: string) => void; onLabel: (v: string) => void; onDesc: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-court-ink/60 uppercase tracking-wide">{title}</p>
      <TextField label={'Big value (e.g. "20/7")'} value={value} onChange={onValue} />
      <TextField label="Label" value={label} onChange={onLabel} />
      <TextField label="Description" value={desc} onChange={onDesc} />
    </div>
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
