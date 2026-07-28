"use client";

import { useState } from "react";
import ScheduleGrid from "./ScheduleGrid";

export default function AdminManualBookingForm({
  date,
  onCreated,
}: {
  date: string;
  onCreated: () => void;
}) {
  const [hours, setHours] = useState<number[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [paddleCount, setPaddleCount] = useState<0 | 1 | 2>(0);
  const [status, setStatus] = useState<"CONFIRMED" | "PENDING">("CONFIRMED");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleHour(hour: number) {
    setHours((prev) => (prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour].sort((a, b) => a - b)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customerName.trim() || hours.length === 0) {
      setError("Please enter a customer name and select at least one slot.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, contactNumber, email, date, hours, paddleCount, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create booking.");
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-court bg-white border-2 border-court-orange/30 shadow-court p-5 sm:p-6 mb-6">
      <h3 className="font-display font-600 text-lg text-court-ink mb-4">Manual booking — {date}</h3>

      <ScheduleGrid date={date} mode="select" selected={hours} onToggle={toggleHour} autoRefresh={false} />

      <div className="grid sm:grid-cols-3 gap-4 mt-5">
        <label className="text-sm">
          <span className="block mb-1 font-medium text-court-ink/80">Customer name</span>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2" required />
        </label>
        <label className="text-sm">
          <span className="block mb-1 font-medium text-court-ink/80">Contact number</span>
          <input value={contactNumber} onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, "").slice(0, 11))} className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="block mb-1 font-medium text-court-ink/80">Email (optional)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="block mb-1 font-medium text-court-ink/80">Rental</span>
          <select value={paddleCount} onChange={(e) => setPaddleCount(Number(e.target.value) as 0 | 1 | 2)} className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2">
            <option value={0}>No rental</option>
            <option value={1}>1 paddle (₱100)</option>
            <option value={2}>2 paddles (₱150)</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block mb-1 font-medium text-court-ink/80">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2">
            <option value="CONFIRMED">Confirmed</option>
            <option value="PENDING">Pending approval</option>
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="focus-ring mt-5 rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Add booking"}
      </button>
    </form>
  );
}
