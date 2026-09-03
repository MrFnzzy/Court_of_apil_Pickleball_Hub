# Pickleball Hub — Rally Rhythm Motion Refresh

This archive enhances the supplied Next.js project without changing its database schema, API routes, pricing logic, booking rules, page sequence, or navigation destinations.

## Added site-wide behavior

The new `src/components/MotionDirector.tsx` coordinates viewport reveals and a low-profile navigation progress indicator. It uses `IntersectionObserver`, animation-friendly `transform` and `opacity` properties, and respects `prefers-reduced-motion`.

`src/app/layout.tsx` now mounts this controller globally, so existing pages gain a more coherent transition rhythm without having to change each individual page.

## Refined primary interactions

`src/components/HeroSlideshow.tsx` preserves its supplied five-second autoplay, existing slide indicators, link behavior, and slide order. Its refreshed styling adds only a subtle image settle and polished visual transitions.

`src/components/SiteHeader.tsx` keeps the supplied Schedule, Pricing, Track booking, and Book Now destinations unchanged. Its visual feedback remains purely CSS-based.

## Style and accessibility safeguards

The appended **Rally Rhythm** section in `src/app/globals.css` defines shared motion timing, card feedback, hero transitions, and a comprehensive reduced-motion fallback. The visual treatment preserves the project’s original court-blue, deep-ink, and tangerine-orange liquid-glass identity.

## Flow-preservation validation

The original archive was compared with this refresh. No route page or API file was changed. The existing homepage, `/book` flow, `/track` flow, pricing values, availability behavior, link destinations, and booking step sequence remain in place.

## Validation status

TypeScript validation completed after generating the project’s Prisma client. The Next.js compilation stage also completed successfully. A full production export could not finish in this sandbox because the supplied project expects configured PostgreSQL environment variables and attempts a database action as part of its build script; no database changes were attempted.

> To use this archive in its original environment, restore your existing environment variables and run the normal deployment workflow there.

## Premium pickleball animation upgrade

The voucher sequence keeps its existing validation, discounted-total calculation, completion callback, and reduced-motion route. The upgrade is visual only: the success event is reframed as a **rally-to-ace** moment with court geometry, perforated-ball trails, a paddle strike, and a score-style reward stamp.

The wheel keeps its existing server-selected prize, six-turn rotation, sound timing, haptics, spin lock, copy-code action, and result card actions. The upgrade is visual only: the wheel becomes a **night-match rally arena** with court-line depth, a lit rim, enhanced ball hub, energised pointer, and a pickleball-specific win reveal.

The upgraded voucher moment now uses a court pulse, a dotted rally trajectory, a larger perforated-ball particle burst, and a visible **ACE** stamp. The wheel now uses court-ring geometry, orbiting match-light layers, a tuned hub and pointer treatment, pickleball ball confetti, and an ace-style reward badge. The functional reward path was compared against the supplied archive and remains unchanged.

## Site-wide motion graphics layer

The global interaction controller now decorates existing interactive elements with a motion-graphics-only system: animated court ambience, floating perforated ball forms, trajectory streaks, page-surface reveal flares, hover lifts, focus glows, cursor orbit effects on fine pointers, and a lightweight **serve impact** on existing press events. These effects use passive listeners, pointer-safe overlay nodes, transform and opacity animation, cleanup on unmount, and a complete reduced-motion exit path. They do not alter click targets, navigation, form input values, requests, validation, or state transitions.

## Water-wave navigation transition

The page-cover transition, press-impact effect, and prior tap ripple have been removed. Existing navigation now remains immediate and entirely controlled by the supplied application.

## Final visual and motion refinement

The non-blocking animation system now focuses on stronger court-side presentation: rotating court-light orbs behind each existing section, richer glass depth, refined primary and secondary action treatments, active-control glow, expressive selection shadows, polished input focus, layered navigation depth, and restrained ambient paddle, ball, court, and trajectory motion. Every addition remains decorative and honors reduced-motion preferences.

## 3D showcase, deeper transitions, and directional crossfade

`src/components/Hero3DShowcase.tsx` is a new, purely decorative accent mounted beside the hero image card. It renders the existing paddle/ball artwork as separate layers inside a `perspective` + `transform-style: preserve-3d` scene — a blurred glow disc, a dashed orbit ring, the paddle, the ball, and a drop shadow each sit at their own `translateZ` depth. The whole scene tilts toward the cursor anywhere in the viewport (via a lightweight `pointermove` listener + `requestAnimationFrame`, mouse-only) and idles with a slow bob/orbit loop when there's no fine pointer. It never intercepts clicks (`pointer-events: none`, `aria-hidden`), and both the tilt listener and the idle keyframes are skipped entirely under `prefers-reduced-motion` or on touch devices, where the element is hidden outright.

The viewport-reveal system (`[data-motion-reveal]`) now settles in with a touch of real depth — a slight `rotateX` tilt-up combined with a soft blur-to-sharp focus — instead of a flat rise, so section entrances read as more three-dimensional without changing which elements animate or when.

`HeroSlideshow.tsx` now tracks the direction of each slide change (autoplay and manual dot clicks) and applies the `hero-slide--forward` / `hero-slide--backward` modifier the stylesheet already defined, so the background image now visibly glides against the direction of travel during a crossfade instead of only fading in place. Slide timing, slide order, dot count, and link destinations are unchanged. The dot controls were switched to the existing `.hero-slide__dot` styles (same visual result) so their size/color transition is now smooth instead of instant.

Ambient `.glass-orb` background blobs now drift with scroll progress (reusing the `--scroll-progress` value `MotionDirector` already computes — no new scroll listeners), adding a subtle parallax read as the page scrolls. This is skipped under reduced motion.

Validation: `tsc --noEmit` shows no errors in any file touched by this pass (the 20 pre-existing errors in API routes are unrelated implicit-`any` issues stemming from `prisma generate` being blocked by this sandbox's network allowlist — the same limitation noted above — not from this refresh). CSS brace balance was checked programmatically after edits.
