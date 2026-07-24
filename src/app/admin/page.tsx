"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/DatePicker";
import ScheduleGrid from "@/components/ScheduleGrid";
import AdminPaymentAccounts from "@/components/AdminPaymentAccounts";
import AdminPricingSettings from "@/components/AdminPricingSettings";
import AdminManualBookingForm from "@/components/AdminManualBookingForm";
import AdminSiteContent from "@/components/admin/AdminSiteContent";
import AdminBookingHistory from "@/components/admin/AdminBookingHistory";
import PaddleIcon from "@/components/icons/PaddleIcon";
import InstallAppButton from "@/components/InstallAppButton";
import { labelForSlot } from "@/lib/pricing";

function manilaToday(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

type Booking = {
  id: string;
  customerName: string;
  contactNumber: string;
  email: string;
  date: string;
  startHours: number[];
  courtTotal: number;
  rentalTotal: number;
  grandTotal: number;
  paddleCount: number;
  paymentMethod: string;
  referenceNumber: string;
  amountSent: number;
  proofOfPaymentUrl: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";
  adminNote: string | null;
  createdAt: string;
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-300",
  CONFIRMED: "bg-green-100 text-green-700 border-green-300",
  REJECTED: "bg-red-100 text-red-700 border-red-300",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-300",
};

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<"schedule" | "history" | "accounts" | "pricing" | "design">("schedule");
  const [date, setDate] = useState(manilaToday());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);
  const [gridKey, setGridKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    const res = await fetch(`/api/admin/bookings?date=${date}`, { cache: "no-store" });
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    const data = await res.json();
    setBookings(data.bookings || []);
    setLoading(false);
  }, [date, router]);

  useEffect(() => {
    setLoading(true);
    loadBookings();
    const interval = setInterval(loadBookings, 20000);
    return () => clearInterval(interval);
  }, [loadBookings]);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function updateStatus(id: string, status: string, adminNote?: string) {
    setActionError(null);
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminNote }),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionError(data.error || "Action failed.");
      return;
    }
    await loadBookings();
    setGridKey((k) => k + 1);
  }

  function openRejectModal(id: string) {
    setRejectReason("");
    setRejectingId(id);
  }

  async function confirmReject() {
    if (!rejectingId) return;
    const reason = rejectReason.trim() || "We couldn't verify your payment details.";
    await updateStatus(rejectingId, "REJECTED", reason);
    setRejectingId(null);
    setRejectReason("");
  }

  async function removeBooking(id: string) {
    if (!confirm("Remove this booking permanently? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/bookings/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadBookings();
      setGridKey((k) => k + 1);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const pendingCount = bookings.filter((b) => b.status === "PENDING").length;

  return (
    <div className="min-h-screen bg-court-cream">
      <header className="bg-court-ink text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-court-orange">
              <PaddleIcon className="h-4 w-4" />
            </span>
            <span className="font-display font-600">Court manager</span>
          </div>
          <button onClick={handleLogout} className="text-sm font-medium text-white/70 hover:text-white focus-ring">
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <InstallAppButton swScope="/admin" appName="CoA Admin" accentClassName="bg-gradient-to-r from-court-blue-dark to-court-ink" />

        <div className="flex gap-2 mb-6">
          <TabButton active={tab === "schedule"} onClick={() => setTab("schedule")}>
            Schedule {pendingCount > 0 && tab !== "schedule" && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-court-orange text-white text-[10px]">{pendingCount}</span>
            )}
          </TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")}>
            Booking history
          </TabButton>
          <TabButton active={tab === "accounts"} onClick={() => setTab("accounts")}>
            Payment accounts
          </TabButton>
          <TabButton active={tab === "pricing"} onClick={() => setTab("pricing")}>
            Pricing
          </TabButton>
          <TabButton active={tab === "design"} onClick={() => setTab("design")}>
            Design &amp; content
          </TabButton>
        </div>

        {tab === "history" ? (
          <AdminBookingHistory />
        ) : tab === "accounts" ? (
          <AdminPaymentAccounts />
        ) : tab === "pricing" ? (
          <AdminPricingSettings />
        ) : tab === "design" ? (
          <AdminSiteContent />
        ) : (
          <>
            <div className="rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <DatePicker value={date} onChange={setDate} />
                <button
                  onClick={() => setShowManualForm((s) => !s)}
                  className="focus-ring rounded-full bg-court-orange text-white px-4 py-2 text-sm font-semibold hover:bg-court-orange-dark"
                >
                  {showManualForm ? "Close form" : "+ Add manual booking"}
                </button>
              </div>
              <div key={gridKey}>
                <ScheduleGrid date={date} mode="view" admin />
              </div>
            </div>

            {showManualForm && (
              <AdminManualBookingForm
                date={date}
                onCreated={() => {
                  setShowManualForm(false);
                  loadBookings();
                  setGridKey((k) => k + 1);
                }}
              />
            )}

            {actionError && (
              <div className="rounded-xl border-2 border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium mb-4">
                {actionError}
              </div>
            )}

            <h2 className="font-display font-700 text-xl text-court-ink mb-4">
              Bookings for {new Date(date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
            </h2>

            {loading ? (
              <p className="text-court-ink/50">Loading…</p>
            ) : bookings.length === 0 ? (
              <p className="text-court-ink/50 italic">No bookings for this date yet.</p>
            ) : (
              <div className="space-y-4">
                {bookings.map((b) => (
                  <div key={b.id} className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-display font-600 text-court-ink">{b.customerName}</p>
                          <span className={`text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${STATUS_BADGE[b.status]}`}>
                            {b.status}
                          </span>
                        </div>
                        <p className="text-sm text-court-ink/60">{b.contactNumber} · {b.email}</p>
                        <p className="text-sm text-court-ink/70 mt-1">
                          {b.startHours.slice().sort((a, c) => a - c).map((h) => labelForSlot(h)).join(", ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-700 text-lg text-court-orange-dark">₱{b.grandTotal}</p>
                        <p className="text-xs text-court-ink/50">
                          {b.paymentMethod} · Ref {b.referenceNumber}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {b.proofOfPaymentUrl && (
                        <a
                          href={b.proofOfPaymentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-court-blue-dark hover:underline focus-ring"
                        >
                          View proof of payment →
                        </a>
                      )}
                      <span className="text-xs text-court-ink/40">Amount sent: ₱{b.amountSent}</span>
                    </div>

                    {b.status === "REJECTED" && b.adminNote && (
                      <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        Reason sent to customer: {b.adminNote}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {b.status !== "CONFIRMED" && (
                        <button
                          onClick={() => updateStatus(b.id, "CONFIRMED")}
                          className="focus-ring rounded-full bg-green-600 text-white px-4 py-1.5 text-sm font-semibold hover:bg-green-700"
                        >
                          Approve
                        </button>
                      )}
                      {b.status !== "REJECTED" && (
                        <button
                          onClick={() => openRejectModal(b.id)}
                          className="focus-ring rounded-full bg-red-100 text-red-700 border border-red-300 px-4 py-1.5 text-sm font-semibold hover:bg-red-200"
                        >
                          Reject
                        </button>
                      )}
                      {b.status !== "CANCELLED" && b.status === "CONFIRMED" && (
                        <button
                          onClick={() => updateStatus(b.id, "CANCELLED")}
                          className="focus-ring rounded-full bg-gray-100 text-gray-600 border border-gray-300 px-4 py-1.5 text-sm font-semibold hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => removeBooking(b.id)}
                        className="focus-ring rounded-full bg-white text-red-500 border border-red-200 px-4 py-1.5 text-sm font-semibold hover:bg-red-50 ml-auto"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-court bg-white border-2 border-court-ink/10 shadow-court p-6">
            <h3 className="font-display font-700 text-lg text-court-ink mb-2">Reject booking</h3>
            <p className="text-sm text-court-ink/60 mb-4">
              This message will be emailed to the customer explaining why their booking wasn&apos;t confirmed.
            </p>

            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() =>
                  setRejectReason(
                    "We couldn't verify the proof of payment you submitted. Please make sure the screenshot clearly shows the transaction details."
                  )
                }
                className="focus-ring text-xs font-semibold rounded-full border border-court-ink/15 px-3 py-1.5 hover:border-court-orange/40"
              >
                Couldn&apos;t verify payment
              </button>
              <button
                type="button"
                onClick={() => setRejectReason("We did not receive the payment for this booking.")}
                className="focus-ring text-xs font-semibold rounded-full border border-court-ink/15 px-3 py-1.5 hover:border-court-orange/40"
              >
                Payment not received
              </button>
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Write what happened..."
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 text-sm focus-ring"
              autoFocus
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setRejectingId(null)}
                className="focus-ring rounded-full bg-white text-court-ink/70 border border-court-ink/15 px-4 py-2 text-sm font-semibold hover:bg-court-ink/5"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                className="focus-ring rounded-full bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700"
              >
                Reject & notify customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active ? "bg-court-orange text-white shadow-court" : "bg-white text-court-ink/70 border border-court-ink/10 hover:border-court-orange/40"
      }`}
    >
      {children}
    </button>
  );
}
