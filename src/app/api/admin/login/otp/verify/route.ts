import { NextRequest, NextResponse } from "next/server";
import { createAdminSession, verifyOtpChallenge, createTrustedDeviceCookie, deviceLabelFromUserAgent } from "@/lib/auth";

export async function POST(req: NextRequest) {
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
}
