"use client";

import { useEffect, useRef, useState } from "react";

type MusicSettings = {
  musicUrl: string | null;
  musicTitle: string;
  musicAutoplay: boolean;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminMusicSettings() {
  const [values, setValues] = useState<MusicSettings | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingAutoplay, setSavingAutoplay] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/site-settings");
    const data = await res.json();
    const settings: MusicSettings = {
      musicUrl: data.settings.musicUrl,
      musicTitle: data.settings.musicTitle || "",
      musicAutoplay: data.settings.musicAutoplay,
    };
    setValues(settings);
    setTitleInput(settings.musicTitle);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function handleFilePick(picked: File | null) {
    setFile(picked);
    setSaved(false);
    setError(null);
    if (picked && !titleInput) {
      // Default the display title to the filename (minus extension), tidied up a bit.
      const base = picked.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
      setTitleInput(base);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose an audio file first.");
      return;
    }
    setError(null);
    setSaved(false);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "music");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed.");

      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicUrl: uploadData.url, musicTitle: titleInput || file.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");

      setValues({
        musicUrl: data.settings.musicUrl,
        musicTitle: data.settings.musicTitle,
        musicAutoplay: data.settings.musicAutoplay,
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleAutoplayToggle(next: boolean) {
    if (!values) return;
    setSavingAutoplay(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicAutoplay: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setValues({ ...values, musicAutoplay: data.settings.musicAutoplay });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingAutoplay(false);
    }
  }

  async function handleRemove() {
    if (!values || !confirm("Remove the uploaded music? The site will fall back to the default ambient sound.")) return;
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicUrl: "", musicTitle: "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove.");
      setValues({ musicUrl: null, musicTitle: "", musicAutoplay: data.settings.musicAutoplay });
      setTitleInput("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRemoving(false);
    }
  }

  if (loading || !values) {
    return <p className="text-court-ink/50">Loading music settings…</p>;
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="rounded-xl border-2 border-court-blue/30 bg-court-blue-light/20 text-court-ink/80 px-4 py-3 text-sm">
        This track plays site-wide for every visitor. Uploading a new file replaces the current one immediately —
        no redeploy needed.
      </div>

      <div className="rounded-court bg-white border-2 border-court-orange/30 shadow-court p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Current track</h3>
        {values.musicUrl ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm font-medium text-court-ink">{values.musicTitle || "Untitled track"}</p>
            <audio controls src={values.musicUrl} className="w-full" />
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="focus-ring text-sm font-semibold text-red-500 hover:underline disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove track"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-court-ink/50 italic mt-2">
            No music uploaded yet. The site is currently using the built-in ambient sound.
          </p>
        )}
      </div>

      <form onSubmit={handleUpload} className="rounded-court bg-white border-2 border-court-orange/30 shadow-court p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Upload new music</h3>
        <p className="text-sm text-court-ink/60 mb-4">MP3, WAV, OGG, M4A, AAC or FLAC. Max 25MB. It will loop automatically.</p>

        <label className="block text-sm mb-4">
          <span className="block mb-1 font-medium text-court-ink/80">Audio file</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => handleFilePick(e.target.files?.[0] || null)}
            className="block w-full text-sm"
          />
          {file && <span className="block mt-1 text-xs text-court-ink/50">{file.name} — {formatBytes(file.size)}</span>}
        </label>

        <label className="block text-sm mb-4">
          <span className="block mb-1 font-medium text-court-ink/80">Display title (optional)</span>
          <input
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="e.g. Golden Hour Chill Mix"
            className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {saved && !error && <p className="text-sm text-green-600 mb-3">Music updated — it's live for every visitor now.</p>}

        <button
          type="submit"
          disabled={uploading || !file}
          className="focus-ring rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload & set as site music"}
        </button>
      </form>

      <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-5 sm:p-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display font-600 text-lg text-court-ink mb-1">Autoplay for new visitors</h3>
          <p className="text-sm text-court-ink/60">
            When on, music starts automatically for anyone who hasn't already chosen to mute it on their device.
            Every visitor can still turn it off themselves using the music button in the corner of the site.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={values.musicAutoplay}
          disabled={savingAutoplay}
          onClick={() => handleAutoplayToggle(!values.musicAutoplay)}
          className={`focus-ring shrink-0 relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${
            values.musicAutoplay ? "bg-court-orange" : "bg-court-ink/20"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              values.musicAutoplay ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
