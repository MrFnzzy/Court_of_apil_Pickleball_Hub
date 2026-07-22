"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/DatePicker";
import ScheduleGrid from "@/components/ScheduleGrid";
import AdminPaymentAccounts from "@/components/AdminPaymentAccounts";
import AdminManualBookingForm from "@/components/AdminManualBookingForm";
import PaddleIcon from "@/components/icons/PaddleIcon";
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
  const [tab, setTab] = useState<"schedule" | "accounts">("schedule");
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

      <div className="max-w-6xl mx-auto px-4
