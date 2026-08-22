"use client";

import { useEffect } from "react";
import SiteHeader from "@/components/SiteHeader";
import PaddleIcon from "@/components/icons/PaddleIcon";

// Next.js renders this in place of a route's content whenever that route
// throws during render — without this file, an uncaught error used to just
// unmount everything below the header and leave a blank page with no way
// back except manually editing the URL.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-court-cream flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center rounded-[1.75rem] bg-court-ink px-7 py-10">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/10 border border-white/15 mb-4">
            <PaddleIcon className="h-6 w-6 text-white/70" />
          </span>
          <h1 className="font-display font-700 text-xl text-white mb-2">Something went wrong</h1>
          <p className="text-white/60 text-sm leading-relaxed mb-6">
            This page hit a snag loading. Give it another try, or head back to the homepage.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="focus-ring rounded-full bg-court-orange text-white px-5 py-2.5 text-sm font-semibold shadow-court"
            >
              Try again
            </button>
            <a
              href="/"
              className="focus-ring rounded-full bg-white/10 text-white px-5 py-2.5 text-sm font-semibold border border-white/15"
            >
              Go to homepage
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
