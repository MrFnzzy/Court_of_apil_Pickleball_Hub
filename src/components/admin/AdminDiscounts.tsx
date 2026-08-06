"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Discount = {
  id: string;
  code: string;
  percentage: number;
  maxRedemptions: number | null;
  maxPerCustomer: number;
  redemptionCount: number;
  active: boolean;
  source: "MANUAL" | "SPIN_WHEEL";
  note: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
};

type Prize = {
  id: string;
  label: string;
  percentage: number;
  weight: number;
  color: string;
  active: boolean;
  order: number;
};

type SpinSettings = { enabled: boolean; startDate: string | null };

type Invite = {
  id: string;
  email: string;
  customerName: string;
  isTest: boolean;
  sentAt: string;
  spunAt: string | null;
  prize: { label: string } | null;
  discount: { code: string; percentage: number } | null;
};

const SWATCHES = [
  "#F46036", "#D6491F", "#FF8C61", "#6CD4FF", "#2FA8D9", "#173A45", "#8BC34A", "#FFC107",
  "#9C27B0", "#E91E63", "#00BCD4", "#607D8B",
];

const PRIZE_PRESETS: { label: string; percentage: number; weight: number; emoji: string }[] = [
  { label: "5% OFF", percentage: 5, weight: 25, emoji: "🎾" },
  { label: "10% OFF", percentage: 10, weight: 15, emoji: "🏆" },
  { label: "15% OFF", percentage: 15, weight: 8, emoji: "🔥" },
  { label: "20% OFF", percentage: 20, weight: 4, emoji: "💥" },
  { label: "50% OFF", percentage: 50, weight: 1, emoji: "🎉" },
  { label: "Better luck next time", percentage: 0, weight: 40, emoji: "😅" },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminDiscounts() {
  const [section, setSection] = useState<"codes" | "spin">("codes");

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => setSection("codes")}
          className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            section === "codes" ? "bg-court-blue-dark text-white shadow-court" : "bg-white text-court-ink/70 border border-court-ink/10 hover:border-court-blue-dark/40"
          }`}
        >
          Discounts &amp; Promo Codes
        </button>
        <button
          onClick={() => setSection("spin")}
          className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            section === "spin" ? "bg-court-blue-dark text-white shadow-court" : "bg-white text-court-ink/70 border border-court-ink/10 hover:border-court-blue-dark/40"
          }`}
        >
          <span aria-hidden>🎡</span> Spin the Wheel
        </button>
      </div>

      {section === "codes" ? <DiscountsSection /> : <SpinWheelSection />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Discounts & promo codes                                                */
/* ---------------------------------------------------------------------- */

function getStatus(d: Discount): { label: string; cls: string } {
  const now = new Date();
  if (!d.active) return { label: "Inactive", cls: "bg-gray-100 text-gray-500 border-gray-300" };
  if (d.endDate && now > new Date(d.endDate)) return { label: "Expired", cls: "bg-red-100 text-red-600 border-red-300" };
  if (now < new Date(d.startDate)) return { label: "Scheduled", cls: "bg-blue-100 text-blue-600 border-blue-300" };
  if (d.maxRedemptions !== null && d.redemptionCount >= d.maxRedemptions)
    return { label: "Limit reached", cls: "bg-amber-100 text-amber-700 border-amber-300" };
  return { label: "Active", cls: "bg-green-100 text-green-700 border-green-300" };
}

const EMPTY_FORM = {
  code: "",
  percentage: 10,
  active: true,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  maxRedemptions: "" as string | number,
  maxPerCustomer: 1,
  note: "",
};

function DiscountsSection() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/discounts", { cache: "no-store" });
    const data = await res.json();
    setDiscounts(data.discounts || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(d: Discount) {
    setEditingId(d.id);
    setForm({
      code: d.code,
      percentage: d.percentage,
      active: d.active,
      startDate: d.startDate.slice(0, 10),
      endDate: d.endDate ? d.endDate.slice(0, 10) : "",
      maxRedemptions: d.maxRedemptions ?? "",
      maxPerCustomer: d.maxPerCustomer,
      note: d.note,
    });
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  function flash(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3500);
  }

  async function handleSave() {
    setFormError(null);
    if (!form.code.trim()) return setFormError("Promo code is required.");
    if (!form.percentage || form.percentage < 1 || form.percentage > 100)
      return setFormError("Discount must be 1–100%.");
    if (!form.startDate) return setFormError("Start date is required.");
    if (!form.endDate) return setFormError("End date is required.");
    if (new Date(form.startDate) >= new Date(form.endDate))
      return setFormError("End date must be after start date.");

    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      percentage: Number(form.percentage),
      active: form.active,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate + "T23:59:59").toISOString(),
      maxRedemptions: form.maxRedemptions === "" ? null : Number(form.maxRedemptions),
      maxPerCustomer: Number(form.maxPerCustomer),
      note: form.note,
    };

    const url = editingId ? `/api/admin/discounts/${editingId}` : "/api/admin/discounts";
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) return setFormError(data.error || "Save failed.");
    closeForm();
    await load();
    flash(editingId ? "Promo code updated." : "Promo code created.");
  }

  async function toggleActive(d: Discount) {
    const res = await fetch(`/api/admin/discounts/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !d.active }),
    });
    if (res.ok) {
      await load();
      flash(d.active ? "Promo code disabled." : "Promo code reactivated.");
    } else {
      const data = await res.json();
      setError(data.error || "Action failed.");
    }
  }

  async function handleDelete(d: Discount) {
    if (!confirm(`Delete promo code "${d.code}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/discounts/${d.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await load();
      flash("Promo code deleted.");
    } else {
      setError(data.error || "Delete failed.");
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-700 text-xl text-court-ink">Discounts &amp; Promo Codes</h2>
          <p className="text-sm text-court-ink/50 mt-0.5">Create and manage promotional codes for customers.</p>
        </div>
        <button
          onClick={openCreate}
          className="focus-ring rounded-full bg-court-orange text-white px-4 py-2 text-sm font-semibold hover:bg-court-orange-dark"
        >
          + New promo code
        </button>
      </div>

      {success && (
        <div className="rounded-xl border-2 border-green-300 bg-green-50 text-green-700 px-4 py-3 text-sm font-medium mb-4">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline text-red-600 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-court bg-white border-2 border-court-blue/20 shadow-court overflow-hidden">
        {loading ? (
          <p className="px-6 py-10 text-court-ink/50 text-center">Loading…</p>
        ) : discounts.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-court-ink/50 mb-1">No promo codes yet.</p>
            <p className="text-court-ink/40 text-sm">Create one to offer customers a discount at checkout.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-court-ink/10 bg-court-blue-light/10 text-left">
                  {["Promo Code", "Discount", "Source", "Status", "Start Date", "End Date", "Redemptions", "Remaining", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold text-court-ink/70 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-court-ink/5">
                {discounts.map((d) => {
                  const status = getStatus(d);
                  const remaining = d.maxRedemptions === null ? null : Math.max(0, d.maxRedemptions - d.redemptionCount);
                  return (
                    <tr key={d.id} className="hover:bg-court-blue-light/10">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-court-ink tracking-wider">{d.code}</span>
                        {d.note && <p className="text-xs text-court-ink/40 mt-0.5 max-w-[220px] truncate">{d.note}</p>}
                      </td>
                      <td className="px-4 py-3 text-court-orange-dark font-bold">{d.percentage}%</td>
                      <td className="px-4 py-3">
                        {d.source === "SPIN_WHEEL" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-court-orange/10 text-court-orange-dark border-court-orange/30">
                            🎡 Spin win
                          </span>
                        ) : (
                          <span className="inline-flex text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-court-blue-light/30 text-court-blue-dark border-court-blue/30">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-court-ink/60 whitespace-nowrap">{fmtDate(d.startDate)}</td>
                      <td className="px-4 py-3 text-court-ink/60 whitespace-nowrap">{d.endDate ? fmtDate(d.endDate) : "No expiry"}</td>
                      <td className="px-4 py-3 text-court-ink/70">{d.redemptionCount}</td>
                      <td className="px-4 py-3 text-court-ink/70">
                        {remaining === null ? <span className="text-court-ink/30">Unlimited</span> : remaining}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(d)} className="focus-ring text-xs font-semibold text-court-blue-dark hover:underline">
                            Edit
                          </button>
                          <button
                            onClick={() => toggleActive(d)}
                            className={`focus-ring text-xs font-semibold ${d.active ? "text-amber-600 hover:underline" : "text-green-600 hover:underline"}`}
                          >
                            {d.active ? "Disable" : "Enable"}
                          </button>
                          <button onClick={() => handleDelete(d)} className="focus-ring text-xs font-semibold text-red-500 hover:underline">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto overscroll-contain bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-court bg-white border-2 border-court-ink/10 shadow-court p-6">
            <h3 className="font-display font-700 text-lg text-court-ink mb-5">
              {editingId ? "Edit promo code" : "New promo code"}
            </h3>

            <div className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-court-ink/70 mb-1.5">
                  Promo Code <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") }))}
                  placeholder="e.g. WELCOME10"
                  className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 text-sm font-mono uppercase tracking-widest focus:outline-none focus:border-court-orange"
                  maxLength={30}
                />
                <p className="text-xs text-court-ink/40 mt-1">Letters, numbers, underscores, dashes only. Auto-uppercased.</p>
              </div>

              {/* Discount % */}
              <div>
                <label className="block text-sm font-medium text-court-ink/70 mb-1.5">
                  Discount Percentage (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.percentage}
                  onChange={(e) => setForm((f) => ({ ...f, percentage: Number(e.target.value) }))}
                  className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 text-sm focus:outline-none focus:border-court-orange"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-court-ink/70 mb-1.5">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 text-sm focus:outline-none focus:border-court-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-court-ink/70 mb-1.5">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 text-sm focus:outline-none focus:border-court-orange"
                  />
                </div>
              </div>

              {/* Redemption limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-court-ink/70 mb-1.5">Max Total Redemptions</label>
                  <input
                    type="number"
                    min={1}
                    value={form.maxRedemptions}
                    onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
                    placeholder="Unlimited"
                    className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 text-sm focus:outline-none focus:border-court-orange"
                  />
                  <p className="text-xs text-court-ink/40 mt-1">Leave empty for unlimited.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-court-ink/70 mb-1.5">Max Uses Per Customer</label>
                  <input
                    type="number"
                    min={1}
                    value={form.maxPerCustomer}
                    onChange={(e) => setForm((f) => ({ ...f, maxPerCustomer: Number(e.target.value) }))}
                    className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 text-sm focus:outline-none focus:border-court-orange"
                  />
                  <p className="text-xs text-court-ink/40 mt-1">Set to 1 for one-time use per email.</p>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-court-ink/70 mb-1.5">Note (admin-only, optional)</label>
                <input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Facebook promo, July"
                  className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 text-sm focus:outline-none focus:border-court-orange"
                  maxLength={300}
                />
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.active ? "bg-court-orange" : "bg-court-ink/20"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.active ? "translate-x-6" : "translate-x-1"}`}
                  />
                </div>
                <span className="text-sm font-medium text-court-ink/70">
                  {form.active ? "Active — customers can use this code" : "Inactive — code is disabled"}
                </span>
              </label>
            </div>

            {formError && (
              <div className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">{formError}</div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeForm}
                className="focus-ring rounded-full bg-white text-court-ink/70 border border-court-ink/15 px-4 py-2 text-sm font-semibold hover:bg-court-ink/5"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="focus-ring rounded-full bg-court-orange text-white px-5 py-2 text-sm font-semibold hover:bg-court-orange-dark disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Create code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Spin the wheel                                                          */
/* ---------------------------------------------------------------------- */

function SpinWheelSection() {
  const [settings, setSettings] = useState<SpinSettings>({ enabled: false, startDate: null });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [startDateInput, setStartDateInput] = useState("");

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [prizesLoading, setPrizesLoading] = useState(true);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);

  const [testEmail, setTestEmail] = useState("");
  const [testName, setTestName] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testErr, setTestErr] = useState<string | null>(null);
  const [lastTestLink, setLastTestLink] = useState<string | null>(null);

  async function loadSettings() {
    setSettingsLoading(true);
    const res = await fetch("/api/admin/spin-wheel/settings", { cache: "no-store" });
    const data = await res.json();
    setSettings(data.settings);
    setStartDateInput(data.settings?.startDate ? data.settings.startDate.slice(0, 10) : "");
    setSettingsLoading(false);
  }

  async function loadPrizes() {
    setPrizesLoading(true);
    const res = await fetch("/api/admin/spin-wheel/prizes", { cache: "no-store" });
    const data = await res.json();
    setPrizes(data.prizes || []);
    setPrizesLoading(false);
  }

  async function loadInvites() {
    setInvitesLoading(true);
    const res = await fetch("/api/admin/spin-wheel/invites", { cache: "no-store" });
    const data = await res.json();
    setInvites(data.invites || []);
    setInvitesLoading(false);
  }

  useEffect(() => {
    loadSettings();
    loadPrizes();
    loadInvites();
  }, []);

  async function toggleEnabled() {
    setSavingSettings(true);
    const res = await fetch("/api/admin/spin-wheel/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !settings.enabled }),
    });
    const data = await res.json();
    if (res.ok) setSettings(data.settings);
    setSavingSettings(false);
  }

  async function saveStartDate() {
    setSavingSettings(true);
    const res = await fetch("/api/admin/spin-wheel/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: startDateInput || null }),
    });
    const data = await res.json();
    if (res.ok) setSettings(data.settings);
    setSavingSettings(false);
  }

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();
    setTestErr(null);
    setTestMsg(null);
    setLastTestLink(null);
    setSendingTest(true);
    try {
      const res = await fetch("/api/admin/spin-wheel/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, customerName: testName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send test invite.");
      setTestMsg(`Test spin invite sent to ${testEmail}. Test links always work, even while the wheel is off.`);
      if (data.invite?.token && typeof window !== "undefined") {
        setLastTestLink(`${window.location.origin}/spin/${data.invite.token}`);
      }
      setTestEmail("");
      setTestName("");
      await loadInvites();
    } catch (err: any) {
      setTestErr(err.message);
    } finally {
      setSendingTest(false);
    }
  }

  const totalWeight = prizes.filter((p) => p.active).reduce((s, p) => s + p.weight, 0);
  const noActivePrizes = !prizesLoading && prizes.filter((p) => p.active).length === 0;

  return (
    <div className="space-y-6">
      {/* Launch control */}
      <div className="rounded-court bg-gradient-to-br from-court-blue-dark to-court-ink text-white shadow-court-lg p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -right-2 top-10 h-16 w-16 rounded-full bg-white/5" />
        <h3 className="font-display font-600 text-lg mb-1 flex items-center gap-2">
          <span aria-hidden>🎡</span> Launch control
        </h3>
        <p className="text-sm text-white/70 mb-4 max-w-xl">
          Keep it off while you set up prizes and test it — customers only start getting spin invite emails once
          it&apos;s turned on. Test invites always work regardless of this switch.
        </p>

        <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 backdrop-blur px-4 py-3 mb-4">
          <div>
            <p className="font-semibold text-sm flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${settings.enabled ? "bg-green-400 animate-pulse" : "bg-white/30"}`} />
              {settings.enabled ? "Live" : "Off"}
            </p>
            <p className="text-xs text-white/60 mt-0.5">
              {settings.enabled
                ? "Finished bookings that qualify are being emailed a spin invite."
                : "No invite emails are going out to real customers."}
            </p>
          </div>
          <button
            onClick={toggleEnabled}
            disabled={settingsLoading || savingSettings || noActivePrizes}
            title={noActivePrizes ? "Add at least one active prize first" : undefined}
            className={`focus-ring relative h-8 w-14 rounded-full transition-colors disabled:opacity-40 ${
              settings.enabled ? "bg-green-500" : "bg-white/20"
            }`}
            aria-label="Toggle spin wheel launch"
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                settings.enabled ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {noActivePrizes && (
          <p className="text-xs text-amber-200 mb-4 -mt-2">Add at least one active prize below before going live.</p>
        )}

        <label className="text-sm block">
          <span className="block mb-1 font-medium text-white/80">Only invite customers whose booking date is on or after</span>
          <div className="flex gap-2">
            <input
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              className="rounded-xl border-2 border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 [color-scheme:dark]"
            />
            <button
              onClick={saveStartDate}
              disabled={savingSettings}
              className="focus-ring rounded-full bg-court-orange text-white px-4 py-2 text-sm font-semibold hover:bg-court-orange-dark disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <span className="block mt-1 text-xs text-white/50">Leave blank to make every finished booking eligible once the feature is live.</span>
        </label>
      </div>

      {/* Prizes */}
      <PrizesEditor prizes={prizes} loading={prizesLoading} totalWeight={totalWeight} onChanged={loadPrizes} />

      {/* Test send */}
      <form onSubmit={sendTest} className="rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Test the flow</h3>
        <p className="text-sm text-court-ink/60 mb-4">
          Sends a real spin invite to an email you control, so you can try the whole thing — email, wheel, and
          result — before turning it on for customers. Test links work even while the wheel is off.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Email to test with</span>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2"
              required
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Name (optional)</span>
            <input
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="Test player"
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2"
            />
          </label>
        </div>
        {testErr && <p className="text-sm text-red-600 mt-3">{testErr}</p>}
        {testMsg && <p className="text-sm text-green-600 mt-3">{testMsg}</p>}
        {lastTestLink && (
          <p className="text-xs text-court-ink/60 mt-2 break-all">
            Link:{" "}
            <a href={lastTestLink} target="_blank" rel="noreferrer" className="text-court-blue-dark underline">
              {lastTestLink}
            </a>
          </p>
        )}
        <button
          type="submit"
          disabled={sendingTest || noActivePrizes}
          className="focus-ring mt-4 rounded-full bg-court-blue-dark text-white px-6 py-2.5 font-semibold hover:brightness-95 disabled:opacity-50"
        >
          {sendingTest ? "Sending…" : "Send test spin invite"}
        </button>
      </form>

      {/* Recent invites */}
      <div>
        <h3 className="font-display font-600 text-lg text-court-ink mb-3">Recent invites</h3>
        {invitesLoading ? (
          <p className="text-court-ink/50">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-court-ink/50 italic text-sm">No spin invites sent yet.</p>
        ) : (
          <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court overflow-hidden">
            <div className="divide-y divide-court-ink/10 max-h-[420px] overflow-y-auto">
              {invites.map((inv) => (
                <div key={inv.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <span className="font-semibold text-court-ink">{inv.email}</span>
                    {inv.isTest && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-court-orange/10 text-court-orange-dark border-court-orange/30">
                        Test
                      </span>
                    )}
                    <p className="text-xs text-court-ink/50">Sent {fmtDateTime(inv.sentAt)}</p>
                  </div>
                  <div className="text-right">
                    {inv.spunAt ? (
                      <>
                        <p className="text-court-ink/80">{inv.prize?.label ?? "—"}</p>
                        {inv.discount ? (
                          <p className="text-xs text-green-600 font-semibold">
                            Won {inv.discount.percentage}% — {inv.discount.code}
                          </p>
                        ) : (
                          <p className="text-xs text-court-ink/40">No prize</p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-court-ink/40 italic">Not spun yet</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PrizesEditor({
  prizes,
  loading,
  totalWeight,
  onChanged,
}: {
  prizes: Prize[];
  loading: boolean;
  totalWeight: number;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState("");
  const [percentage, setPercentage] = useState("10");
  const [weight, setWeight] = useState("10");
  const [color, setColor] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editPercentage, setEditPercentage] = useState("0");
  const [editWeight, setEditWeight] = useState("10");
  const [editColor, setEditColor] = useState(SWATCHES[0]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  const activePrizes = prizes.filter((p) => p.active);
  const previewWeight = activePrizes.reduce((s, p) => s + p.weight, 0);

  // Mini circular preview of the actual wheel — conic-gradient slices sized
  // by weight, in the same order the prizes will appear on the real wheel.
  const wheelPreviewStyle = useMemo(() => {
    if (activePrizes.length === 0 || previewWeight === 0) {
      return { background: "repeating-conic-gradient(#e9e4da 0deg 18deg, #f4f1ea 18deg 36deg)" };
    }
    let acc = 0;
    const stops: string[] = [];
    activePrizes.forEach((p) => {
      const start = (acc / previewWeight) * 360;
      acc += p.weight;
      const end = (acc / previewWeight) * 360;
      stops.push(`${p.color || "#888"} ${start}deg ${end}deg`);
    });
    return { background: `conic-gradient(${stops.join(", ")})` };
  }, [activePrizes, previewWeight]);

  function applyPreset(preset: (typeof PRIZE_PRESETS)[number], usedColors: string[]) {
    setLabel(preset.label);
    setPercentage(String(preset.percentage));
    setWeight(String(preset.weight));
    const unused = SWATCHES.find((sw) => !usedColors.includes(sw));
    if (unused) setColor(unused);
  }

  async function addPrize(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) return setError("Give the prize a label.");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/spin-wheel/prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), percentage: Number(percentage), weight: Number(weight), color }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add prize.");
      setLabel("");
      setPercentage("10");
      setWeight("10");
      // Cycle to a colour not already used by an active prize, so newly
      // added prizes don't default to the same colour as the last one.
      const used = prizes.map((p) => p.color);
      const nextColor = SWATCHES.find((sw) => !used.includes(sw)) || SWATCHES[0];
      setColor(nextColor);
      onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updatePrize(id: string, data: Partial<Prize>) {
    await fetch(`/api/admin/spin-wheel/prizes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    onChanged();
  }

  async function toggleActive(p: Prize) {
    setBusyId(p.id);
    try {
      await updatePrize(p.id, { active: !p.active });
    } finally {
      setBusyId(null);
    }
  }

  async function removePrize(p: Prize) {
    if (!confirm(`Remove prize "${p.label}"?`)) return;
    setBusyId(p.id);
    try {
      await fetch(`/api/admin/spin-wheel/prizes/${p.id}`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function duplicatePrize(p: Prize) {
    setBusyId(p.id);
    try {
      await fetch("/api/admin/spin-wheel/prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: `${p.label} (copy)`, percentage: p.percentage, weight: p.weight, color: p.color }),
      });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function move(p: Prize, dir: -1 | 1) {
    const idx = prizes.findIndex((x) => x.id === p.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= prizes.length) return;
    const other = prizes[swapIdx];
    setBusyId(p.id);
    try {
      await Promise.all([
        fetch(`/api/admin/spin-wheel/prizes/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: other.order }),
        }),
        fetch(`/api/admin/spin-wheel/prizes/${other.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: p.order }),
        }),
      ]);
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(p: Prize) {
    setEditingId(p.id);
    setEditLabel(p.label);
    setEditPercentage(String(p.percentage));
    setEditWeight(String(p.weight));
    setEditColor(p.color);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(id: string) {
    setEditError(null);
    if (!editLabel.trim()) return setEditError("Label can't be empty.");
    const pct = Number(editPercentage);
    const w = Number(editWeight);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return setEditError("Discount must be 0–100%.");
    if (!Number.isFinite(w) || w < 1 || w > 100) return setEditError("Chance must be 1–100.");
    setEditSaving(true);
    try {
      await updatePrize(id, { label: editLabel.trim(), percentage: pct, weight: w, color: editColor });
      setEditingId(null);
    } finally {
      setEditSaving(false);
    }
  }

  // Live estimate of what the new prize's odds would look like once added,
  // so the admin can see its impact before committing.
  const newWeightNum = Number(weight) || 0;
  const projectedTotal = totalWeight + newWeightNum;
  const projectedShare = projectedTotal > 0 ? Math.round((newWeightNum / projectedTotal) * 100) : 0;
  const usedColors = prizes.map((p) => p.color);

  return (
    <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-5 sm:p-6">
      <h3 className="font-display font-600 text-lg text-court-ink mb-1">Prizes</h3>
      <p className="text-sm text-court-ink/60 mb-4">
        Each prize is a wedge on the wheel. Set its discount percentage (0 = no prize / try again) and its chance —
        higher chance numbers are relatively more likely to be picked, weighed against the other active prizes.
      </p>

      {prizes.length > 0 && (
        <div className="mb-5 flex flex-col sm:flex-row items-center sm:items-start gap-5 rounded-xl border-2 border-court-ink/10 bg-court-blue-light/10 p-4">
          {/* Live circular wheel preview */}
          <div className="flex-shrink-0 relative h-28 w-28">
            <div className="h-28 w-28 rounded-full border-4 border-white shadow-court" style={wheelPreviewStyle} />
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <span className="h-6 w-6 rounded-full bg-white border border-court-ink/10 shadow" />
            </div>
          </div>
          <div className="flex-1 w-full">
            <p className="text-xs font-semibold text-court-ink/70 mb-2">Live wheel preview — updates as you edit prizes below</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {activePrizes.length === 0 ? (
                <p className="text-xs text-court-ink/40 italic">No active prizes yet.</p>
              ) : (
                activePrizes.map((p) => {
                  const share = previewWeight > 0 ? Math.round((p.weight / previewWeight) * 100) : 0;
                  return (
                    <span key={p.id} className="inline-flex items-center gap-1.5 text-xs text-court-ink/70">
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      {p.label} <span className="text-court-ink/40">~{share}%</span>
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {prizes.length > 0 && (
        <div className="space-y-2 mb-5">
          {prizes.map((p, i) => {
            const share = p.active && totalWeight > 0 ? Math.round((p.weight / totalWeight) * 100) : 0;
            const isEditing = editingId === p.id;
            const isBusy = busyId === p.id;
            return (
              <div
                key={p.id}
                className={`rounded-xl border-2 ${isEditing ? "border-court-blue-dark/40 bg-court-blue-light/10" : p.active ? "border-court-ink/10" : "border-gray-200 opacity-60"}`}
              >
                {isEditing ? (
                  <div className="p-3.5">
                    <div className="grid sm:grid-cols-4 gap-3">
                      <label className="text-sm sm:col-span-2">
                        <span className="block mb-1 font-medium text-court-ink/80">Label</span>
                        <input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="block mb-1 font-medium text-court-ink/80">Discount %</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={editPercentage}
                            onChange={(e) => setEditPercentage(e.target.value)}
                            className="flex-1 accent-court-orange"
                          />
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={editPercentage}
                            onChange={(e) => setEditPercentage(e.target.value)}
                            className="w-14 rounded-lg border-2 border-court-ink/15 px-2 py-1 text-sm"
                          />
                        </div>
                      </label>
                      <label className="text-sm">
                        <span className="block mb-1 font-medium text-court-ink/80">Chance</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={1}
                            max={100}
                            value={editWeight}
                            onChange={(e) => setEditWeight(e.target.value)}
                            className="flex-1 accent-court-orange"
                          />
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={editWeight}
                            onChange={(e) => setEditWeight(e.target.value)}
                            className="w-14 rounded-lg border-2 border-court-ink/15 px-2 py-1 text-sm"
                          />
                        </div>
                      </label>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs font-medium text-court-ink/70">Color</span>
                      {SWATCHES.map((sw) => (
                        <button
                          key={sw}
                          type="button"
                          onClick={() => setEditColor(sw)}
                          className={`h-6 w-6 rounded-full border-2 ${editColor === sw ? "border-court-ink" : "border-transparent"}`}
                          style={{ background: sw }}
                          aria-label={sw}
                        />
                      ))}
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="h-6 w-6 rounded-full border-2 border-transparent cursor-pointer bg-transparent"
                        title="Custom color"
                      />
                    </div>
                    {editError && <p className="text-xs text-red-600 mt-2">{editError}</p>}
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => saveEdit(p.id)}
                        disabled={editSaving}
                        className="focus-ring rounded-full bg-court-orange text-white px-4 py-1.5 text-xs font-semibold hover:bg-court-orange-dark disabled:opacity-50"
                      >
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="focus-ring rounded-full bg-white text-court-ink/70 border border-court-ink/15 px-4 py-1.5 text-xs font-semibold hover:bg-court-ink/5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    {/* Reorder arrows */}
                    <div className="flex flex-col -my-1">
                      <button
                        type="button"
                        onClick={() => move(p, -1)}
                        disabled={i === 0 || isBusy}
                        aria-label="Move up"
                        className="focus-ring text-court-ink/30 hover:text-court-ink/70 disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => move(p, 1)}
                        disabled={i === prizes.length - 1 || isBusy}
                        aria-label="Move down"
                        className="focus-ring text-court-ink/30 hover:text-court-ink/70 disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                    <span className="h-5 w-5 rounded-full flex-shrink-0 border border-black/10" style={{ background: p.color }} />
                    <div className="flex-1 min-w-[140px]">
                      <p className="font-semibold text-court-ink text-sm">{p.label}</p>
                      <p className="text-xs text-court-ink/50">
                        {p.percentage > 0 ? `${p.percentage}% off` : "No prize"} · {p.active ? `~${share}% chance` : "Inactive"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      disabled={isBusy}
                      className="text-xs font-semibold text-court-ink/60 hover:underline focus-ring disabled:opacity-40"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicatePrize(p)}
                      disabled={isBusy}
                      className="text-xs font-semibold text-court-ink/60 hover:underline focus-ring disabled:opacity-40"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(p)}
                      disabled={isBusy}
                      className="text-xs font-semibold text-court-blue-dark hover:underline focus-ring disabled:opacity-40"
                    >
                      {p.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removePrize(p)}
                      disabled={isBusy}
                      className="text-xs font-semibold text-red-500 hover:underline focus-ring disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!loading && prizes.length === 0 && (
        <p className="text-court-ink/50 italic text-sm mb-5">No prizes yet — add at least one below before turning the wheel on.</p>
      )}

      <form onSubmit={addPrize} className="border-t border-court-ink/10 pt-4">
        <p className="text-sm font-semibold text-court-ink mb-1">Add a prize</p>
        <p className="text-xs text-court-ink/50 mb-3">Start from a quick preset, or fill in your own below.</p>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PRIZE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset, usedColors)}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border-2 border-court-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-court-ink/80 hover:border-court-orange/40 hover:text-court-ink transition-colors"
            >
              <span aria-hidden>{preset.emoji}</span> {preset.label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Label</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. 20% off or Better luck next time"
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Color</span>
            <div className="flex items-center gap-2 h-[38px]">
              {SWATCHES.map((sw) => (
                <button
                  key={sw}
                  type="button"
                  onClick={() => setColor(sw)}
                  className={`h-6 w-6 rounded-full border-2 flex-shrink-0 ${color === sw ? "border-court-ink" : "border-transparent"}`}
                  style={{ background: sw }}
                  aria-label={sw}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-6 w-6 rounded-full border-2 border-transparent cursor-pointer bg-transparent flex-shrink-0"
                title="Custom color"
              />
            </div>
          </label>
          <label className="text-sm">
            <span className="flex items-center justify-between mb-1">
              <span className="font-medium text-court-ink/80">Discount %</span>
              <span className="text-xs text-court-ink/40">0 = no prize</span>
            </span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                className="flex-1 accent-court-orange"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                className="w-16 rounded-xl border-2 border-court-ink/15 px-2 py-2 text-sm"
                required
              />
            </div>
          </label>
          <label className="text-sm">
            <span className="flex items-center justify-between mb-1">
              <span className="font-medium text-court-ink/80">Chance</span>
              <span className="text-xs text-court-ink/40">~{projectedShare}% of spins</span>
            </span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="flex-1 accent-court-orange"
              />
              <input
                type="number"
                min={1}
                max={100}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-16 rounded-xl border-2 border-court-ink/15 px-2 py-2 text-sm"
                required
              />
            </div>
          </label>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="focus-ring mt-4 rounded-full bg-court-orange text-white px-6 py-2 text-sm font-semibold hover:bg-court-orange-dark disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add prize"}
        </button>
      </form>
    </div>
  );
}
