"use client";

/**
 * Rally Motion Graphics controller
 *
 * Decorative interaction effects only: this controller never changes a
 * destination, form value, API request, reward result, or application state.
 * It adds a cinematic court-light cover only around standard same-window link
 * navigation, then sends the browser to the original href after the cover.
 */
import { useEffect } from "react";

const REVEAL_SELECTOR = "main > section, .glass-panel, .glass-panel-dark, .spin-arena, .spin-ticket, [data-motion-reveal]";
const INTERACTIVE_SELECTOR = "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role='button']:not([aria-disabled='true'])";
const TRANSITION_STORAGE_KEY = "heidesPickleballHub.rallyTransition";
const TRANSITION_COVER_MS = 670;

function addLayerChild(parent: HTMLElement, className: string) {
  const child = document.createElement("span");
  child.className = className;
  parent.appendChild(child);
}

function makeRallyTransition(x: number, y: number, phase: "cover" | "reveal") {
  const transition = document.createElement("div");
  transition.className = `rally-page-transition rally-page-transition--${phase}`;
  transition.setAttribute("aria-hidden", "true");
  transition.style.setProperty("--transition-x", `${x}px`);
  transition.style.setProperty("--transition-y", `${y}px`);
  ["rally-page-transition__court", "rally-page-transition__net", "rally-page-transition__beam", "rally-page-transition__ball", "rally-page-transition__ball-trail"].forEach((className) => addLayerChild(transition, className));
  return transition;
}

function isSameWindowPageNavigation(event: MouseEvent, anchor: HTMLAnchorElement) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download") || anchor.dataset.noPageWave === "true") return false;

  const rawHref = anchor.getAttribute("href");
  if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:") || rawHref.startsWith("javascript:")) return false;

  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin !== window.location.origin) return false;
  if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash) return false;
  return true;
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
    let isTransitioning = false;

    const motionLayer = document.createElement("div");
    motionLayer.className = "rally-motion-layer";
    motionLayer.setAttribute("aria-hidden", "true");
    ["rally-motion-layer__ball", "rally-motion-layer__ball", "rally-motion-layer__paddle", "rally-motion-layer__court", "rally-motion-layer__streak"].forEach((className) => addLayerChild(motionLayer, className));

    const cursorLayer = document.createElement("div");
    cursorLayer.className = "rally-cursor-layer";
    cursorLayer.setAttribute("aria-hidden", "true");
    ["rally-cursor-layer__orbit", "rally-cursor-layer__dot", "rally-cursor-layer__trail"].forEach((className) => addLayerChild(cursorLayer, className));
    body.append(motionLayer, cursorLayer);

    try {
      const savedTransition = sessionStorage.getItem(TRANSITION_STORAGE_KEY);
      if (savedTransition) {
        sessionStorage.removeItem(TRANSITION_STORAGE_KEY);
        const { x, y } = JSON.parse(savedTransition) as { x: number; y: number };
        const arrivingTransition = makeRallyTransition(x, y, "reveal");
        body.appendChild(arrivingTransition);
        window.setTimeout(() => arrivingTransition.remove(), 920);
      }
    } catch {
      // Session storage is optional; page navigation still works without it.
    }

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
      { rootMargin: "0px 0px -8%", threshold: 0.07 },
    );

    const prepareTarget = (target: HTMLElement, index: number) => {
      if (observed.has(target) || target.dataset.motionStatic === "true") return;
      observed.add(target);
      target.dataset.motionReveal = "true";
      target.style.setProperty("--motion-index", String(index % 8));
      if (target.matches(INTERACTIVE_SELECTOR) || target.querySelector(INTERACTIVE_SELECTOR)) target.dataset.motionInteractive = "true";
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

    const onNavigationClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || isTransitioning || !isSameWindowPageNavigation(event, anchor)) return;

      event.preventDefault();
      isTransitioning = true;
      const x = event.clientX || window.innerWidth / 2;
      const y = event.clientY || window.innerHeight / 2;
      const transition = makeRallyTransition(x, y, "cover");
      body.appendChild(transition);
      try {
        sessionStorage.setItem(TRANSITION_STORAGE_KEY, JSON.stringify({ x, y }));
      } catch {
        // No stored reveal is still a valid navigation.
      }
      window.setTimeout(() => window.location.assign(anchor.href), TRANSITION_COVER_MS);
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
    // Capture phase ensures the visual cover begins before framework-level
    // client navigation handlers take ownership of an existing link.
    document.addEventListener("click", onNavigationClick, true);
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
      document.removeEventListener("click", onNavigationClick, true);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
      root.style.removeProperty("--scroll-progress");
      root.style.removeProperty("--rally-pointer-x");
      root.style.removeProperty("--rally-pointer-y");
    };
  }, []);

  return null;
}
