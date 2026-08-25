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

// Sends a real spin invite email to an address the admin controls, so they
// can walk through the whole flow — open the email, spin, receive the
// result — before turning the feature on for real customers. Marked
// isTest so it's easy to tell apart in the list above, but otherwise
// behaves exactly like a customer invite (one spin, real discount code on
// a win) since a test that skips part of the flow wouldn't prove much.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { email, customerName = "Test player" } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const token = randomUUID();
  const invite = await prisma.spinInvite.create({
    data: {
      token,
      email,
      customerName: typeof customerName === "string" && customerName.trim() ? customerName.trim().slice(0, 80) : "Test player",
      isTest: true,
    },
  });

  try {
    await sendSpinWheelInviteEmail({ email: invite.email, customerName: invite.customerName, token, isTest: true });
  } catch (e) {
    console.error("Test spin invite email failed:", e);
    return NextResponse.json({ error: "Invite was created but the email failed to send. Check your email settings." }, { status: 500 });
  }

  return NextResponse.json({ success: true, invite });
}
