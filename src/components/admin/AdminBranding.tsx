"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Branding = {
  siteName: string;
  siteTagline: string;
  logoUrl: string | null;
};

export default function AdminBranding() {
  const [values, setValues] = useState<Branding | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-settings")
      .then((r) => r.json())
      .then((d) =>
        setValues({
          siteName: d.settings.siteName,
          siteTagline: d.settings.siteTagline,
          logoUrl: d.settings.logoUrl,
        })
      )
      .finally(() => setLoading(false));
  }, []);

  function handleLogoPick(file: File | null) {
    setLogoFile(file);
    setSaved(false);
    if (file) {
      setLogoPreview(URL.createObjectURL(file));
    } else {
      setLogoPreview(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      let logoUrl = values.logoUrl;
      if (logoFile) {
        const fd = new FormData();
        fd.append("file", logoFile);
        fd.append("folder", "branding");
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "Logo upload failed.");
        logoUrl = uploadData.url;
      }

      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, logoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setValues({
        siteName: data.settings.siteName,
        siteTagline: data.settings.siteTagline,
        logoUrl: data.settings.logoUrl,
      });
      setLogoFile(null);
      setLogoPreview(null);
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !values) {
    return <p className="text-court-ink/50">Loading branding…</p>;
  }

  const displayedLogo = logoPreview || values.logoUrl;

  return (
    <form onSubmit={handleSave} className="rounded-court bg-white border-2 border-court-orange/30 shadow-court p-5 sm:p-6 max-w-xl">
      <h3 className="font-display font-600 text-lg text-court-ink mb-1">Branding</h3>
      <p className="text-sm text-court-ink/60 mb-5">
        The site name, tagline, and logo shown in the header and footer across the whole site.
      </p>

      <div className="flex items-center gap-4 mb-5">
        <div className="relative h-16 w-16 shrink-0 rounded-full overflow-hidden border-2 border-court-ink/10 bg-court-cream flex items-center justify-center">
          {displayedLogo ? (
            <Image src={displayedLogo} alt="Logo preview" fill className="object-cover" />
          ) : (
            <span className="text-xs text-court-ink/40">No logo</span>
          )}
        </div>
        <label className="text-sm">
          <span className="block mb-1 font-medium text-court-ink/80">Upload logo</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleLogoPick(e.target.files?.[0] || null)}
            className="block text-sm"
          />
          <span className="block mt-1 text-xs text-court-ink/50">Square image works best. Leave empty to keep the paddle icon.</span>
        </label>
      </div>

      <div className="space-y-4">
        <label className="block text-sm">
          <span className="block mb-1 font-medium text-court-ink/80">Site name</span>
          <input
            value={values.siteName}
            onChange={(e) => {
              setValues({ ...values, siteName: e.target.value });
              setSaved(false);
            }}
            className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="block mb-1 font-medium text-court-ink/80">Tagline</span>
          <input
            value={values.siteTagline}
            onChange={(e) => {
              setValues({ ...values, siteTagline: e.target.value });
              setSaved(false);
            }}
            className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      {saved && !error && <p className="text-sm text-green-600 mt-4">Branding updated.</p>}

      <button
        type="submit"
        disabled={saving}
        className="focus-ring mt-5 rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save branding"}
      </button>
    </form>
  );
}
