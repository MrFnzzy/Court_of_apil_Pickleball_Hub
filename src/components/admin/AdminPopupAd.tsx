"use client";

import Image from "next/image";
import { uploadFile } from "@/lib/uploadFile";
import { useEffect, useState } from "react";

type PopupAd = {
  enabled: boolean;
  imageUrl: string | null;
  videoUrl: string | null;
  headline: string | null;
  message: string | null;
  linkUrl: string | null;
  buttonText: string | null;
};

const EMPTY: PopupAd = {
  enabled: false,
  imageUrl: null,
  videoUrl: null,
  headline: null,
  message: null,
  linkUrl: null,
  buttonText: null,
};

export default function AdminPopupAd() {
  const [ad, setAd] = useState<PopupAd>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [videoPreviewFailed, setVideoPreviewFailed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Local editable copies of the text fields, so typing doesn't PATCH on
  // every keystroke — only "Save changes" commits them.
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [buttonText, setButtonText] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/popup-ad", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load popup ad.");
      const data = await res.json();
      const a: PopupAd = data.ad || EMPTY;
      setAd(a);
      setHeadline(a.headline || "");
      setMessage(a.message || "");
      setLinkUrl(a.linkUrl || "");
      setButtonText(a.buttonText || "");
      setLoadError(null);
    } catch (err) {
      console.error(err);
      setLoadError("Couldn't load the popup ad settings. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(body: Record<string, unknown>) {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/popup-ad", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setAd(data.ad);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const uploadData = await uploadFile(file, "popup");
      await patch({ imageUrl: uploadData.url });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleVideoUpload(file: File) {
    setError(null);
    setVideoPreviewFailed(false);
    setUploadingVideo(true);
    try {
      const uploadData = await uploadFile(file, "popup-video");
      await patch({ videoUrl: uploadData.url });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingVideo(false);
    }
  }

  async function removeVideo() {
    await patch({ videoUrl: "" });
  }

  async function saveText() {
    await patch({
      headline: headline.trim() || null,
      message: message.trim() || null,
      linkUrl: linkUrl.trim() || null,
      buttonText: buttonText.trim() || null,
    });
  }

  async function toggleEnabled() {
    await patch({ enabled: !ad.enabled });
  }

  if (loading) return <p className="text-court-ink/50">Loading…</p>;
  if (loadError)
    return (
      <div className="rounded-court glass-panel p-5 sm:p-6">
        <p className="text-red-600 text-sm">{loadError}</p>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Launch control */}
      <div className="rounded-court bg-gradient-to-br from-court-blue-dark to-court-ink text-white shadow-court-lg p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <h3 className="font-display font-600 text-lg mb-1 flex items-center gap-2">
          <span aria-hidden>📣</span> Popup ad
        </h3>
        <p className="text-sm text-white/70 mb-4 max-w-xl">
          Shows as a pop-up over the homepage the first time someone visits each session — not on every page
          load. Needs a photo before it can go live.
        </p>

        <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 backdrop-blur px-4 py-3">
          <div>
            <p className="font-semibold text-sm flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${ad.enabled ? "bg-green-400 animate-pulse" : "bg-white/30"}`} />
              {ad.enabled ? "Live" : "Off"}
            </p>
            <p className="text-xs text-white/60 mt-0.5">
              {ad.enabled ? "Visitors are seeing this popup on the homepage." : "The homepage is showing normally, no popup."}
            </p>
          </div>
          <button
            onClick={toggleEnabled}
            disabled={saving || (!ad.enabled && !ad.imageUrl)}
            title={!ad.enabled && !ad.imageUrl ? "Add a photo first" : undefined}
            className={`focus-ring relative h-8 w-14 rounded-full transition-colors disabled:opacity-40 ${
              ad.enabled ? "bg-green-500" : "bg-white/20"
            }`}
            aria-label="Toggle popup ad"
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                ad.enabled ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {!ad.enabled && !ad.imageUrl && <p className="text-xs text-amber-200 mt-3">Add a photo below before going live.</p>}
      </div>

      {/* Photo */}
      <div className="rounded-court glass-panel p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Ad photo</h3>
        <p className="text-sm text-court-ink/60 mb-4">
          This is the image shown in the popup. Any size works — it's automatically scaled to fit any device
          without cropping oddly.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {ad.imageUrl ? (
            <div className="relative h-32 w-52 shrink-0 rounded-xl overflow-hidden border-2 border-court-ink/10 bg-court-ink/5">
              <Image src={ad.imageUrl} alt="Popup ad" fill className="object-contain" />
            </div>
          ) : (
            <div className="h-32 w-52 shrink-0 rounded-xl border-2 border-dashed border-court-ink/20 flex items-center justify-center text-xs text-court-ink/40 italic">
              No photo yet
            </div>
          )}
          <div>
            <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-full bg-court-orange text-white px-5 py-2.5 text-sm font-semibold hover:bg-court-orange-dark">
              {uploading ? "Uploading…" : ad.imageUrl ? "Replace photo" : "Upload photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Video */}
      <div className="rounded-court glass-panel p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Ad video (optional)</h3>
        <p className="text-sm text-court-ink/60 mb-4">
          If you add a video, it plays in the popup instead of the photo above (the photo is still used as the
          preview frame before it plays). Leave this empty to keep showing just the photo. Upload MP4 or WebM
          for the most reliable playback across every visitor's browser — up to 100MB.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {ad.videoUrl ? (
            <div className="shrink-0">
              <video
                key={ad.videoUrl}
                src={ad.videoUrl}
                poster={ad.imageUrl || undefined}
                className="h-32 w-52 rounded-xl overflow-hidden border-2 border-court-ink/10 bg-court-ink/5 object-contain"
                controls
                muted
                onError={() => setVideoPreviewFailed(true)}
                onPlaying={() => setVideoPreviewFailed(false)}
              />
              {videoPreviewFailed && (
                <p className="text-xs text-red-600 mt-1.5 max-w-52">
                  This browser can't play this video file. Re-export it as MP4 (H.264) and upload again.
                </p>
              )}
            </div>
          ) : (
            <div className="h-32 w-52 shrink-0 rounded-xl border-2 border-dashed border-court-ink/20 flex items-center justify-center text-xs text-court-ink/40 italic">
              No video
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-full bg-court-orange text-white px-5 py-2.5 text-sm font-semibold hover:bg-court-orange-dark">
              {uploadingVideo ? "Uploading…" : ad.videoUrl ? "Replace video" : "Upload video"}
              <input
                type="file"
                accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogv"
                className="hidden"
                disabled={uploadingVideo}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleVideoUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            {ad.videoUrl && (
              <button
                onClick={removeVideo}
                disabled={saving || uploadingVideo}
                className="focus-ring text-sm font-semibold text-court-ink/60 hover:text-red-600 disabled:opacity-50"
              >
                Remove video
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Text + link */}
      <div className="rounded-court glass-panel p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Headline &amp; details</h3>
        <p className="text-sm text-court-ink/60 mb-4">All optional — leave any blank to keep the popup as just the photo.</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Headline</span>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Grand opening promo!"
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Button text</span>
            <input
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              placeholder="Book now"
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block mb-1 font-medium text-court-ink/80">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="20% off your first booking this month."
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 resize-none"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block mb-1 font-medium text-court-ink/80">Button link (optional)</span>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="/book"
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2"
            />
            <span className="block mt-1 text-xs text-court-ink/50">
              If left blank but a button text is set, the button just closes the popup.
            </span>
          </label>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={saveText}
            disabled={saving}
            className="focus-ring rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="text-sm font-semibold text-green-600">Saved ✓</span>}
        </div>
        <p className="text-xs text-court-ink/40 mt-3">
          Saving here also resets who's seen it — everyone gets shown the updated popup again next visit, even if
          they already dismissed the old version this session.
        </p>
      </div>
    </div>
  );
}
