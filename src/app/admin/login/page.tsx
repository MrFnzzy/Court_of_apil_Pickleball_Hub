"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PaddleIcon from "@/components/icons/PaddleIcon";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed.");
      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-court-cream px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-court bg-white shadow-court-lg border-2 border-court-orange/15 p-8">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-court-orange text-white">
            <PaddleIcon className="h-5 w-5" />
          </span>
          <span className="font-display font-700 text-lg text-court-ink">Court manager</span>
        </div>
        <label className="block text-sm mb-4">
          <span className="block mb-1 font-medium text-court-ink/80">Admin password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border-2 border-court-ink/15 px-4 py-2.5 focus:outline-none focus:border-court-blue-dark"
            required
            autoFocus
          />
        </label>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-court-orange text-white py-3 font-semibold hover:bg-court-orange-dark disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
