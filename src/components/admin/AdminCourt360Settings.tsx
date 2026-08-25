"use client";

import { uploadFile } from "@/lib/uploadFile";
import Court360Viewer from "@/components/Court360Viewer";
import { useRef, useState, useEffect } from "react";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminCourt360Settings() {
  const [court360Url, setCourt360Url] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site-settings");
      if (!res.ok) throw new Error("Failed to load 360 photo settings.");
      const data = await res.json();
      setCourt360Url(data.settings?.court360Url ?? null);
      setLoadError(null);
    } catch (err) {
      console.error(err);
      setLoadError("Couldn't load 360 photo settings. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // A local object URL lets the admin preview their pick as a sphere before
  // it's even uploaded — revoked on cleanup/replacement so it doesn't leak.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFilePick(picked: File | null) {
    setFile(picked);
    setSaved(false);
    setError(null);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a photo first.");
      return;
    }
    setError(null);
    setSaved(false);
    setUploading(true);
    try {
      const uploadData = await uploadFile(file, "court-360");

      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ court360Url: uploadData.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");

      setCourt360Url(data.settings.court360Url);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remove the uploaded 360 photo? The site will fall back to the default court photo.")) return;
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ court360Url: "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove.");
      setCourt360Url(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return <p className="text-court-ink/50">Loading 360 photo settings…</p>;
  }
  if (loadError) {
    return <p className="text-red-600 text-sm">{loadError}</p>;
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="rounded-xl border-2 border-court-blue/30 bg-court-blue-light/20 text-court-ink/80 px-4 py-3 text-sm">
        This photo powers the drag-to-look-around 360 viewer on the homepage's "Pick your court time" preview.
        Uploading a new one replaces it immediately for every visitor — no redeploy needed.
      </div>

      <div className="rounded-court glass-panel p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-3">
          {previewUrl ? "New photo preview" : "Current photo"}
        </h3>
        <Court360Viewer src={previewUrl || court360Url || "/court-360.jpg"} alt="360 court photo preview" />
        {!previewUrl && (
          <p className="text-sm text-court-ink/50 italic mt-3">
            {court360Url ? "Drag to check the current photo." : "No custom photo uploaded yet — showing the default court photo."}
          </p>
        )}
        {court360Url && !previewUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="focus-ring mt-3 text-sm font-semibold text-red-500 hover:underline disabled:opacity-50"
          >
            {removing ? "Removing…" : "Remove custom photo"}
          </button>
        )}
      </div>

      <form onSubmit={handleUpload} className="rounded-court glass-panel p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Upload new 360 photo</h3>
        <p className="text-sm text-court-ink/60 mb-4">
          JPEG, PNG, WEBP or HEIC. Max 20MB. Use a wide panorama or photo-sphere capture — a 2:1 (equirectangular)
          capture looks best, but any wide panorama works.
        </p>

        <label className="block text-sm mb-4">
          <span className="block mb-1 font-medium text-court-ink/80">Photo file</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={(e) => handleFilePick(e.target.files?.[0] || null)}
            className="block w-full text-sm"
          />
          {file && <span className="block mt-1 text-xs text-court-ink/50">{file.name} — {formatBytes(file.size)}</span>}
        </label>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {saved && !error && <p className="text-sm text-green-600 mb-3">360 photo updated — it's live for every visitor now.</p>}

        <button
          type="submit"
          disabled={uploading || !file}
          className="focus-ring rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload & set as court photo"}
        </button>
      </form>
    </div>
  );
}
