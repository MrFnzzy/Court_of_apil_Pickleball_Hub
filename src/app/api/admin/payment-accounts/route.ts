import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accounts = await prisma.paymentAccount.findMany({ orderBy: { method: "asc" } });
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { method, accountName, accountNumber, qrImageUrl, active = true } = body;

  if (!["GCASH", "MAYA", "BPI"].includes(method) || !accountName || !accountNumber) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const account = await prisma.paymentAccount.create({
    data: { method, accountName, accountNumber, qrImageUrl, active },
  });

  return NextResponse.json({ success: true, account });
}
