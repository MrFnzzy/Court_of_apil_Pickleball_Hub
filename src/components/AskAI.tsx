"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

type Answer = { text: string; matched: boolean };

const SUGGESTIONS = [
  "Do you accept walk-ins?",
  "What are your rates?",
  "Naa moy parking?",
];

export default function AskAI({ faqCount }: { faqCount?: number | null }) {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || asking) return;
    setAsking(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/faq-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Something went wrong.");
      setAnswer({ text: data.answer, matched: !!data.matched });
    } catch {
      setError("Couldn't reach the assistant — try again, or message us on Facebook.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-court border-2 border-court-orange/30 bg-gradient-to-br from-court-orange/10 via-white/5 to-court-blue-dark/10 p-4 sm:p-5 mb-2"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <motion.span
          animate={{ rotate: asking ? 360 : 0 }}
          transition={asking ? { duration: 1.1, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
          className="flex-shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-court-orange text-white shadow-court"
        >
          <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M12 3l1.6 4.8L18 9l-4.4 1.2L12 15l-1.6-4.8L6 9l4.4-1.2L12 3z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M19 15l.7 2.1L22 18l-2.3.9L19 21l-.7-2.1L16 18l2.3-.9L19 15z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
        <div>
          <p className="font-display font-700 text-sm sm:text-base text-white">Ask us anything</p>
          <p className="text-[11px] sm:text-xs text-white/60">Instant answers, English or Bisaya — no waiting on Messenger.</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Can I rebook if it rains?"
          className="focus-ring flex-1 min-w-0 rounded-full bg-white/95 border-2 border-transparent focus:border-court-orange px-4 py-2.5 text-sm text-court-ink placeholder:text-court-ink/40"
        />
        <motion.button
          type="submit"
          disabled={asking || !question.trim()}
          whileTap={{ scale: 0.94 }}
          className="focus-ring flex-shrink-0 inline-flex items-center justify-center rounded-full bg-court-orange text-white px-4 sm:px-5 py-2.5 text-sm font-semibold shadow-court disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {asking ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
              className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white"
            />
          ) : (
            "Ask"
          )}
        </motion.button>
      </form>

      <div className="flex flex-wrap gap-2 mt-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQuestion(s);
              ask(s);
            }}
            className="focus-ring rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-xs px-3 py-1.5 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {asking && (
          <motion.div
            key="thinking"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex items-center gap-1.5 text-white/60 text-xs pl-1">
              <span>Thinking</span>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                  className="h-1 w-1 rounded-full bg-white/60"
                />
              ))}
            </div>
          </motion.div>
        )}

        {!asking && error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-3 rounded-xl bg-red-500/10 border border-red-400/30 text-red-100 text-sm px-3 py-2.5"
          >
            {error}
          </motion.div>
        )}

        {!asking && answer && (
          <motion.div
            key="answer"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mt-3 rounded-xl bg-white p-3.5"
          >
            <p className="text-sm text-court-ink/85 leading-relaxed whitespace-pre-line">{answer.text}</p>
            {!answer.matched && (
              <a
                href="https://www.facebook.com/profile.php?id=61591992821734"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-court-orange-dark hover:underline"
              >
                Message us on Facebook →
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[10px] text-white/35 mt-3">
        Trained only on our{faqCount != null ? ` ${faqCount}` : ""} house FAQs — for anything else, our team on
        Facebook has you covered.
      </p>
    </motion.div>
  );
}
