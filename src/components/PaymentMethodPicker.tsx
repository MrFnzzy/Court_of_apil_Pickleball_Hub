"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type Account = {
  id: string;
  method: "GCASH" | "MAYA" | "BPI";
  accountName: string;
  accountNumber: string;
  qrImageUrl: string | null;
  checkoutUrl: string | null;
};

const METHOD_META: Record<string, { label: string; color: string }> = {
  GCASH: { label: "GCash", color: "bg-[#007DFE]" },
  MAYA: { label: "Maya", color: "bg-[#00C36F]" },
  BPI: { label: "BPI", color: "bg-[#B01B23]" },
};

export default function PaymentMethodPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (method: string) => void;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadAccounts = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    // No cache: "no-store" here — this route is statically generated and
    // only changes on redeploy, so the normal browser/CDN cache is fine.
    fetch("/api/payment-accounts")
      .then((r) => {
        if (!r.ok) throw new Error("Request failed");
        return r.json();
      })
      .then((d) => setAccounts(d.accounts || []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const selectedAccount = accounts.find((a) => a.method === value);

  if (loading) {
    return <div className="h-24 rounded-xl bg-court-ink/5 animate-pulse" />;
  }

  if (loadError) {
    return (
      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-center">
        <p className="text-sm text-red-700 mb-2">Couldn&apos;t load payment options. Please check your connection.</p>
        <button
          type="button"
          onClick={loadAccounts}
          className="focus-ring rounded-full bg-red-600 text-white px-4 py-1.5 text-sm font-semibold hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {(["GCASH", "MAYA", "BPI"] as const).map((m) => {
          const meta = METHOD_META[m];
          const has = accounts.some((a) => a.method === m);
          return (
            <button
              type="button"
              key={m}
              disabled={!has}
              onClick={() => onChange(m)}
              className={`focus-ring rounded-xl border-2 px-3 py-3 text-center font-semibold text-sm transition-all disabled:opacity-30 ${
                value === m
                  ? "border-court-orange bg-court-orange/10 shadow-court"
                  : "border-court-ink/10 bg-white hover:border-court-blue-dark/40"
              }`}
            >
              <span className={`mx-auto mb-1 block h-2.5 w-2.5 rounded-full ${meta.color}`} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {selectedAccount && (
        <div className="mt-4 rounded-xl border-2 border-court-blue/30 bg-court-blue-light/20 p-4">
          {selectedAccount.checkoutUrl && (
            <a
              href={selectedAccount.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring mb-4 flex items-center justify-center gap-2 rounded-xl bg-court-orange text-white px-4 py-3 font-semibold hover:bg-court-orange-dark"
            >
              Pay with {METHOD_META[selectedAccount.method].label}
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M7 17L17 7M7 7h10v10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
          <div className="flex items-center gap-4 flex-wrap">
            {selectedAccount.qrImageUrl && (
              <div className="relative h-24 w-24 shrink-0 rounded-lg overflow-hidden border-2 border-white shadow">
                <Image src={selectedAccount.qrImageUrl} alt={`${selectedAccount.accountName} QR code`} fill className="object-cover" />
              </div>
            )}
            <div className="text-sm">
              <p className="text-court-ink/60">
                {selectedAccount.checkoutUrl ? "Or send payment manually to" : "Send payment to"}
              </p>
              <p className="font-display font-600 text-court-ink">{selectedAccount.accountName}</p>
              <p className="font-mono text-court-ink text-base tracking-wide">{selectedAccount.accountNumber}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-court-ink/50">
            Whichever way you pay, keep the reference number and a screenshot handy — you&apos;ll need them below.
          </p>
        </div>
      )}

      {value && !selectedAccount && (
        <p className="mt-3 text-sm text-red-600">This payment method isn&apos;t available right now — please choose another.</p>
      )}
    </div>
  );
}
