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
