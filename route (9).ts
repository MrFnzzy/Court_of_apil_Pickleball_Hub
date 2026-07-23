@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-display: "Fredoka", sans-serif;
  --font-body: "Inter", sans-serif;

  /* Brand color channel triplets ("r g b"), consumed by tailwind.config.ts
     via rgb(var(--color-x) / <alpha-value>). Overridden at runtime by a
     <style> tag in layout.tsx generated from the admin's Site Settings, so
     changing colors in the admin dashboard never requires a code change. */
  --color-orange: 244 96 54;
  --color-orange-dark: 214 73 31;
  --color-orange-light: 255 140 97;
  --color-blue: 108 212 255;
  --color-blue-dark: 47 168 217;
  --color-blue-light: 199 238 255;
  --color-ink: 23 58 69;
  --color-cream: 251 248 243;
}

html {
  scroll-behavior: smooth;
}

body {
  background-color: rgb(var(--color-cream));
  background-image:
    radial-gradient(circle, rgb(var(--color-orange) / 0.06) 1.6px, transparent 1.6px),
    radial-gradient(circle, rgb(var(--color-blue) / 0.08) 1.6px, transparent 1.6px);
  background-size: 28px 28px, 28px 28px;
  background-position: 0 0, 14px 14px;
  color: rgb(var(--color-ink));
}

/* Court-line divider, echoes a pickleball kitchen line */
.kitchen-line {
  position: relative;
}
.kitchen-line::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: repeating-linear-gradient(
    90deg,
    rgb(var(--color-orange)) 0px,
    rgb(var(--color-orange)) 14px,
    transparent 14px,
    transparent 22px
  );
  border-radius: 2px;
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}

.focus-ring:focus-visible {
  outline: 3px solid rgb(var(--color-blue-dark));
  outline-offset: 2px;
  border-radius: 6px;
}

/* custom scrollbar for schedule grid */
.scroll-thin::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}
.scroll-thin::-webkit-scrollbar-thumb {
  background: rgb(var(--color-orange-light));
  border-radius: 8px;
}
