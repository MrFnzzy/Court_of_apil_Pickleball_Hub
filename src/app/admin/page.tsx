"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startRepeatingAlarm, isAlarmMuted, setAlarmMuted, unlockAudio, playTestAlarm } from "@/lib/adminAlarmSound";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/DatePicker";
import ScheduleGrid from "@/components/ScheduleGrid";
import AdminPaymentAccounts from "@/components/AdminPaymentAccounts";
import AdminPricingSettings from "@/components/AdminPricingSettings";
import AdminManualBookingForm, { EditableBooking } from "@/components/AdminManualBookingForm";
import ModalPortal from "@/components/ModalPortal";
import AdminSiteContent from "@/components/admin/AdminSiteContent";
import AdminMusicSettings from "@/components/admin/AdminMusicSettings";
import AdminBookingHistory from "@/components/admin/AdminBookingHistory";
import AdminWeekSchedule from "@/components/admin/AdminWeekSchedule";
import AdminRecentBookings from "@/components/admin/AdminRecentBookings";
import AdminEmailCustomer from "@/components/admin/AdminEmailCustomer";
import AdminFeedback from "@/components/admin/AdminFeedback";
import AdminOperationsSettings from "@/components/admin/AdminOperationsSettings";
import AdminDiscounts from "@/components/admin/AdminDiscounts";
import AdminPopupAd from "@/components/admin/AdminPopupAd";
import AdminVisitorStats from "@/components/admin/AdminVisitorStats";
import PaddleIcon from "@/components/icons/PaddleIcon";
import InstallAppButton from "@/components/InstallAppButton";
import AdminNotificationSettings from "@/components/admin/AdminNotificationSettings";
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
  ballCount: number;
  ballTotal: number;
  paymentMethod: string;
  referenceNumber: string;
  amountSent: number;
  proofOfPaymentUrl: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";
  adminNote: string | null;
  createdAt: string;
  groupId: string | null;
  discountPercent: number;
  discountAmount: number;
  discount: { code: string } | null;
  isFree: boolean;
  isPaid: boolean;
};

function peso(n: number): string {
  return `₱${n.toLocaleString("en-PH")}`;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-300",
  CONFIRMED: "bg-green-100 text-green-700 border-green-300",
  REJECTED: "bg-red-100 text-red-700 border-red-300",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-300",
};

const RENTAL_LABEL: Record<number, string> = {
  0: "No rental",
  1: "1 Paddle rental",
  2: "2 Paddles rental",
};

function rentalLabel(paddleCount: number): string {
  return RENTAL_LABEL[paddleCount] ?? `${paddleCount} Paddles rental`;
}

const BALL_LABEL: Record<number, string> = {
  0: "",
  1: "1 Ball rental",
  3: "3 Balls rental",
};

function ballLabel(ballCount: number): string {
  return BALL_LABEL[ballCount] ?? (ballCount > 0 ? `${ballCount} Balls rental` : "");
}

