import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

// POST /api/admin/push — register (or refresh) this browser's push
// subscription. Called right after the admin grants notification
// permission and the frontend gets a PushSubscription object from the
// service worker.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { endpoint, keys, label } = body;

  if (typeof endpoint !== "string" || !endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  // Upsert on endpoint — re-subscribing (e.g. after the browser rotates the
  // subscription) should replace the old keys for that endpoint, not create
  // a duplicate row.
  await prisma.adminPushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth, label: label || undefined },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, label: label || undefined },
  });

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/push — unregister this browser (admin turned
// notifications off, or the frontend detected the subscription is stale).
export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { endpoint } = body;
  if (typeof endpoint !== "string" || !endpoint) {
    return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
  }

  await prisma.adminPushSubscription.deleteMany({ where: { endpoint } });
  return NextResponse.json({ success: true });
}
