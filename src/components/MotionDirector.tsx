"use client";

import { useEffect } from "react";

/**
 * Rally Rhythm motion controller
 *
 * This component keeps the site's motion behavior coordinated instead of
 * relying on a mix of unrelated one-off effects. It only prepares surfaces
 * after hydration, reveals them as they enter the viewport, and exposes a
 * lightweight scroll-progress variable for the navigation treatment.
 */
const REVEAL_SELECTOR = "main > section, .glass-panel, .glass-panel-dark, [data-motion-reveal]";
const INTERACTIVE_SELECTOR = "button, a[href], input, select, textarea, [role='button']";

export default function MotionDirector() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    const root = document.documentElement;
    const body = document.body;
    const observed = new WeakSet<HTMLElement>();
    let revealIndex = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            target.classList.add("is-revealed");
            observer.unobserve(target);
          }
        });
      },
      { rootMargin: "0px 0px -10%", threshold: 0.08 },
    );

    const prepareTarget = (target: HTMLElement, index: number) => {
      if (observed.has(target) || target.dataset.motionStatic === "true") return;

      observed.add(target);
      target.dataset.motionReveal = "true";
      target.style.setProperty("--motion-index", String(index % 7));

      if (target.matches(INTERACTIVE_SELECTOR) || target.querySelector(INTERACTIVE_SELECTOR)) {
        target.dataset.motionInteractive = "true";
      }

      observer.observe(target);
    };

    const prepareTargets = (scope: ParentNode = document) => {
      Array.from(scope.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)).forEach((target) => {
        prepareTarget(target, revealIndex);
        revealIndex += 1;
      });
    };

    const updateProgress = () => {
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      root.style.setProperty("--scroll-progress", String(Math.min(window.scrollY / maxScroll, 1)));
    };

    let scrollFrame = 0;
    const onScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        updateProgress();
        scrollFrame = 0;
      });
    };

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.matches(REVEAL_SELECTOR)) {
              prepareTarget(node, revealIndex);
              revealIndex += 1;
            }
            prepareTargets(node);
          }
        });
      });
    });

    body.classList.add("motion-ready");
    prepareTargets();
    updateProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      body.classList.remove("motion-ready");
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      root.style.removeProperty("--scroll-progress");
    };
  }, []);

  return null;
}
