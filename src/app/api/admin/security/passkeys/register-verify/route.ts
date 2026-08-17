import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, deviceLabelFromUserAgent } from "@/lib/auth";
import { rpInfo, consumeRegistrationChallenge, verifyRegistrationResponse, savePasskey } from "@/lib/webauthn";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { response, label } = await req.json();
  const { rpID, origin } = rpInfo(req);

  const expectedChallenge = await consumeRegistrationChallenge();
  if (!expectedChallenge) {
    return NextResponse.json({ error: "That registration attempt expired. Try again." }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Couldn't verify that passkey." }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Couldn't verify that passkey." }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await savePasskey({
    credentialId: credential.id,
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: credential.transports || [],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    label: typeof label === "string" && label.trim() ? label.trim() : deviceLabelFromUserAgent(req.headers.get("user-agent")),
  });

  return NextResponse.json({ success: true });
}
