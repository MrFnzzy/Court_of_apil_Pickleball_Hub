import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

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
