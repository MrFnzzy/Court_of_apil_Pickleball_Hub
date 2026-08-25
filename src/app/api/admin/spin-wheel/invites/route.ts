import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { sendSpinWheelInviteEmail } from "@/lib/email";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const invites = await prisma.spinInvite.findMany({
    orderBy: { sentAt: "desc" },
    take: 100,
    include: { prize: { select: { label: true } }, discount: { select: { code: true, percentage: true } } },
  });
  return NextResponse.json({ invites });
}

// Sends a spin invite email. Two flavors, controlled by `isTest` in the
// body (defaults to true so existing callers that only ever sent test
// invites keep behaving exactly as before):
//
// - isTest: true  — a real spin invite email sent to an address the admin
//   controls, so they can walk through the whole flow — open the email,
//   spin, receive the result — before turning the feature on for real
//   customers. Always works, even while the wheel is switched off site-wide.
// - isTest: false — an "official" invite: the same one-spin flow, but
//   meant for an actual customer the admin wants to hand a spin to
//   directly (outside the normal automatic post-booking flow — e.g. a
//   walk-in, a promo, a make-good). Subject to the site-wide enabled
//   toggle like any customer invite, and shows up in the list without the
//   "Test" badge.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { email, customerName, isTest = true } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const defaultName = isTest ? "Test player" : "Guest";
  const token = randomUUID();
  const invite = await prisma.spinInvite.create({
    data: {
      token,
      email,
      customerName: typeof customerName === "string" && customerName.trim() ? customerName.trim().slice(0, 80) : defaultName,
      isTest: !!isTest,
    },
  });

  try {
    await sendSpinWheelInviteEmail({ email: invite.email, customerName: invite.customerName, token, isTest: !!isTest });
  } catch (e) {
    console.error("Spin invite email failed:", e);
    return NextResponse.json({ error: "Invite was created but the email failed to send. Check your email settings." }, { status: 500 });
  }

  return NextResponse.json({ success: true, invite });
}
