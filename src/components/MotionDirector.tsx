"use client";

/**
 * Rally Motion Graphics controller
 *
 * Decorative interaction effects only: this controller never changes a
 * destination, form value, API request, reward result, or application state.
 * Navigation remains immediate and is handled entirely by the supplied app.
 */
import { useEffect } from "react";

const REVEAL_SELECTOR = "main > section, .glass-panel, .glass-panel-dark, .spin-arena, .spin-ticket, [data-motion-reveal]";
const INTERACTIVE_SELECTOR = "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role='button']:not([aria-disabled='true'])";

function addLayerChild(parent: HTMLElement, className: string) {
  const child = document.createElement("span");
  child.className = className;
  parent.appendChild(child);
}

export default function MotionDirector() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    const root = document.documentElement;
    const body = document.body;
    const observed = new WeakSet<HTMLElement>();
    let revealIndex = 0;
    let scrollFrame = 0;
    let pointerFrame = 0;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;

    const motionLayer = document.createElement("div");
    motionLayer.className = "rally-motion-layer";
    motionLayer.setAttribute("aria-hidden", "true");
    ["rally-motion-layer__ball", "rally-motion-layer__ball", "rally-motion-layer__paddle", "rally-motion-layer__court", "rally-motion-layer__streak"].forEach((className) => addLayerChild(motionLayer, className));

    const cursorLayer = document.createElement("div");
    cursorLayer.className = "rally-cursor-layer";
    cursorLayer.setAttribute("aria-hidden", "true");
    ["rally-cursor-layer__orbit", "rally-cursor-layer__dot", "rally-cursor-layer__trail"].forEach((className) => addLayerChild(cursorLayer, className));
    body.append(motionLayer, cursorLayer);

    const revealTimerIds = new Set<number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            target.classList.add("is-revealed");
            observer.unobserve(target);
            const pendingTimer = revealTimers.get(target);
            if (pendingTimer !== undefined) {
              window.clearTimeout(pendingTimer);
              revealTimerIds.delete(pendingTimer);
              revealTimers.delete(target);
            }
          }
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.07 },
    );

    // Safety net: a target that never satisfies the intersection threshold
    // — e.g. it's still below the fold with nothing to scroll to below it,
    // it's inside a short viewport where "-8%" cuts it out entirely, or it
    // briefly has zero size while fonts/images are still loading — would
    // otherwise sit at `opacity: 0` forever, since the reveal CSS depends
    // entirely on `.is-revealed` ever getting added. This was most visible
    // on the spin-wheel page (`.spin-arena` / `.spin-ticket` match the
    // reveal selector): the wheel would flash into view on first paint,
    // then this system would hide it a moment later, and — being the sole
    // page content someone lands on straight from a shared link, with no
    // reason to scroll — it could stay invisible indefinitely. Force a
    // reveal after a short delay regardless of intersection so nothing is
    // ever permanently stuck hidden.
    const revealTimers = new WeakMap<HTMLElement, number>();

    const prepareTarget = (target: HTMLElement, index: number) => {
      if (observed.has(target) || target.dataset.motionStatic === "true") return;
      observed.add(target);
      target.dataset.motionReveal = "true";
      target.style.setProperty("--motion-index", String(index % 8));
      if (target.matches(INTERACTIVE_SELECTOR) || target.querySelector(INTERACTIVE_SELECTOR)) target.dataset.motionInteractive = "true";
      observer.observe(target);
      const timer: number = window.setTimeout(() => {
        target.classList.add("is-revealed");
        observer.unobserve(target);
        revealTimers.delete(target);
        revealTimerIds.delete(timer);
      }, 900);
      revealTimers.set(target, timer);
      revealTimerIds.add(timer);
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

    const onScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        updateProgress();
        scrollFrame = 0;
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (pointerFrame) return;
      pointerFrame = window.requestAnimationFrame(() => {
        root.style.setProperty("--rally-pointer-x", `${pointerX}px`);
        root.style.setProperty("--rally-pointer-y", `${pointerY}px`);
        pointerFrame = 0;
      });
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = (event.target as Element | null)?.closest<HTMLElement>(INTERACTIVE_SELECTOR);
      target?.classList.add("rally-hover");
    };

    const onPointerOut = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>(INTERACTIVE_SELECTOR);
      target?.classList.remove("rally-hover");
    };

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches(REVEAL_SELECTOR)) {
            prepareTarget(node, revealIndex);
            revealIndex += 1;
          }
          prepareTargets(node);
        });
      });
    });

    body.classList.add("motion-ready", "rally-motion-enabled");
    prepareTargets();
    updateProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      body.classList.remove("motion-ready", "rally-motion-enabled");
      motionLayer.remove();
      cursorLayer.remove();
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
      revealTimerIds.forEach((id) => window.clearTimeout(id));
      revealTimerIds.clear();
      root.style.removeProperty("--scroll-progress");
      root.style.removeProperty("--rally-pointer-x");
      root.style.removeProperty("--rally-pointer-y");
    };
  }, []);

  return null;
}
