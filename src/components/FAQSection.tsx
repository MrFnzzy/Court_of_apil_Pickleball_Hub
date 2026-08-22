"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FAQ_ENTRIES, type FAQEntry } from "@/lib/faqData";
import AskAI from "./AskAI";

type FAQ = FAQEntry;

const FAQS: FAQ[] = FAQ_ENTRIES;

function FAQItem({
  item,
  index,
  isOpen,
  onToggle,
}: {
  item: FAQ;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      layout
      className={`rounded-court border-2 overflow-hidden transition-colors ${
        isOpen ? "border-court-orange/50 bg-white" : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/[0.08]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="focus-ring w-full flex items-center gap-3 sm:gap-4 text-left px-4 sm:px-5 py-4"
      >
        <motion.span
          layout
          animate={{
            backgroundColor: isOpen ? "rgb(var(--color-orange))" : "rgba(255,255,255,0.1)",
            color: isOpen ? "#fff" : "rgba(255,255,255,0.7)",
          }}
          transition={{ duration: 0.25 }}
          className="flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
        >
          {String(index + 1).padStart(2, "0")}
        </motion.span>
        <span className={`flex-1 font-display font-600 text-sm sm:text-base ${isOpen ? "text-court-ink" : "text-white"}`}>
          {item.q}
        </span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className={`flex-shrink-0 h-5 w-5 ${isOpen ? "text-court-orange" : "text-white/50"}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-4 pl-[52px] sm:pl-[60px] text-sm text-court-ink/75 leading-relaxed whitespace-pre-line">
              {item.a}
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 font-semibold text-court-orange-dark hover:underline"
                >
                  {item.linkLabel ?? item.link} →
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      <AskAI />
      {FAQS.map((item, i) => (
        <FAQItem
          key={item.q}
          item={item}
          index={i}
          isOpen={openIndex === i}
          onToggle={() => setOpenIndex((prev) => (prev === i ? null : i))}
        />
      ))}
    </div>
  );
}
