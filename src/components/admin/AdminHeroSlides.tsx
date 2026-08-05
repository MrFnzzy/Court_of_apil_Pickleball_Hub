"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Slide = {
  id: string;
  imageUrl: string;
  headline: string | null;
  subtext: string | null;
  linkUrl: string | null;
  order: number;
  active: boolean;
};

export default function AdminHeroSlides() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [headline, setHeadline] = useState("");
  const [subtext, setSubtext] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/hero-slides");
    const data = await res.json();
    setSlides((data.slides || []).sort((a: Slide, b: Slide) => a.order - b.order));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a photo to add to the slideshow.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "hero");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Image upload failed.");

      const res = await fetch("/api/admin/hero-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: uploadData.url,
          headline: headline || undefined,
          subtext: subtext || undefined,
          linkUrl: linkUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add slide.");

      setFile(null);
      setHeadline("");
      setSubtext("");
      setLinkUrl("");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(slide: Slide) {
    await fetch(`/api/admin/hero-slides/${slide.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !slide.active }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this photo from the slideshow?")) return;
    await fetch(`/api/admin/hero-slides/${id}`, { method: "DELETE" });
    load();
  }

  async function move(slide: Slide, direction: "up" | "down") {
    const sorted = [...slides].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === slide.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const other = sorted[swapIdx];
    await Promise.all([
      fetch(`/api/admin/hero-slides/${slide.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: other.order }),
      }),
      fetch(`/api/admin/hero-slides/${other.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: slide.order }),
      }),
    ]);
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="rounded-court bg-white border-2 border-court-orange/30 shadow-court p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Homepage photo slideshow</h3>
        <p className="text-sm text-court-ink/60 mb-4">
          The blue court graphic on the homepage becomes a slideshow once you add photos here. Add several to have
          it rotate automatically; leave it empty to keep the default illustration.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Photo</span>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Caption headline (optional)</span>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Caption subtext (optional)</span>
            <input value={subtext} onChange={(e) => setSubtext(e.target.value)} className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Link when clicked (optional)</span>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="/book"
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2"
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <button
          type="submit"
          disabled={uploading}
          className="focus-ring mt-4 rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Add photo"}
        </button>
      </form>

      <div>
        <h3 className="font-display font-600 text-lg text-court-ink mb-4">Current slides</h3>
        {loading ? (
          <p className="text-court-ink/50">Loading…</p>
        ) : slides.length === 0 ? (
          <p className="text-court-ink/50 italic">No photos added yet — the homepage is showing the default court illustration.</p>
        ) : (
          <div className="space-y-3">
            {slides.map((slide, i) => (
              <div key={slide.id} className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-4 flex gap-4 items-center">
                <div className="relative h-16 w-24 shrink-0 rounded-lg overflow-hidden border">
                  <Image src={slide.imageUrl} alt={slide.headline || ""} fill className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-600 text-court-ink text-sm truncate">
                    {slide.headline || <span className="text-court-ink/40 italic">No headline</span>}
                  </p>
                  {slide.subtext && <p className="text-xs text-court-ink/60 truncate">{slide.subtext}</p>}
                  <div className="flex gap-3 mt-1.5">
                    <button onClick={() => toggleActive(slide)} className="text-xs font-semibold text-court-blue-dark hover:underline focus-ring">
                      {slide.active ? "Hide" : "Show"}
                    </button>
                    <button onClick={() => remove(slide.id)} className="text-xs font-semibold text-red-500 hover:underline focus-ring">
                      Remove
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => move(slide, "up")}
                    disabled={i === 0}
                    className="focus-ring h-7 w-7 rounded-full border border-court-ink/15 text-court-ink/60 disabled:opacity-30 hover:border-court-orange/40"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(slide, "down")}
                    disabled={i === slides.length - 1}
                    className="focus-ring h-7 w-7 rounded-full border border-court-ink/15 text-court-ink/60 disabled:opacity-30 hover:border-court-orange/40"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                </div>
                {!slide.active && (
                  <span className="text-[10px] h-fit uppercase font-bold text-gray-400 border border-gray-300 rounded-full px-2 py-0.5 shrink-0">
                    Hidden
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
