import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const devices = await prisma.adminTrustedDevice.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true, expiresAt: true },
  });
  return NextResponse.json({ devices });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (typeof id !== "string") return NextResponse.json({ error: "Missing id." }, { status: 400 });

  await prisma.adminTrustedDevice.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ success: true });
}
