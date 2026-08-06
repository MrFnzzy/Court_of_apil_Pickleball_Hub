"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Renders its children straight into document.body and freezes background
// scroll while mounted.
//
// Why this exists: a modal rendered in place — nested wherever it happens
// to sit in the page (a tab panel, a card list, etc.) — inherits whatever
// ancestor DOM it's under. On some mobile browsers, `position: fixed`
// inside a scrolling ancestor doesn't stay pinned to the real viewport the
// way the CSS spec says it should; the modal ends up positioned relative
// to the page's scroll instead, so it can open off-screen until the page
// happens to be scrolled to the right spot, and drift again if the page
// scrolls afterward. Porting the modal out to <body> removes it from that
// ancestor chain entirely, and locking body scroll means there's no page
// position for it to drift relative to in the first place — the modal
// just stays put, exactly where it opened, every time.
export default function ModalPortal({
  children,
  lockScroll = true,
}: {
  children: React.ReactNode;
  // Set false for non-blocking floating UI (a toast, an action bar) that
  // should still let the page scroll underneath it — only true modals
  // that need to stay put need scroll frozen.
  lockScroll?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!lockScroll) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [lockScroll]);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
