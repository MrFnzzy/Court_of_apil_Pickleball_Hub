import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Unlike the other public settings routes, payment accounts are meant to
// only change when the site is redeployed — not live, the moment an admin
// saves an edit. Statically generating this route caches its response at
// build time and serves that same cached response on every request until
// the next deploy, when it's regenerated.
export const dynamic = "force-static";

export async function GET() {
  try {
    const accounts = await prisma.paymentAccount.findMany({
      where: { active: true },
      orderBy: { method: "asc" },
    });
    return NextResponse.json({ accounts });

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
