import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const accounts = await prisma.paymentAccount.findMany({
    where: { active: true },
    orderBy: { method: "asc" },
  });
  return NextResponse.json({ accounts });
}
