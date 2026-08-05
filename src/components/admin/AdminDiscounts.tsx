"use client";

import { useEffect, useState } from "react";

type Discount = {
  id: string;
  code: string;
  percentage: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  active: boolean;
  source: "MANUAL" | "SPIN_WHEEL";
  note: string;
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

const SWATCHES = ["#F46036", "#D6491F", "#FF8C61", "#6CD4FF", "#2FA8D9", "#173A45", "#8BC34A", "#FFC107"];

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
          Promo codes
        </button>
        <button
          onClick={() => setSection("spin")}
          className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            section === "spin" ? "bg-court-blue-dark text-white shadow-court" : "bg-white text-court-ink/70 border border-court-ink/10 hover:border-court-blue-dark/40"
          }`}
        >
          Spin the wheel
        </button>
      </div>

      {section === "codes" ? <PromoCodesSection /> : <SpinWheelSection />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Promo codes                                                             */
/* ---------------------------------------------------------------------- */

function PromoCodesSection() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [percentage, setPercentage] = useState("10");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/discounts", { cache: "no-store" });
    const data = await res.json();
    setDiscounts(data.discounts || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          percentage: Number(percentage),
          maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create promo code.");
      setCode("");
      setPercentage("10");
      setMaxRedemptions("");
      setNote("");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(d: Discount) {
    await fetch(`/api/admin/discounts/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !d.active }),
    });
    load();
  }

  async function remove(d: Discount) {
    if (!confirm(`Delete promo code "${d.code}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/discounts/${d.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Failed to delete.");
      return;
    }
    load();
  }

  const running = discounts.filter((d) => d.active);
  const inactive = discounts.filter((d) => !d.active);

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="rounded-court bg-white border-2 border-court-orange/30 shadow-court p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Create a promo code</h3>
        <p className="text-sm text-court-ink/60 mb-4">
          Customers type this in at checkout for a percentage off their booking. Keep it short and easy to type.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. SUMMER20"
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 font-mono tracking-wide"
              maxLength={32}
              required
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Discount %</span>
            <input
              type="number"
              min={1}
              max={100}
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2"
              required
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Redemption limit</span>
            <input
              type="number"
              min={1}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="Unlimited"
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Note (admin-only, optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Facebook promo, July"
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2"
              maxLength={300}
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="focus-ring mt-4 rounded-full bg-court-orange text-white px-6 py-2.5 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create promo code"}
        </button>
      </form>

      <div>
        <h3 className="font-display font-600 text-lg text-court-ink mb-3">Running now {running.length > 0 && `(${running.length})`}</h3>
        {loading ? (
          <p className="text-court-ink/50">Loading…</p>
        ) : running.length === 0 ? (
          <p className="text-court-ink/50 italic text-sm">No active promo codes right now.</p>
        ) : (
          <div className="space-y-3">
            {running.map((d) => (
              <DiscountRow key={d.id} d={d} onToggle={() => toggleActive(d)} onRemove={() => remove(d)} />
            ))}
          </div>
        )}
      </div>

      {inactive.length > 0 && (
        <div>
          <h3 className="font-display font-600 text-lg text-court-ink mb-3">Inactive ({inactive.length})</h3>
          <div className="space-y-3">
            {inactive.map((d) => (
              <DiscountRow key={d.id} d={d} onToggle={() => toggleActive(d)} onRemove={() => remove(d)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DiscountRow({ d, onToggle, onRemove }: { d: Discount; onToggle: () => void; onRemove: () => void }) {
  const limitLabel = d.maxRedemptions === null ? `${d.redemptionCount} used · Unlimited` : `${d.redemptionCount} / ${d.maxRedemptions} used`;
  const exhausted = d.maxRedemptions !== null && d.redemptionCount >= d.maxRedemptions;
  return (
    <div className={`rounded-court bg-white border-2 shadow-court p-4 flex flex-wrap items-center gap-3 ${d.active ? "border-court-ink/10" : "border-gray-200 opacity-70"}`}>
      <div className="flex-1 min-w-[180px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-court-ink tracking-wide">{d.code}</span>
          <span className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-court-blue-light/30 text-court-blue-dark border-court-blue/30">
            {d.percentage}% off
          </span>
          {d.source === "SPIN_WHEEL" && (
            <span className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-court-orange/10 text-court-orange-dark border-court-orange/30">
              Spin wheel win
            </span>
          )}
          {exhausted && (
            <span className="text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 bg-red-50 text-red-600 border-red-200">
              Exhausted
            </span>
          )}
        </div>
        <p className="text-xs text-court-ink/50 mt-1">
          {limitLabel} · Created {fmtDate(d.createdAt)}
          {d.note && ` · ${d.note}`}
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={onToggle} className="text-xs font-semibold text-court-blue-dark hover:underline focus-ring">
          {d.active ? "Deactivate" : "Activate"}
        </button>
        <button onClick={onRemove} className="text-xs font-semibold text-red-500 hover:underline focus-ring">
          Delete
        </button>
      </div>
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
    setSendingTest(true);
    try {
      const res = await fetch("/api/admin/spin-wheel/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, customerName: testName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send test invite.");
      setTestMsg(`Test spin invite sent to ${testEmail}.`);
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

  return (
    <div className="space-y-6">
      {/* Launch control */}
      <div className="rounded-court bg-white border-2 border-court-orange/30 shadow-court p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Launch control</h3>
        <p className="text-sm text-court-ink/60 mb-4">
          This feature is a work in progress. Keep it off while you set up prizes and test it — customers only start
          getting spin invite emails once it&apos;s turned on.
        </p>

        <div className="flex items-center justify-between rounded-xl border-2 border-court-ink/10 px-4 py-3 mb-4">
          <div>
            <p className="font-semibold text-court-ink text-sm">{settings.enabled ? "Live" : "Off"}</p>
            <p className="text-xs text-court-ink/50">
              {settings.enabled
                ? "Finished bookings that qualify are being emailed a spin invite."
                : "No invite emails are going out to real customers."}
            </p>
          </div>
          <button
            onClick={toggleEnabled}
            disabled={settingsLoading || savingSettings}
            className={`focus-ring relative h-8 w-14 rounded-full transition-colors disabled:opacity-50 ${
              settings.enabled ? "bg-green-500" : "bg-gray-300"
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

        <label className="text-sm block">
          <span className="block mb-1 font-medium text-court-ink/80">
            Only invite customers whose booking date is on or after
          </span>
          <div className="flex gap-2">
            <input
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              className="rounded-xl border-2 border-court-ink/15 px-3 py-2"
            />
            <button
              onClick={saveStartDate}
              disabled={savingSettings}
              className="focus-ring rounded-full bg-court-blue-dark text-white px-4 py-2 text-sm font-semibold hover:brightness-95 disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <span className="block mt-1 text-xs text-court-ink/50">
            Leave blank to make every finished booking eligible once the feature is live.
          </span>
        </label>
      </div>

      {/* Prizes */}
      <PrizesEditor prizes={prizes} loading={prizesLoading} totalWeight={totalWeight} onChanged={loadPrizes} />

      {/* Test send */}
      <form onSubmit={sendTest} className="rounded-court bg-white border-2 border-court-blue/20 shadow-court p-5 sm:p-6">
        <h3 className="font-display font-600 text-lg text-court-ink mb-1">Test the flow</h3>
        <p className="text-sm text-court-ink/60 mb-4">
          Sends a real spin invite to an email you control, so you can try the whole thing — email, wheel, and
          result — before turning it on for customers.
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
        <button
          type="submit"
          disabled={sendingTest}
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

  async function addPrize(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/spin-wheel/prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, percentage: Number(percentage), weight: Number(weight), color }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add prize.");
      setLabel("");
      setPercentage("10");
      setWeight("10");
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

  async function removePrize(p: Prize) {
    if (!confirm(`Remove prize "${p.label}"?`)) return;
    await fetch(`/api/admin/spin-wheel/prizes/${p.id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-5 sm:p-6">
      <h3 className="font-display font-600 text-lg text-court-ink mb-1">Prizes</h3>
      <p className="text-sm text-court-ink/60 mb-4">
        Each prize is a wedge on the wheel. Set its discount percentage (0 = no prize / try again) and its chance —
        higher chance numbers are relatively more likely to be picked, weighed against the other active prizes.
      </p>

      {prizes.length > 0 && (
        <div className="space-y-2 mb-5">
          {prizes.map((p) => {
            const share = p.active && totalWeight > 0 ? Math.round((p.weight / totalWeight) * 100) : 0;
            return (
              <div key={p.id} className={`flex flex-wrap items-center gap-3 rounded-xl border-2 px-3 py-2.5 ${p.active ? "border-court-ink/10" : "border-gray-200 opacity-60"}`}>
                <span className="h-5 w-5 rounded-full flex-shrink-0 border border-black/10" style={{ background: p.color }} />
                <div className="flex-1 min-w-[140px]">
                  <p className="font-semibold text-court-ink text-sm">{p.label}</p>
                  <p className="text-xs text-court-ink/50">
                    {p.percentage > 0 ? `${p.percentage}% off` : "No prize"} · {p.active ? `~${share}% chance` : "Inactive"}
                  </p>
                </div>
                <button
                  onClick={() => updatePrize(p.id, { active: !p.active })}
                  className="text-xs font-semibold text-court-blue-dark hover:underline focus-ring"
                >
                  {p.active ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => removePrize(p)} className="text-xs font-semibold text-red-500 hover:underline focus-ring">
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
      {!loading && prizes.length === 0 && (
        <p className="text-court-ink/50 italic text-sm mb-5">No prizes yet — add at least one below before turning the wheel on.</p>
      )}

      <form onSubmit={addPrize} className="border-t border-court-ink/10 pt-4">
        <p className="text-sm font-semibold text-court-ink mb-3">Add a prize</p>
        <div className="grid sm:grid-cols-4 gap-3">
          <label className="text-sm sm:col-span-2">
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
            <span className="block mb-1 font-medium text-court-ink/80">Discount %</span>
            <input
              type="number"
              min={0}
              max={100}
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium text-court-ink/80">Chance</span>
            <input
              type="number"
              min={1}
              max={100}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full rounded-xl border-2 border-court-ink/15 px-3 py-2 text-sm"
              required
            />
          </label>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs font-medium text-court-ink/70">Color</span>
          {SWATCHES.map((sw) => (
            <button
              key={sw}
              type="button"
              onClick={() => setColor(sw)}
              className={`h-6 w-6 rounded-full border-2 ${color === sw ? "border-court-ink" : "border-transparent"}`}
              style={{ background: sw }}
              aria-label={sw}
            />
          ))}
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
