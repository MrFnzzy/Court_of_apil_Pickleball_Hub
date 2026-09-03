"use client";

import { useEffect, useState } from "react";

type Fields = {
  confirmationEmailSubject: string;
  confirmationEmailHeading: string;
  confirmationEmailBody: string;

  thankYouEmailSubject: string;
  thankYouEmailHeading: string;
  thankYouEmailBody: string;
  thankYouEmailButtonText: string;

  spinInviteEmailSubject: string;
  spinInviteEmailHeading: string;
  spinInviteEmailBody: string;
  spinInviteEmailButtonText: string;
};

type SubTab = "confirmation" | "thankyou" | "spin";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "confirmation", label: "Booking confirmation" },
  { key: "thankyou", label: "Thank you message" },
  { key: "spin", label: "Spin invite" },
];

export default function AdminEmailTemplates() {
  const [subTab, setSubTab] = useState<SubTab>("confirmation");
  const [values, setValues] = useState<Fields | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/site-settings")
      .then((r) => r.json())
      .then((d) => {
        const s = d.settings;
        setValues({
          confirmationEmailSubject: s.confirmationEmailSubject,
          confirmationEmailHeading: s.confirmationEmailHeading,
          confirmationEmailBody: s.confirmationEmailBody,
          thankYouEmailSubject: s.thankYouEmailSubject,
          thankYouEmailHeading: s.thankYouEmailHeading,
          thankYouEmailBody: s.thankYouEmailBody,
          thankYouEmailButtonText: s.thankYouEmailButtonText,
          spinInviteEmailSubject: s.spinInviteEmailSubject,
          spinInviteEmailHeading: s.spinInviteEmailHeading,
          spinInviteEmailBody: s.spinInviteEmailBody,
          spinInviteEmailButtonText: s.spinInviteEmailButtonText,
        });
      })
      .catch(() => setLoadError("Failed to load email templates."))
      .finally(() => setLoading(false));
  }, []);

  function updateField(key: keyof Fields, value: string) {
    if (!values) return;
    setValues({ ...values, [key]: value });
  }

  if (loading || !values) {
    return <p className="text-court-ink/50">Loading email templates…</p>;
  }

  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              subTab === t.key
                ? "bg-court-ink text-white shadow-court"
                : "bg-white text-court-ink/70 border border-court-ink/10 hover:border-court-orange/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "confirmation" && (
        <TemplateEditor
          title="Booking confirmation email"
          description="Sent the moment an admin approves a booking's payment."
          mergeTags={["{customerName}", "{date}", "{referenceNumber}", "{grandTotal}"]}
          fields={[
            { key: "confirmationEmailSubject", label: "Email subject", value: values.confirmationEmailSubject, type: "text" },
            { key: "confirmationEmailHeading", label: "Banner heading", value: values.confirmationEmailHeading, type: "text" },
            {
              key: "confirmationEmailBody",
              label: "Message",
              value: values.confirmationEmailBody,
              type: "textarea",
              rows: 6,
              hint: "Shown after \"Hi {customerName},\" and above the booking details. Leave a blank line between paragraphs.",
            },
          ]}
          onFieldChange={(key, v) => updateField(key as keyof Fields, v)}
        />
      )}

      {subTab === "thankyou" && (
        <TemplateEditor
          title="Thank you message"
          description="Sent once a confirmed booking's reserved time has passed, asking the customer for feedback."
          mergeTags={["{customerName}", "{date}"]}
          fields={[
            { key: "thankYouEmailSubject", label: "Email subject", value: values.thankYouEmailSubject, type: "text" },
            { key: "thankYouEmailHeading", label: "Banner heading", value: values.thankYouEmailHeading, type: "text" },
            {
              key: "thankYouEmailBody",
              label: "Message",
              value: values.thankYouEmailBody,
              type: "textarea",
              rows: 6,
              hint: "Shown after \"Hi {customerName},\" and above the feedback button. Leave a blank line between paragraphs.",
            },
            { key: "thankYouEmailButtonText", label: "Button text", value: values.thankYouEmailButtonText, type: "text" },
          ]}
          onFieldChange={(key, v) => updateField(key as keyof Fields, v)}
        />
      )}

      {subTab === "spin" && (
        <TemplateEditor
          title="Spin invite email"
          description="Sent to customers who qualify for a spin on the prize wheel."
          mergeTags={["{customerName}"]}
          fields={[
            { key: "spinInviteEmailSubject", label: "Email subject", value: values.spinInviteEmailSubject, type: "text" },
            { key: "spinInviteEmailHeading", label: "Banner heading", value: values.spinInviteEmailHeading, type: "text" },
            {
              key: "spinInviteEmailBody",
              label: "Message",
              value: values.spinInviteEmailBody,
              type: "textarea",
              rows: 6,
              hint: "Shown after \"Hi {customerName},\" and above the spin button. Leave a blank line between paragraphs.",
            },
            { key: "spinInviteEmailButtonText", label: "Button text", value: values.spinInviteEmailButtonText, type: "text" },
          ]}
          onFieldChange={(key, v) => updateField(key as keyof Fields, v)}
        />
      )}
    </div>
  );
}

type FieldDef = {
  key: keyof Fields;
  label: string;
  value: string;
  type: "text" | "textarea";
  rows?: number;
  hint?: string;
};

function TemplateEditor({
  title,
  description,
  mergeTags,
  fields,
  onFieldChange,
}: {
  title: string;
  description: string;
  mergeTags: string[];
  fields: FieldDef[];
  onFieldChange: (key: string, value: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const patch: Record<string, string> = {};
      for (const f of fields) patch[f.key] = f.value;
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
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

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
      <div className="rounded-court glass-panel p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">{title}</h3>
        <p className="text-sm text-court-ink/60 mb-4">{description}</p>

        <p className="text-xs text-court-ink/50 mb-4">
          Merge tags you can use in the fields below — each is replaced with the real value when the email is sent:{" "}
          {mergeTags.map((tag, i) => (
            <span key={tag}>
              <code className="rounded bg-court-ink/5 px-1.5 py-0.5 font-mono text-[11px]">{tag}</code>
              {i < mergeTags.length - 1 ? " " : ""}
            </span>
          ))}
        </p>

        <div className="space-y-4">
          {fields.map((f) =>
            f.type === "text" ? (
              <TextField
                key={f.key}
                label={f.label}
                value={f.value}
                onChange={(v) => {
                  onFieldChange(f.key, v);
                  setSaved(false);
                }}
              />
            ) : (
              <TextArea
                key={f.key}
                label={f.label}
                value={f.value}
                rows={f.rows || 5}
                hint={f.hint}
                onChange={(v) => {
                  onFieldChange(f.key, v);
                  setSaved(false);
                }}
              />
            )
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-green-600">Email template updated.</p>}

      <button
        type="submit"
        disabled={saving}
        className="focus-ring rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 font-medium text-court-ink/80">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="focus-ring w-full rounded-xl border-2 border-court-ink/15 px-3 py-2" />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 font-medium text-court-ink/80">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="focus-ring w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 resize-y"
      />
      {hint && <span className="block mt-1 text-xs text-court-ink/40">{hint}</span>}
    </label>
  );
}
