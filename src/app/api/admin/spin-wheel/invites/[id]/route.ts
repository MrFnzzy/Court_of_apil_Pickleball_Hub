import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

// Disables or re-enables a sent invite link without deleting its history.
// A revoked link's page shows "this invite has been disabled" and the
// spin can't be claimed, even if the customer still has the email — handy
// for a link sent to the wrong address, a prize config the admin wants to
// pull back, or a customer who no longer qualifies. Unlike DELETE, this
// keeps the invite (and any prize it already won) visible in the list.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const revoked = !!body.revoked;

    const invite = await prisma.spinInvite.update({
      where: { id: params.id },
      data: { revokedAt: revoked ? new Date() : null },
      include: { prize: { select: { label: true } }, discount: { select: { code: true, percentage: true } } },
    });
    return NextResponse.json({ success: true, invite });
  } catch (err: any) {
    console.error(err);
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await prisma.spinInvite.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error(err);
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "That value is already in use." }, { status: 409 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
