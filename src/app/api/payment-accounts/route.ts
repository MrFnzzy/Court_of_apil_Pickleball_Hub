import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Same reasoning as /api/site-settings — force fresh data on every request.
export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = await prisma.paymentAccount.findMany({
    where: { active: true },
    orderBy: { method: "asc" },
  });
  return NextResponse.json({ accounts });
}
