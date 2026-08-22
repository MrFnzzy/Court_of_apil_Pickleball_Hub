import { NextRequest, NextResponse } from "next/server";
import { createAdminSession, verifyOtpChallenge, createTrustedDeviceCookie, deviceLabelFromUserAgent } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { code, trustDevice } = await req.json();

    if (typeof code !== "string") {
      return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
    }

    const result = await verifyOtpChallenge(code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, locked: result.locked ?? false }, { status: 401 });
    }

    await createAdminSession();

    if (trustDevice) {
      const label = deviceLabelFromUserAgent(req.headers.get("user-agent"));
      await createTrustedDeviceCookie(label);
    }

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
