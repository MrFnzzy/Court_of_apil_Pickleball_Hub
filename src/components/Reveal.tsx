"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Extra delay in seconds, useful for staggering a row of children. */
  delay?: number;
  /** Direction the content slides in from. */
  from?: "up" | "down" | "left" | "right" | "none";
  /** Passed through so callers can keep their own layout classes. */
  className?: string;
};

const OFFSETS: Record<NonNullable<RevealProps["from"]>, { x?: number; y?: number }> = {
  up: { y: 28 },
  down: { y: -28 },
  left: { x: 28 },
  right: { x: -28 },
  none: {},
};

/**
 * Scroll-triggered entrance for a whole section — the section fades/slides
 * into place the first time it scrolls into view, then stays put. Purely
 * visual: doesn't touch what's inside, only how it arrives on screen.
 */
export default function Reveal({ children, delay = 0, from = "up", className }: RevealProps) {
  const offset = OFFSETS[from];
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
