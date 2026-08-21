"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ACTIVE_BOOKING_REF_KEY } from "@/lib/activeBookingRef";

// While a customer has a booking still awaiting admin approval, this keeps
// bringing them back to that booking's /track/[ref] status page — on this
// browser, every page load, even after fully closing and reopening the
// site — until an admin approves or rejects it. This stops customers from
// wandering off and, say, submitting a second competing booking while the
// first one is still being verified.
//
// The lock lives in localStorage (set by the /book success flow) so it
// survives closing the tab/browser, but it's inherently per-browser/device
// — it can't follow the customer to a different phone or browser.
//
// The lock releases itself automatically: /track/[ref] clears the stored
// ref as soon as it sees the booking's overall status is no longer
// PENDING, so this component doesn't need to know about outcomes itself —
// it just checks "is there still a ref stored?" on every navigation.
export default function PendingBookingLock() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) return;
    // Never touch the admin dashboard, or the exact status page for the
    // locked booking itself (that would be an infinite redirect loop).
    if (pathname.startsWith("/admin")) return;

    let ref: string | null = null;
    try {
      ref = localStorage.getItem(ACTIVE_BOOKING_REF_KEY);
    } catch {
      return;
    }
    if (!ref) return;

    const targetPath = `/track/${encodeURIComponent(ref)}`;
    if (pathname === targetPath) return;

    router.replace(targetPath);
  }, [pathname, router]);

  return null;
}
