"use client";

// Unlike layout.tsx (which persists across navigations), Next.js remounts
// template.tsx on every navigation — including switching between "/" and
// "/book". That makes it the right place for a one-off entrance animation
// each time a page/tab is visited, without needing an animation library.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="fx-page-enter">{children}</div>;
}
