"use client";

import { useEffect, useState } from "react";

type Faq = {
  id: string;
  question: string;
  answer: string;
  link: string | null;
  linkLabel: string | null;
  active: boolean;
  order: number;
};

type Draft = { question: string; answer: string; link: string; linkLabel: string };

const EMPTY_DRAFT: Draft = { question: "", answer: "", link: "", linkLabel: "" };

function FaqRow({
  faq,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onChanged,
}: {
  faq: Faq;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    question: faq.question,
    answer: faq.answer,
    link: faq.link ?? "",
    linkLabel: faq.linkLabel ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/faqs/${faq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update FAQ.");
      onChanged();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!draft.question.trim() || !draft.answer.trim()) {
      setError("Question and answer are both required.");
      return;
    }
    const ok = await patch({
      question: draft.question,
      answer: draft.answer,
      link: draft.link.trim() || null,
      linkLabel: draft.linkLabel.trim() || null,
    });
    if (ok) setEditing(false);
  }

  async function handleDelete() {
    if (!confirm(`Remove "${faq.question}"? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/faqs/${faq.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete FAQ.");
      onChanged();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  function cancelEdit() {
    setDraft({ question: faq.question, answer: faq.answer, link: faq.link ?? "", linkLabel: faq.linkLabel ?? "" });
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-xl border-2 border-court-orange/40 bg-white p-3.5 space-y-2.5">
        <label className="text-xs block">
          <span className="block mb-1 font-medium text-court-ink/70">Question</span>
          <input
            value={draft.question}
            onChange={(e) => setDraft({ ...draft, question: e.target.value })}
            className="w-full rounded-lg border-2 border-court-ink/15 px-2.5 py-1.5 text-sm focus-ring"
          />
        </label>
        <label className="text-xs block">
          <span className="block mb-1 font-medium text-court-ink/70">Answer</span>
          <textarea
            value={draft.answer}
            onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
            rows={3}
            className="w-full rounded-lg border-2 border-court-ink/15 px-2.5 py-1.5 text-sm focus-ring resize-y"
          />
        </label>
        <div className="flex flex-wrap gap-2.5">
          <label className="text-xs flex-1 min-w-[10rem]">
            <span className="block mb-1 font-medium text-court-ink/70">Link (optional)</span>
            <input
              value={draft.link}
              onChange={(e) => setDraft({ ...draft, link: e.target.value })}
              placeholder="https://…"
              className="w-full rounded-lg border-2 border-court-ink/15 px-2.5 py-1.5 text-sm focus-ring"
            />
          </label>
          <label className="text-xs flex-1 min-w-[10rem]">
            <span className="block mb-1 font-medium text-court-ink/70">Link label (optional)</span>
            <input
              value={draft.linkLabel}
              onChange={(e) => setDraft({ ...draft, linkLabel: e.target.value })}
              placeholder="e.g. View on map"
              className="w-full rounded-lg border-2 border-court-ink/15 px-2.5 py-1.5 text-sm focus-ring"
            />
          </label>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="focus-ring rounded-full bg-court-orange text-white px-4 py-1.5 text-xs font-semibold hover:bg-court-orange-dark disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={busy}
            className="focus-ring rounded-full border-2 border-court-ink/15 text-court-ink/70 px-4 py-1.5 text-xs font-semibold hover:border-court-ink/30"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-2 px-3.5 py-3 ${faq.active ? "border-court-ink/10" : "border-court-ink/10 opacity-50"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-court-ink/90">{faq.question}</p>
          <p className="text-sm text-court-ink/60 mt-1 whitespace-pre-line">{faq.answer}</p>
          {faq.link && (
            <p className="text-xs text-court-orange-dark mt-1 truncate">{faq.linkLabel || faq.link}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={busy || isFirst}
              aria-label="Move up"
              className="focus-ring rounded-full h-6 w-6 inline-flex items-center justify-center text-court-ink/40 hover:text-court-ink hover:bg-court-ink/10 disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M6 15l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={busy || isLast}
              aria-label="Move down"
              className="focus-ring rounded-full h-6 w-6 inline-flex items-center justify-center text-court-ink/40 hover:text-court-ink hover:bg-court-ink/10 disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={busy}
              className="focus-ring rounded-full px-2.5 py-1 text-xs font-semibold text-court-blue-dark hover:bg-court-blue-light/30"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => patch({ active: !faq.active })}
              disabled={busy}
              className={`focus-ring rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                faq.active
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-court-ink/10 text-court-ink/50 hover:bg-court-ink/15"
              }`}
            >
              {faq.active ? "Active" : "Hidden"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              aria-label={`Delete ${faq.question}`}
              className="focus-ring rounded-full h-7 w-7 inline-flex items-center justify-center text-court-ink/40 hover:text-red-600 hover:bg-red-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

export default function AdminFaqs() {
  const [faqs, setFaqs] = useState<Faq[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function reload() {
    fetch("/api/admin/faqs")
      .then((r) => r.json())
      .then((d) => setFaqs((d.faqs ?? []).slice().sort((a: Faq, b: Faq) => a.order - b.order)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  // Swaps this FAQ's order value with its neighbor's, so reordering never
  // produces duplicate or ambiguous order numbers.
  async function swap(a: Faq, b: Faq) {
    await Promise.all([
      fetch(`/api/admin/faqs/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: b.order }),
      }),
      fetch(`/api/admin/faqs/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: a.order }),
      }),
    ]);
    reload();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!draft.question.trim() || !draft.answer.trim()) {
      setAddError("Question and answer are both required.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: draft.question,
          answer: draft.answer,
          link: draft.link.trim() || undefined,
          linkLabel: draft.linkLabel.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add FAQ.");
      setDraft(EMPTY_DRAFT);
      reload();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  if (loading || !faqs) {
    return <p className="text-court-ink/50">Loading FAQs…</p>;
  }

  return (
    <div className="rounded-court glass-panel p-5 sm:p-6 max-w-2xl">
      <h3 className="font-display font-600 text-lg text-court-ink mb-1">FAQ</h3>
      <p className="text-sm text-court-ink/60 mb-6">
        These show up in the homepage FAQ accordion and feed the &quot;Ask us anything&quot; AI assistant. Use the
        arrows to reorder, toggle &quot;Hidden&quot; to pull one from the site without deleting it, and add a link
        (e.g. a map) for entries that point somewhere.
      </p>

      {faqs.length === 0 ? (
        <p className="text-sm text-court-ink/50 mb-4">No FAQs yet — add one below.</p>
      ) : (
        <div className="space-y-2.5 mb-6">
          {faqs.map((faq, i) => (
            <FaqRow
              key={faq.id}
              faq={faq}
              isFirst={i === 0}
              isLast={i === faqs.length - 1}
              onMoveUp={() => swap(faq, faqs[i - 1])}
              onMoveDown={() => swap(faq, faqs[i + 1])}
              onChanged={reload}
            />
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="rounded-xl border-2 border-dashed border-court-ink/15 p-3.5 space-y-2.5">
        <p className="text-xs font-semibold text-court-ink/70">Add a new FAQ</p>
        <label className="text-xs block">
          <span className="block mb-1 font-medium text-court-ink/70">Question</span>
          <input
            value={draft.question}
            onChange={(e) => setDraft({ ...draft, question: e.target.value })}
            placeholder="e.g. Do you accept walk-ins?"
            className="w-full rounded-lg border-2 border-court-ink/15 px-2.5 py-1.5 text-sm focus-ring"
          />
        </label>
        <label className="text-xs block">
          <span className="block mb-1 font-medium text-court-ink/70">Answer</span>
          <textarea
            value={draft.answer}
            onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
            rows={3}
            placeholder="e.g. Yes, walk-ins are allowed subject to court availability."
            className="w-full rounded-lg border-2 border-court-ink/15 px-2.5 py-1.5 text-sm focus-ring resize-y"
          />
        </label>
        <div className="flex flex-wrap gap-2.5">
          <label className="text-xs flex-1 min-w-[10rem]">
            <span className="block mb-1 font-medium text-court-ink/70">Link (optional)</span>
            <input
              value={draft.link}
              onChange={(e) => setDraft({ ...draft, link: e.target.value })}
              placeholder="https://…"
              className="w-full rounded-lg border-2 border-court-ink/15 px-2.5 py-1.5 text-sm focus-ring"
            />
          </label>
          <label className="text-xs flex-1 min-w-[10rem]">
            <span className="block mb-1 font-medium text-court-ink/70">Link label (optional)</span>
            <input
              value={draft.linkLabel}
              onChange={(e) => setDraft({ ...draft, linkLabel: e.target.value })}
              placeholder="e.g. View on map"
              className="w-full rounded-lg border-2 border-court-ink/15 px-2.5 py-1.5 text-sm focus-ring"
            />
          </label>
        </div>
        {addError && <p className="text-xs text-red-600">{addError}</p>}
        <button
          type="submit"
          disabled={adding}
          className="focus-ring rounded-full bg-court-orange text-white px-4 py-1.5 text-sm font-semibold hover:bg-court-orange-dark disabled:opacity-50"
        >
          {adding ? "Adding…" : "+ Add FAQ"}
        </button>
      </form>
    </div>
  );
}
