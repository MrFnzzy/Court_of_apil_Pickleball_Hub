"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Account = {
  id: string;
  method: "GCASH" | "MAYA" | "BPI";
  accountName: string;
  accountNumber: string;
  qrImageUrl: string | null;
  active: boolean;
};

export default function AdminPaymentAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [method, setMethod] = useState<"GCASH" | "MAYA" | "BPI">("GCASH");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/payment-accounts");
    const data = await res.json();
    setAccounts(data.accounts || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accountName || !accountNumber) {
      setError("Account name and number are required.");
      return;
    }
    setSaving(true);
    try {
      let qrImageUrl: string | undefined;
      if (qrFile) {
        const fd = new FormData();
        fd.append("file", qrFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "QR upload failed.");
        qrImageUrl = uploadData.url;
      }

      const res = await fetch("/api/admin/payment-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, accountName, accountNumber, qrImageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add account.");

      setAccountName("");
      setAccountNumber("");
      setQrFile(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(acc: Account) {
    await fetch(`/api/admin/payment-accounts/${acc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !acc.active }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this payment account?")) return;
    await fetch(`/api/admin/payment-accounts/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="rounded-court bg-white border-2 border-court-orange/30 shadow-court p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-4">Add payment account</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as any)} className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2">
              <option value="GCASH">GCash</option>
              <option value="MAYA">Maya</option>
              <option value="BPI">BPI</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Account name</span>
            <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Account number</span>
            <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">QR code image (optional)</span>
            <input type="file" accept="image/*" onChange={(e) => setQrFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          </label>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        <button type="submit" disabled={saving} className="focus-ring mt-4 rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50">
          {saving ? "Saving…" : "Add account"}
        </button>
      </form>

      <div>
        <h3 className="font-display font-600 text-lg text-court-ink mb-4">Current accounts</h3>
        {loading ? (
          <p className="text-court-ink/50">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-court-ink/50 italic">No payment accounts added yet. Customers won&apos;t see any payment options until you add one.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {accounts.map((acc) => (
              <div key={acc.id} className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-4 flex gap-3">
                {acc.qrImageUrl && (
                  <div className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border">
                    <Image src={acc.qrImageUrl} alt="" fill className="object-cover" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-display font-600 text-court-ink text-sm">{acc.method} — {acc.accountName}</p>
                  <p className="font-mono text-sm text-court-ink/70">{acc.accountNumber}</p>
                  <div className="flex gap-3 mt-2">
                    <button onClick={() => toggleActive(acc)} className="text-xs font-semibold text-court-blue-dark hover:underline focus-ring">
                      {acc.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => remove(acc.id)} className="text-xs font-semibold text-red-500 hover:underline focus-ring">
                      Remove
                    </button>
                  </div>
                </div>
                {!acc.active && <span className="text-[10px] h-fit uppercase font-bold text-gray-400 border border-gray-300 rounded-full px-2 py-0.5">Inactive</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