function bookedAtLabel(createdAt: string): string {
  return new Date(createdAt).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortDateLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Collapses bookings that share a groupId (a single reservation split
// across two dates) into one entry, so a linked multi-day booking shows
// up once — not as two separate pending items — everywhere a flat list
// of bookings is summarized.
function groupBookingsForDisplay<T extends { id: string; groupId: string | null; date: string; startHours: number[]; grandTotal: number }>(
  list: T[]
): { key: string; primary: T; all: T[] }[] {
  const seen = new Set<string>();
  const result: { key: string; primary: T; all: T[] }[] = [];
  for (const b of list) {
    const key = b.groupId ?? b.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const all = b.groupId ? list.filter((x) => x.groupId === b.groupId) : [b];
    const primary = all.slice().sort((a, c) => a.date.localeCompare(c.date))[0];
    result.push({ key, primary, all });
  }
  return result;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<
    "schedule" | "week" | "recent" | "history" | "email" | "feedback" | "accounts" | "pricing" | "hours" | "design" | "music" | "discounts" | "popup"
  >("schedule");
  const [date, setDate] = useState(manilaToday());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [gridKey, setGridKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  // Pending bookings across ALL dates, not just the one currently shown in
  // the Schedule tab's date picker — powers the header notification bell so
  // a pending request on some other day doesn't go unnoticed.
  const [allPending, setAllPending] = useState<Booking[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [alarmMuted, setAlarmMutedState] = useState(false);

  // Loud, repeating alarm for brand-new pending bookings so nothing gets
  // missed even if the admin has stepped away. Tracks which pending IDs
  // we've already alerted on (in a ref so it survives re-renders without
  // retriggering the effect), and stops the current alarm run the moment
  // the admin acknowledges it by opening the notification bell.
  const alertedIdsRef = useRef<Set<string>>(new Set());
  const activeAlarmRef = useRef<{ stop: () => void } | null>(null);
  const firstPendingLoadRef = useRef(true);

  useEffect(() => {
    setAlarmMutedState(isAlarmMuted());
  }, []);

  // Browsers block ALL audio (Web Audio, speechSynthesis, <audio>) on a
  // page until the person interacts with it at least once — a click, tap,
  // or keypress. New-booking alarms arrive from a background poll, not a
  // click, so without this the very first alarm after a fresh page load
  // can be silently blocked. Unlock as soon as the admin touches the
  // dashboard at all, so it's ready by the time a real alarm needs to play.
  useEffect(() => {
    function unlockOnce() {
      unlockAudio();
      window.removeEventListener("click", unlockOnce);
      window.removeEventListener("keydown", unlockOnce);
      window.removeEventListener("touchstart", unlockOnce);
    }
    window.addEventListener("click", unlockOnce);
    window.addEventListener("keydown", unlockOnce);
    window.addEventListener("touchstart", unlockOnce);
    return () => {
      window.removeEventListener("click", unlockOnce);
      window.removeEventListener("keydown", unlockOnce);
      window.removeEventListener("touchstart", unlockOnce);
    };
  }, []);

  const loadAllPending = useCallback(async () => {
    const res = await fetch(`/api/admin/bookings`, { cache: "no-store" });
    if (res.status === 401) return;
    const data = await res.json();
    const pending = (data.bookings || []).filter((b: Booking) => b.status === "PENDING");
    setAllPending(pending);

    // Don't alarm on the very first load (that's just "here's what's
    // already pending", not a brand-new booking) — only on IDs that show
    // up in a later poll that we haven't seen before.
    if (firstPendingLoadRef.current) {
      firstPendingLoadRef.current = false;
      pending.forEach((b: Booking) => alertedIdsRef.current.add(b.id));
      return;
    }
    const newOnes = pending.filter((b: Booking) => !alertedIdsRef.current.has(b.id));
    if (newOnes.length > 0) {
      newOnes.forEach((b: Booking) => alertedIdsRef.current.add(b.id));
      activeAlarmRef.current?.stop();
      activeAlarmRef.current = startRepeatingAlarm(100);
    }
  }, []);

  function acknowledgeAlarm() {
    activeAlarmRef.current?.stop();
    activeAlarmRef.current = null;
  }

  useEffect(() => {
    return () => activeAlarmRef.current?.stop();
  }, []);

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

  useEffect(() => {
    loadAllPending();
    const interval = setInterval(loadAllPending, 20000);
    return () => clearInterval(interval);
  }, [loadAllPending]);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Reschedule modal — lets the admin move a still-PENDING booking to a
  // different date/time before deciding whether to approve it (e.g. the
  // customer's original slot turns out to already be spoken for, or they
  // asked to switch days over chat/phone before payment gets verified).
  const [reschedulingBooking, setReschedulingBooking] = useState<Booking | null>(null);

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
    await loadAllPending();
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
      await loadAllPending();
      setGridKey((k) => k + 1);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const pendingCount = bookings.filter((b) => b.status === "PENDING").length;
  // Same list as `allPending`, but bookings that share a groupId (a single
  // reservation split across two dates) are collapsed into one entry —
  // so the bell shows "2 pending" for two distinct customers, not for one
  // customer's two-date booking.
  const pendingGroups = useMemo(() => groupBookingsForDisplay(allPending), [allPending]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-court-blue-light/45 via-court-cream to-court-orange-light/25">
      <header className="bg-court-ink text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-court-orange">
              <PaddleIcon className="h-4 w-4" />
            </span>
            <span className="font-display font-600">Court manager</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={playTestAlarm}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 focus-ring"
              title="Play the new-booking alarm once to test it"
            >
              Test alarm sound
            </button>
            <button
              onClick={() => {
                const next = !alarmMuted;
                setAlarmMuted(next);
                setAlarmMutedState(next);
                if (next) acknowledgeAlarm();
              }}
              aria-label={alarmMuted ? "Unmute new-booking alarm" : "Mute new-booking alarm"}
              title={alarmMuted ? "New-booking alarm is muted" : "New-booking alarm is on"}
              className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10"
            >
              {alarmMuted ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5 6 9H3v6h3l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M23 9l-6 6M17 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5 6 9H3v6h3l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen((o) => !o);
                  acknowledgeAlarm();
                }}
                aria-label="Pending booking notifications"
                className="focus-ring relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {pendingGroups.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-court-orange px-1 text-[10px] font-bold text-white">
                    {pendingGroups.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <button
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setNotifOpen(false)}
                    aria-label="Close notifications"
                  />
                  <div className="absolute right-0 z-50 mt-2 w-80 max-h-96 overflow-y-auto rounded-court glass-panel text-court-ink">
                    <div className="px-4 py-3 border-b border-court-ink/10">
                      <p className="font-display font-600 text-sm">
                        Pending bookings {pendingGroups.length > 0 && `(${pendingGroups.length})`}
                      </p>
                      <p className="text-xs text-court-ink/50">Across all dates</p>
                    </div>
                    {pendingGroups.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-court-ink/50 italic text-center">Nothing pending right now.</p>
                    ) : (
                      <ul className="divide-y divide-court-ink/10">
                        {pendingGroups.map(({ key, primary, all }) => {
                          const totalSlots = all.reduce((s, b) => s + b.startHours.length, 0);
                          const totalAmount = all.reduce((s, b) => s + b.grandTotal, 0);
                          const dates = all.map((b) => shortDateLabel(b.date));
                          return (
                            <li key={key}>
                              <button
                                onClick={() => {
                                  setTab("schedule");
                                  setDate(primary.date.slice(0, 10));
                                  setNotifOpen(false);
                                }}
                                className="focus-ring w-full text-left px-4 py-3 hover:bg-court-blue-light/20"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-semibold text-sm truncate">{primary.customerName}</p>
                                  <span className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-amber-100 text-amber-700 border-amber-300 flex-shrink-0">
                                    Pending
                                  </span>
                                </div>
                                <p className="text-xs text-court-ink/60 mt-0.5">
                                  {dates.join(" + ")} · {totalSlots} slot{totalSlots === 1 ? "" : "s"} · ₱{totalAmount}
                                </p>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
            <button onClick={handleLogout} className="text-sm font-medium text-white/70 hover:text-white focus-ring">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <AdminVisitorStats />
        <InstallAppButton swScope="/admin" appName="Heide's Admin" accentClassName="bg-gradient-to-r from-court-blue-dark to-court-ink" />
        <div className="mb-6">
          <AdminNotificationSettings />
        </div>

        <div className="relative mb-6 -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-4 sm:overflow-visible sm:flex-wrap sm:justify-center">
            <TabButton active={tab === "schedule"} onClick={() => setTab("schedule")}>
              Schedule {pendingCount > 0 && tab !== "schedule" && (
                <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-court-orange text-white text-[10px]">{pendingCount}</span>
              )}
            </TabButton>
            <TabButton active={tab === "week"} onClick={() => setTab("week")}>
              Week view
            </TabButton>
            <TabButton active={tab === "recent"} onClick={() => setTab("recent")}>
              Recent bookings
            </TabButton>
            <TabButton active={tab === "history"} onClick={() => setTab("history")}>
              Booking history
            </TabButton>
            <TabButton active={tab === "email"} onClick={() => setTab("email")}>
              Email customer
            </TabButton>
            <TabButton active={tab === "feedback"} onClick={() => setTab("feedback")}>
              Feedback
            </TabButton>
            <TabButton active={tab === "accounts"} onClick={() => setTab("accounts")}>
              Payment accounts
            </TabButton>
            <TabButton active={tab === "pricing"} onClick={() => setTab("pricing")}>
              Pricing
            </TabButton>
            <TabButton active={tab === "hours"} onClick={() => setTab("hours")}>
              Hours &amp; alerts
            </TabButton>
            <TabButton active={tab === "design"} onClick={() => setTab("design")}>
              Design &amp; content
            </TabButton>
            <TabButton active={tab === "music"} onClick={() => setTab("music")}>
              Music
            </TabButton>
            <TabButton active={tab === "discounts"} onClick={() => setTab("discounts")}>
              Discounts
            </TabButton>
            <TabButton active={tab === "popup"} onClick={() => setTab("popup")}>
              Popup ad
            </TabButton>
          </div>
          {/* Edge fades hint that the tab bar scrolls on small screens */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-court-cream to-transparent sm:hidden" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-court-cream to-transparent sm:hidden" />
        </div>

        {tab === "week" ? (
          <AdminWeekSchedule />
        ) : tab === "recent" ? (
          <AdminRecentBookings />
        ) : tab === "history" ? (
          <AdminBookingHistory />
        ) : tab === "email" ? (
          <AdminEmailCustomer />
        ) : tab === "feedback" ? (
          <AdminFeedback />
        ) : tab === "accounts" ? (
          <AdminPaymentAccounts />
        ) : tab === "pricing" ? (
          <AdminPricingSettings />
        ) : tab === "hours" ? (
          <AdminOperationsSettings />
        ) : tab === "design" ? (
          <AdminSiteContent />
        ) : tab === "music" ? (
          <AdminMusicSettings />
        ) : tab === "discounts" ? (
          <AdminDiscounts />
        ) : tab === "popup" ? (
          <AdminPopupAd />
        ) : (
          <>
            <div className="rounded-court glass-panel p-5 sm:p-6 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <DatePicker value={date} onChange={setDate} />
                <button
                  onClick={() => setShowManualForm(true)}
                  className="focus-ring rounded-full bg-court-orange text-white px-4 py-2 text-sm font-semibold hover:bg-court-orange-dark"
                >
                  + Add manual booking
                </button>
              </div>
              <div key={gridKey}>
                <ScheduleGrid date={date} mode="view" admin />
              </div>
            </div>

            {showManualForm && (
              <AdminManualBookingForm
                date={date}
                onClose={() => setShowManualForm(false)}
                onCreated={(bookingDate) => {
                  setDate(bookingDate);
                  loadBookings();
                  loadAllPending();
                  setGridKey((k) => k + 1);
                }}
              />
            )}

            {actionError && (
              <div className="rounded-xl border-2 border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium mb-4">
                {actionError}
              </div>
            )}

            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <h2 className="font-display font-700 text-xl text-court-ink">
                Bookings for {new Date(date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
              </h2>
              {!loading && bookings.length > 0 && (
                <p className="text-sm font-semibold text-court-orange-dark">
                  {peso(
                    bookings
                      .filter((b) => b.status === "CONFIRMED" && !b.isFree && b.isPaid)
                      .reduce((sum, b) => sum + b.grandTotal, 0)
                  )}{" "}
                  <span className="text-xs font-medium text-court-ink/50">confirmed revenue</span>
                </p>
              )}
            </div>

            {loading ? (
              <p className="text-court-ink/50">Loading…</p>
            ) : bookings.length === 0 ? (
              <p className="text-court-ink/50 italic">No bookings for this date yet.</p>
            ) : (
              <div className="space-y-4">
                {bookings.map((b) => (
                  <div key={b.id} className="rounded-court glass-panel p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-display font-600 text-court-ink">{b.customerName}</p>
                          <span className={`text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${STATUS_BADGE[b.status]}`}>
                            {b.status}
                          </span>
                          {b.isFree && (
                            <span className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-court-blue-light text-court-blue-dark border-court-blue/30">
                              Free
                            </span>
                          )}
                          {!b.isFree && !b.isPaid && (
                            <span className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-amber-100 text-amber-700 border-amber-300">
                              Unpaid
                            </span>
                          )}
                          {b.groupId && (
                            <span
                              className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-court-orange/10 text-court-orange-dark border-court-orange/30"
                              title="This booking's payment also covers a linked reservation on another date. Approving or rejecting either one applies to both."
                            >
                              Multi-day booking
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-court-ink/60">{b.contactNumber} · {b.email}</p>
                        <p className="text-sm text-court-ink/70 mt-1">
                          {b.startHours.slice().sort((a, c) => a - c).map((h) => labelForSlot(h)).join(", ")}
                        </p>
                        <p className="text-sm text-court-ink/70">
                          {rentalLabel(b.paddleCount)}
                          {b.paddleCount > 0 && ` (₱${b.rentalTotal})`}
                        </p>
                        {b.ballCount > 0 && (
                          <p className="text-sm text-court-ink/70">
                            {ballLabel(b.ballCount)} (₱{b.ballTotal})
                          </p>
                        )}
                        {b.discountAmount > 0 && (
                          <p className="text-sm text-green-700">
                            Promo {b.discount?.code ?? ""} ({b.discountPercent}% off): -₱{b.discountAmount}
                          </p>
                        )}
                        <p className="text-xs text-court-ink/40 mt-1">Booked {bookedAtLabel(b.createdAt)}</p>
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
                      {(b.status === "PENDING" || b.status === "CONFIRMED") && (
                        <button
                          onClick={() => setReschedulingBooking(b)}
                          className="focus-ring rounded-full bg-court-blue-light/20 text-court-blue-dark border border-court-blue-dark/30 px-4 py-1.5 text-sm font-semibold hover:bg-court-blue-light/30"
                        >
                          Reschedule
                        </button>
                      )}
                      <button
                        onClick={() => setEditingBooking(b)}
                        className="focus-ring rounded-full bg-white text-court-ink/70 border border-court-ink/15 px-4 py-1.5 text-sm font-semibold hover:bg-court-ink/5"
                      >
                        Edit
                      </button>
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
        <ModalPortal>
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto overscroll-contain bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-court glass-panel p-6">
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
        </ModalPortal>
      )}

      {editingBooking && (
        <AdminManualBookingForm
          date={editingBooking.date.slice(0, 10)}
          editBooking={editingBooking as EditableBooking}
          onClose={() => setEditingBooking(null)}
          onCreated={() => {}}
          onSaved={async () => {
            setEditingBooking(null);
            await loadBookings();
            await loadAllPending();
            setGridKey((k) => k + 1);
          }}
        />
      )}

      {reschedulingBooking && (
        <RescheduleModal
          booking={reschedulingBooking}
          onClose={() => setReschedulingBooking(null)}
          onSaved={async () => {
            setReschedulingBooking(null);
            await loadBookings();
            await loadAllPending();
            setGridKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

type SlotGridStatus = "past" | "available" | "pending" | "booked" | "closed";
type SlotGridItem = { hour: number; status: SlotGridStatus; price: number; booking?: { id: string } };

function RescheduleModal({
  booking,
  onClose,
  onSaved,
}: {
  booking: Booking;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(booking.date.slice(0, 10));
  const [grid, setGrid] = useState<SlotGridItem[] | null>(null);
  const [loadingGrid, setLoadingGrid] = useState(true);
  const [selectedHours, setSelectedHours] = useState<Set<number>>(new Set(booking.startHours));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingGrid(true);
    setError(null);
    fetch(`/api/slots?date=${date}&admin=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setGrid(Array.isArray(data.grid) ? data.grid : []);
      })
      .catch(() => {
        if (!cancelled) setGrid([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingGrid(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  function toggleHour(hour: number, selectable: boolean) {
    if (!selectable) return;
    setSelectedHours((prev) => {
      const next = new Set(prev);
      if (next.has(hour)) next.delete(hour);
      else next.add(hour);
      return next;
    });
  }

  // A hour is pickable if it's genuinely open, OR if it's currently held
  // by this very booking (so switching dates away and back — or just
  // re-picking the same day — doesn't make its own existing hours look
  // "unavailable" to itself). A PENDING booking's own slots show as
  // "pending" in the grid; a CONFIRMED booking's own slots show as
  // "booked" — both need to stay pickable here.
  function isSelectable(slot: SlotGridItem): boolean {
    if (slot.status === "available") return true;
    return (slot.status === "pending" || slot.status === "booked") && slot.booking?.id === booking.id;
  }

  const previewTotal = useMemo(() => {
    if (!grid) return null;
    let court = 0;
    for (const h of selectedHours) {
      const g = grid.find((s) => s.hour === h);
      if (g) court += g.price;
    }
    return court + booking.rentalTotal + booking.ballTotal;
  }, [grid, selectedHours, booking.rentalTotal, booking.ballTotal]);

  async function save() {
    if (selectedHours.size === 0) {
      setError("Select at least one time slot.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, hours: Array.from(selectedHours) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reschedule booking.");
        return;
      }
      onSaved();
    } catch {
      setError("Failed to reschedule booking. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const sortedHours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto overscroll-contain bg-black/40 p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-court glass-panel p-6">
          <h3 className="font-display font-700 text-lg text-court-ink mb-1">Reschedule booking</h3>
          <p className="text-sm text-court-ink/60 mb-4">
            {booking.customerName} · currently{" "}
            {new Date(booking.date.slice(0, 10) + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })} ·{" "}
            {booking.startHours.slice().sort((a, c) => a - c).map((h) => labelForSlot(h)).join(", ")}
          </p>
          {booking.status === "CONFIRMED" && (
            <p className="text-xs text-court-blue-dark bg-court-blue-light/15 border border-court-blue-dark/20 rounded-lg px-3 py-2 mb-4">
              This booking is already confirmed — saving a new date/time here will email {booking.customerName.split(" ")[0] || "the customer"} to let them know it moved.
            </p>
          )}

          <DatePicker value={date} onChange={setDate} />

          <p className="text-xs font-semibold text-court-ink/60 mt-4 mb-2">Pick the new time slot(s):</p>
          {loadingGrid ? (
            <p className="text-sm text-court-ink/50 py-4 text-center">Loading availability…</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {sortedHours.map((hour) => {
                const slot = grid?.find((s) => s.hour === hour);
                if (!slot) return null;
                const selectable = isSelectable(slot);
                const isSelected = selectedHours.has(hour);
                let cls = "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed";
                if (isSelected) cls = "bg-court-orange text-white border-court-orange-dark";
                else if (selectable) cls = "bg-green-50 text-green-700 border-green-300 hover:bg-green-100";
                return (
                  <button
                    key={hour}
                    type="button"
                    disabled={!selectable}
                    onClick={() => toggleHour(hour, selectable)}
                    className={`focus-ring rounded-lg border-2 px-1.5 py-1.5 text-[11px] font-semibold transition-colors ${cls}`}
                  >
                    {labelForSlot(hour)}
                  </button>
                );
              })}
            </div>
          )}

          {previewTotal !== null && (
            <p className="text-sm text-court-ink/70 mt-3">
              New court + rental total: <span className="font-semibold text-court-orange-dark">₱{previewTotal}</span>
              {booking.discountAmount > 0 && " (before promo discount is re-applied)"}
            </p>
          )}

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={onClose}
              disabled={saving}
              className="focus-ring rounded-full bg-white text-court-ink/70 border border-court-ink/15 px-4 py-2 text-sm font-semibold hover:bg-court-ink/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || loadingGrid}
              className="focus-ring rounded-full bg-court-blue-dark text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save new date/time"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`focus-ring flex-shrink-0 snap-start whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active ? "bg-court-orange text-white shadow-court" : "bg-white text-court-ink/70 border border-court-ink/10 hover:border-court-orange/40"
      }`}
    >
      {children}
    </button>
  );
}
