import { NextRequest, NextResponse } from "next/server";
import { rpInfo, credentialDescriptors, generateAuthenticationOptions, setLoginChallenge } from "@/lib/webauthn";

// Deliberately public (no isAdminAuthed check) — this IS how the admin
// signs in without a password. allowCredentials lists every passkey
// that's ever been registered (there's only ever one admin identity), so
// the browser can offer a "usernameless" picker.
export async function POST(req: NextRequest) {
  const { rpID } = rpInfo(req);
  const allowCredentials = await credentialDescriptors();

  if (allowCredentials.length === 0) {
    return NextResponse.json({ error: "No passkey has been set up for this admin yet." }, { status: 400 });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "preferred",
  });

  await setLoginChallenge(options.challenge);
  return NextResponse.json({ options });
}
