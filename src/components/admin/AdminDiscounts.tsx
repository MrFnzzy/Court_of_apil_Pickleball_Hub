"use client";

import { useCallback, useEffect, useState } from "react";

type PromoCode = {
  id: string;
  code: string;
  discountPercent: number;
  active: boolean;
  startDate: string;
  endDate: string;
  maxRedemptions: number | null;
  maxPerCustomer: number;
  totalRedemptions: number;
  _count: { redemptions: number };
  createdAt: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatus(code: PromoCode): { label: string; cls: string } {
  const now = new Date();
  if (!code.active) return { label: "Inactive", cls: "bg-gray-100 text-gray-500 border-gray-300" };
  if (now > new Date(code.endDate)) return { label: "Expired", cls: "bg-red-100 text-red-600 border-red-300" };
  if (now < new Date(code.startDate)) return { label: "Scheduled", cls: "bg-blue-100 text-blue-600 border-blue-300" };
  if (code.maxRedemptions !== null && code._count.redemptions >= code.maxRedemptions)
    return { label: "Limit reached", cls: "bg-amber-100 text-amber-700 border-amber-300" };
  return { label: "Active", cls: "bg-green-100 text-green-700 border-green-300" };
}

const EMPTY_FORM = {
  code: "",
  discountPercent: 10,
  active: true,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  maxRedemptions: "" as string | number,
  maxPerCustomer: 1,
};

export default function AdminDiscounts() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
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
    setCodes(data.codes || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(c: PromoCode) {
    setEditingId(c.id);
    setForm({
      code: c.code,
      discountPercent: c.discountPercent,
      active: c.active,
      startDate: c.startDate.slice(0, 10),
      endDate: c.endDate.slice(0, 10),
      maxRedemptions: c.maxRedemptions ?? "",
      maxPerCustomer: c.maxPerCustomer,
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
    if (!form.discountPercent || form.discountPercent < 1 || form.discountPercent > 100)
      return setFormError("Discount must be 1–100%.");
    if (!form.startDate) return setFormError("Start date is required.");
    if (!form.endDate) return setFormError("End date is required.");
    if (new Date(form.startDate) >= new Date(form.endDate))
      return setFormError("End date must be after start date.");

    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      discountPercent: Number(form.discountPercent),
      active: form.active,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate + "T23:59:59").toISOString(),
      maxRedemptions: form.maxRedemptions === "" ? null : Number(form.maxRedemptions),
      maxPerCustomer: Number(form.maxPerCustomer),
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

  async function toggleActive(c: PromoCode) {
    const res = await fetch(`/api/admin/discounts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    if (res.ok) { await load(); flash(c.active ? "Promo code disabled." : "Promo code reactivated."); }
    else { const d = await res.json(); setError(d.error || "Action failed."); }
  }

  async function handleDelete(c: PromoCode) {
    if (!confirm(`Delete promo code "${c.code}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/discounts/${c.id}`, { method: "DELETE" });
    if (res.ok) { await load(); flash("Promo code deleted."); }
    else { const d = await res.json(); setError(d.error || "Delete failed."); }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-700 text-xl text-court-ink">Discounts & Promo Codes</h2>
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
          <button onClick={() => setError(null)} className="ml-3 underline text-red-600 text-xs">Dismiss</button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-court bg-white border-2 border-court-blue/20 shadow-court overflow-hidden">
        {loading ? (
          <p className="px-6 py-10 text-court-ink/50 text-center">Loading…</p>
        ) : codes.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-court-ink/40 italic mb-3">No promo codes yet.</p>
            <button onClick={openCreate} className="text-sm font-semibold text-court-orange hover:underline">
              Create your first promo code →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-court-ink/5 border-b border-court-ink/10">
                  {["Promo Code", "Discount", "Status", "Start Date", "End Date", "Redemptions", "Remaining", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-court-ink/50 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-court-ink/5">
                {codes.map((c) => {
                  const status = getStatus(c);
                  const used = c._count.redemptions;
                  const remaining = c.maxRedemptions !== null ? c.maxRedemptions - used : null;
                  return (
                    <tr key={c.id} className="hover:bg-court-blue-light/10">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-court-ink tracking-wider">{c.code}</span>
                      </td>
                      <td className="px-4 py-3 text-court-orange-dark font-bold">{c.discountPercent}%</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-court-ink/60 whitespace-nowrap">{fmtDate(c.startDate)}</td>
                      <td className="px-4 py-3 text-court-ink/60 whitespace-nowrap">{fmtDate(c.endDate)}</td>
                      <td className="px-4 py-3 text-court-ink/70">{used}</td>
                      <td className="px-4 py-3 text-court-ink/70">
                        {remaining === null ? <span className="text-court-ink/30">Unlimited</span> : remaining}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(c)}
                            className="focus-ring text-xs font-semibold text-court-blue-dark hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleActive(c)}
                            className={`focus-ring text-xs font-semibold ${c.active ? "text-amber-600 hover:underline" : "text-green-600 hover:underline"}`}
                          >
                            {c.active ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="focus-ring text-xs font-semibold text-red-500 hover:underline"
                          >
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
                  value={form.discountPercent}
                  onChange={(e) => setForm((f) => ({ ...f, discountPercent: Number(e.target.value) }))}
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
                  <label className="block text-sm font-medium text-court-ink/70 mb-1.5">
                    Max Total Redemptions
                  </label>
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
                  <label className="block text-sm font-medium text-court-ink/70 mb-1.5">
                    Max Uses Per Customer
                  </label>
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
              <div className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">
                {formError}
              </div>
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
