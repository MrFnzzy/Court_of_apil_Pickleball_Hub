import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { listPasskeys, deletePasskey } from "@/lib/webauthn";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const passkeys = await listPasskeys();
  return NextResponse.json({
    passkeys: passkeys.map((p: { id: string; label: string; deviceType: string; createdAt: Date; lastUsedAt: Date | null }) => ({
      id: p.id,
      label: p.label,
      deviceType: p.deviceType,
      createdAt: p.createdAt,
      lastUsedAt: p.lastUsedAt,
    })),
  });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (typeof id !== "string") return NextResponse.json({ error: "Missing id." }, { status: 400 });

  await deletePasskey(id).catch(() => null);
  return NextResponse.json({ success: true });
}
