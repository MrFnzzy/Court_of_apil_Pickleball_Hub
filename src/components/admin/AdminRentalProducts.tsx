"use client";

import { useEffect, useState } from "react";
import { productLabel, RentalProduct, RentalProductType } from "@/lib/pricing";

type DraftProduct = { quantity: string; price: string; label: string };

const EMPTY_DRAFT: DraftProduct = { quantity: "", price: "", label: "" };

function TypeSection({
  type,
  title,
  products,
  onChanged,
}: {
  type: RentalProductType;
  title: string;
  products: RentalProduct[];
  onChanged: () => void;
}) {
  const items = products
    .filter((p) => p.type === type)
    .sort((a, b) => a.order - b.order || a.quantity - b.quantity);

  const [draft, setDraft] = useState<DraftProduct>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const quantity = Number(draft.quantity);
    const price = Number(draft.price);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setAddError("Enter a whole number of 1 or more for the amount.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setAddError("Enter a valid price.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/rental-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, quantity, price, label: draft.label.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add product.");
      setDraft(EMPTY_DRAFT);
      onChanged();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function patchProduct(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setRowError(null);
    try {
      const res = await fetch(`/api/admin/rental-products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update product.");
      onChanged();
    } catch (err: any) {
      setRowError({ id, message: err.message });
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProduct(id: string, label: string) {
    if (!confirm(`Remove "${label}"? This can't be undone (past bookings keep their own recorded price).`)) return;
    setBusyId(id);
    setRowError(null);
    try {
      const res = await fetch(`/api/admin/rental-products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete product.");
      onChanged();
    } catch (err: any) {
      setRowError({ id, message: err.message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h4 className="font-display font-600 text-court-ink mb-3">{title}</h4>

      {items.length === 0 ? (
        <p className="text-sm text-court-ink/50 mb-4">No tiers yet — add one below.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {items.map((p) => (
            <div
              key={p.id}
              className={`rounded-xl border-2 px-3 py-2.5 ${
                p.active ? "border-court-ink/10" : "border-court-ink/10 opacity-50"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm text-court-ink/90 min-w-[6rem]">{productLabel(p)}</span>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-court-ink/50">₱</span>
                  <input
                    defaultValue={p.price}
                    onBlur={(e) => {
                      const num = Number(e.target.value.replace(/[^\d.]/g, ""));
                      if (Number.isFinite(num) && num >= 0 && num !== p.price) patchProduct(p.id, { price: num });
                    }}
                    inputMode="numeric"
                    disabled={busyId === p.id}
                    className="w-20 rounded-lg border-2 border-court-ink/15 pl-5 pr-2 py-1 text-sm focus-ring"
                  />
                </div>
                <input
                  defaultValue={p.label ?? ""}
                  placeholder="Custom label (optional)"
                  onBlur={(e) => {
                    if (e.target.value !== (p.label ?? "")) patchProduct(p.id, { label: e.target.value || null });
                  }}
                  disabled={busyId === p.id}
                  className="flex-1 min-w-[9rem] rounded-lg border-2 border-court-ink/15 px-2 py-1 text-sm focus-ring"
                />
                <button
                  type="button"
                  onClick={() => patchProduct(p.id, { active: !p.active })}
                  disabled={busyId === p.id}
                  className={`focus-ring rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    p.active
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-court-ink/10 text-court-ink/50 hover:bg-court-ink/15"
                  }`}
                >
                  {p.active ? "Active" : "Hidden"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteProduct(p.id, productLabel(p))}
                  disabled={busyId === p.id}
                  className="focus-ring rounded-full h-7 w-7 inline-flex items-center justify-center text-court-ink/40 hover:text-red-600 hover:bg-red-50"
                  aria-label={`Delete ${productLabel(p)}`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {rowError?.id === p.id && <p className="text-xs text-red-600 mt-1.5">{rowError.message}</p>}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 rounded-xl border-2 border-dashed border-court-ink/15 p-3">
        <label className="text-xs">
          <span className="block mb-1 font-medium text-court-ink/70">Amount</span>
          <input
            value={draft.quantity}
            onChange={(e) => setDraft({ ...draft, quantity: e.target.value.replace(/[^\d]/g, "") })}
            inputMode="numeric"
            placeholder="e.g. 3"
            className="w-20 rounded-lg border-2 border-court-ink/15 px-2 py-1.5 text-sm focus-ring"
          />
        </label>
        <label className="text-xs">
          <span className="block mb-1 font-medium text-court-ink/70">Price</span>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-court-ink/50">₱</span>
            <input
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d.]/g, "") })}
              inputMode="numeric"
              placeholder="e.g. 200"
              className="w-24 rounded-lg border-2 border-court-ink/15 pl-5 pr-2 py-1.5 text-sm focus-ring"
            />
          </div>
        </label>
        <label className="text-xs flex-1 min-w-[9rem]">
          <span className="block mb-1 font-medium text-court-ink/70">Label (optional)</span>
          <input
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder={`e.g. "${type === "PADDLE" ? "3 Paddles" : "5 Balls"}"`}
            className="w-full rounded-lg border-2 border-court-ink/15 px-2 py-1.5 text-sm focus-ring"
          />
        </label>
        <button
          type="submit"
          disabled={adding}
          className="focus-ring rounded-full bg-court-orange text-white px-4 py-1.5 text-sm font-semibold hover:bg-court-orange-dark disabled:opacity-50"
        >
          {adding ? "Adding…" : "+ Add tier"}
        </button>
      </form>
      {addError && <p className="text-xs text-red-600 mt-2">{addError}</p>}
    </div>
  );
}

export default function AdminRentalProducts() {
  const [products, setProducts] = useState<RentalProduct[] | null>(null);
  const [loading, setLoading] = useState(true);

  function reload() {
    fetch("/api/admin/rental-products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  if (loading || !products) {
    return <p className="text-court-ink/50">Loading rental tiers…</p>;
  }

  return (
    <div className="rounded-court glass-panel p-5 sm:p-6 max-w-2xl">
      <h3 className="font-display font-600 text-lg text-court-ink mb-1">Paddle &amp; ball rentals</h3>
      <p className="text-sm text-court-ink/60 mb-6">
        Add as many tiers as you want per product — every new tier shows up automatically on the homepage pricing
        cards, the customer booking wizard, and this Add/Edit booking form. Toggle a tier to "Hidden" to pull it from
        sale without losing its history; delete to remove it entirely.
      </p>

      <div className="space-y-8">
        <TypeSection type="PADDLE" title="Paddles" products={products} onChanged={reload} />
        <TypeSection type="BALL" title="Balls" products={products} onChanged={reload} />
      </div>
    </div>
  );
}
