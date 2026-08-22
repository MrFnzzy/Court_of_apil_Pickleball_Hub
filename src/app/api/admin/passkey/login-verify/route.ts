import { NextRequest, NextResponse } from "next/server";
import { createAdminSession } from "@/lib/auth";
import {
  rpInfo,
  consumeLoginChallenge,
  verifyAuthenticationResponse,
  findPasskeyByCredentialId,
  touchPasskeyCounter,
} from "@/lib/webauthn";

// Deliberately public. A successful WebAuthn assertion already proves
// possession of a registered authenticator plus (typically) biometric or
// PIN verification on the device — by design this replaces password AND
// the email code, not just one of them.
export async function POST(req: NextRequest) {
  const { response } = await req.json();
  const { rpID, origin } = rpInfo(req);

  const expectedChallenge = await consumeLoginChallenge();
  if (!expectedChallenge) {
    return NextResponse.json({ error: "That sign-in attempt expired. Try again." }, { status: 400 });
  }

  const credentialId: string | undefined = response?.id;
  if (!credentialId) {
    return NextResponse.json({ error: "Malformed passkey response." }, { status: 400 });
  }

  const passkey = await findPasskeyByCredentialId(credentialId);
  if (!passkey) {
    return NextResponse.json({ error: "That passkey isn't registered here." }, { status: 401 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports as any,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Couldn't verify that passkey." }, { status: 401 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "Couldn't verify that passkey." }, { status: 401 });
  }

  await touchPasskeyCounter(passkey.credentialId, verification.authenticationInfo.newCounter);
  await createAdminSession();
  return NextResponse.json({ success: true });
}
