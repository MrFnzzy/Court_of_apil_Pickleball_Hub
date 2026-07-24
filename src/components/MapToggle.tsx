"use client";

import { useState } from "react";

export default function MapToggle() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="focus-ring inline-flex items-center gap-2 rounded-full border-2 border-court-blue-dark/30 bg-white px-4 py-2 text-sm font-semibold text-court-ink hover:border-court-blue-dark transition-colors"
        aria-expanded={open}
      >
        <svg className="h-4 w-4 text-court-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        {open ? "Hide map" : "View on Google Maps"}
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="mt-4 overflow-hidden rounded-court shadow-court border border-court-blue/30 animate-[fadeIn_.25s_ease]">
          <iframe
            title="Court of Apil location map"
            src="https://www.google.com/maps?q=Court+of+Apil+Pickleball+Talisay+City+Cebu&output=embed"
            width="100%"
            height="360"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="bg-white p-3 text-sm flex items-center justify-between gap-3">
            <span className="text-court-ink/70">Talisay City, Cebu — free on-site parking</span>
            <a
              href="https://maps.app.goo.gl/5cj5BP3vJSMy94p48?g_st=afm"
              target="_blank"
              rel="noreferrer"
              className="shrink-0 font-semibold text-court-orange-dark hover:underline focus-ring"
            >
              Get directions →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
