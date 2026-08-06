"use client";

import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PaddleIcon from "@/components/icons/PaddleIcon";
import { labelForSlot } from "@/lib/pricing";

type BookingSummary = {
  customerName: string;
  date: string;
  startHours: number[];
  alreadySubmitted: boolean;
};

const RATING_QUESTIONS: { key: RatingKey; label: string; hint: string }[] = [
  { key: "overallRating", label: "Overall experience", hint: "How was your time with us overall?" },
  { key: "venueRating", label: "Venue & court quality", hint: "The court surface, nets, lighting, and cleanliness." },
  { key: "valueRating", label: "Value for money", hint: "Did the price feel fair for what you got?" },
];

type RatingKey = "overallRating" | "venueRating" | "valueRating";

export default function FeedbackPage({ params }: { params: { token: string } }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [booking, setBooking] = useState<BookingSummary | null>(null);

  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    overallRating: 0,
    venueRating: 0,
    valueRating: 0,
  });
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/feedback/${params.token}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setBooking(data);
          if (data.alreadySubmitted) setSubmitted(true);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  const allRated = Object.values(ratings).every((r) => r > 0);

  async function handleSubmit() {
    if (!allRated || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/feedback/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ratings, comment: comment.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-court-cream flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-10">
        {loading ? (
          <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-8 text-center text-court-ink/50">
            Loading…
          </div>
        ) : notFound || !booking ? (
          <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-8 text-center">
            <h1 className="font-display font-700 text-xl text-court-ink mb-2">Link not found</h1>
            <p className="text-court-ink/60 text-sm">
              This feedback link is invalid or has expired. If you think this is a mistake, please contact us directly.
            </p>
          </div>
        ) : submitted ? (
          <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-8 text-center wizard-step">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-court-orange/10 mb-4">
              <PaddleIcon className="h-7 w-7 text-court-orange" />
            </span>
            <h1 className="font-display font-700 text-xl text-court-ink mb-2">Thank you!</h1>
            <p className="text-court-ink/60 text-sm">
              We really appreciate you taking the time to share your feedback. See you on the court again soon!
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-court-orange mb-3">
                <PaddleIcon className="h-6 w-6 text-white" />
              </span>
              <h1 className="font-display font-700 text-2xl text-court-ink">Thanks for playing, {booking.customerName.split(" ")[0]}!</h1>
              <p className="text-court-ink/60 text-sm mt-1">
                {new Date(booking.date.slice(0, 10) + "T00:00:00").toLocaleDateString("en-PH", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                {" · "}
                {booking.startHours.slice().sort((a, b) => a - b).map((h) => labelForSlot(h)).join(", ")}
              </p>
              <p className="text-court-ink/70 text-sm mt-3">
                Let us know how it went — your feedback helps us make your next booking even better.
              </p>
            </div>

            <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-5 sm:p-6 space-y-6">
              {RATING_QUESTIONS.map((q) => (
                <div key={q.key}>
                  <p className="font-display font-600 text-court-ink">{q.label}</p>
                  <p className="text-xs text-court-ink/50 mb-2">{q.hint}</p>
                  <StarRating
                    value={ratings[q.key]}
                    onChange={(v) => setRatings((r) => ({ ...r, [q.key]: v }))}
                  />
                </div>
              ))}

              <div>
                <p className="font-display font-600 text-court-ink mb-2">Anything else you&apos;d like to tell us?</p>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="Optional comments, suggestions, or anything we should improve for next time…"
                  className="input-field"
                />
              </div>

              {error && (
                <div className="rounded-xl border-2 border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!allRated || submitting}
                className="focus-ring w-full rounded-full bg-court-orange text-white font-display font-600 py-3 shadow-court disabled:opacity-40 disabled:cursor-not-allowed hover:bg-court-orange-dark transition-colors"
              >
                {submitting ? "Submitting…" : "Submit feedback"}
              </button>
              {!allRated && (
                <p className="text-center text-xs text-court-ink/40">Please rate all three categories to submit.</p>
              )}
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className="focus-ring rounded-full p-0.5"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-8 w-8 transition-colors ${n <= value ? "fill-court-orange text-court-orange" : "fill-transparent text-court-ink/25"}`}
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M12 2.5l2.9 6.06 6.6.77-4.86 4.6 1.28 6.57L12 17.27l-5.92 3.23 1.28-6.57-4.86-4.6 6.6-.77L12 2.5z"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}
