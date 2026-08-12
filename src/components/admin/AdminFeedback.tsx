"use client";

import { useEffect, useMemo, useState } from "react";
import { labelForSlot } from "@/lib/pricing";

type FeedbackEntry = {
  id: string;
  overallRating: number;
  venueRating: number;
  valueRating: number;
  comment: string | null;
  createdAt: string;
  booking: {
    customerName: string;
    date: string;
    startHours: number[];
  };
};

function submittedAtLabel(createdAt: string): string {
  return new Date(createdAt).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function average(f: FeedbackEntry): number {
  return (f.overallRating + f.venueRating + f.valueRating) / 3;
}

export default function AdminFeedback() {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/feedback", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setFeedback(d.feedback || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    if (feedback.length === 0) return null;
    const avg = (key: keyof Pick<FeedbackEntry, "overallRating" | "venueRating" | "valueRating">) =>
      feedback.reduce((sum, f) => sum + f[key], 0) / feedback.length;
    return {
      count: feedback.length,
      overall: avg("overallRating"),
      venue: avg("venueRating"),
      value: avg("valueRating"),
    };
  }, [feedback]);

  return (
    <div>
      <div className="rounded-court glass-panel p-5 sm:p-6 mb-6">
        <h2 className="font-display font-700 text-xl text-court-ink mb-1">Customer feedback</h2>
        <p className="text-sm text-court-ink/60 mb-4">
          Collected automatically after each confirmed booking&apos;s time has finished.
        </p>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryStat label="Responses" value={String(summary.count)} />
            <SummaryStat label="Overall" value={summary.overall.toFixed(1)} suffix="★" />
            <SummaryStat label="Venue" value={summary.venue.toFixed(1)} suffix="★" />
            <SummaryStat label="Value" value={summary.value.toFixed(1)} suffix="★" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-court bg-court-ink/5 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ) : feedback.length === 0 ? (
        <p className="text-court-ink/50 italic text-center py-12">No feedback submitted yet.</p>
      ) : (
        <div className="space-y-3">
          {feedback.map((f, i) => (
            <div
              key={f.id}
              className="wizard-step rounded-court glass-panel p-4 sm:p-5"
              style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display font-600 text-court-ink">{f.booking.customerName}</p>
                  <p className="text-sm text-court-ink/60">
                    {new Date(f.booking.date.slice(0, 10) + "T00:00:00").toLocaleDateString("en-PH", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {" · "}
                    {f.booking.startHours.slice().sort((a, b) => a - b).map((h) => labelForSlot(h)).join(", ")}
                  </p>
                  <p className="text-xs text-court-ink/40 mt-1">Submitted {submittedAtLabel(f.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-700 text-lg text-court-orange-dark">{average(f).toFixed(1)} ★</p>
                  <p className="text-xs text-court-ink/50">average</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <RatingChip label="Overall" value={f.overallRating} />
                <RatingChip label="Venue" value={f.venueRating} />
                <RatingChip label="Value" value={f.valueRating} />
              </div>

              {f.comment && (
                <p className="mt-3 text-sm text-court-ink/80 bg-court-cream border border-court-ink/10 rounded-lg px-3 py-2">
                  &ldquo;{f.comment}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-xl bg-court-cream border border-court-ink/10 px-3 py-2 text-center">
      <p className="font-display font-700 text-lg text-court-orange-dark">
        {value}
        {suffix && <span className="text-sm ml-0.5">{suffix}</span>}
      </p>
      <p className="text-[11px] text-court-ink/50">{label}</p>
    </div>
  );
}

function RatingChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-court-ink/5 px-2.5 py-1.5 text-center">
      <p className="text-xs font-semibold text-court-ink">{value} ★</p>
      <p className="text-[10px] text-court-ink/50">{label}</p>
    </div>
  );
}
