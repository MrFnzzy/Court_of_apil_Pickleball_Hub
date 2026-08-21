"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PaddleIcon from "@/components/icons/PaddleIcon";

export default function TrackLandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    router.push(`/track/${encodeURIComponent(trimmed.toUpperCase())}`);
  }

  return (
    <div className="min-h-screen bg-court-cream flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-6 py-16">
        <div className="rounded-court glass-panel p-8 sm:p-10 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-court-orange to-court-orange-dark shadow-court mb-5">
            <PaddleIcon className="h-6 w-6 text-white" />
          </span>
          <h1 className="font-display font-700 text-2xl text-court-ink mb-2">Track your booking</h1>
          <p className="text-court-ink/60 mb-6">
            Enter the booking reference number you were given after checkout to see whether it&apos;s been approved.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. HPH-7K9X2M"
              autoFocus
              className="focus-ring flex-1 rounded-full border-2 border-court-ink/15 px-4 py-3 text-sm font-mono uppercase text-center sm:text-left"
            />
            <button
              type="submit"
              className="focus-ring rounded-full bg-court-orange text-white px-6 py-3 text-sm font-semibold hover:bg-court-orange-dark"
            >
              Find my booking
            </button>
          </form>
          <p className="text-xs text-court-ink/40 mt-4">
            This is the reference number shown after you booked — not your GCash/Maya/BPI payment reference.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
