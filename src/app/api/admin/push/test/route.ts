import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { sendAdminPushNotification } from "@/lib/push";

// POST /api/admin/push/test — sends a real push to every device currently
// enabled, and reports back exactly what happened (sent / failed / why),
// instead of the admin having to guess whether it's the VAPID keys, a
// stale subscription, or the OS silently swallowing it.
export async function POST() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await sendAdminPushNotification({
    title: "Test notification 🔔",
    body: "If you can see this, push notifications are working on this device.",
    url: "/admin",
    tag: "test-notification",
  });

  return NextResponse.json(result);
}
