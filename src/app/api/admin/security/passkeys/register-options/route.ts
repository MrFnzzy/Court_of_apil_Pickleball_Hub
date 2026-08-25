import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import {
  RP_NAME,
  rpInfo,
  credentialDescriptors,
  generateRegistrationOptions,
  setRegistrationChallenge,
} from "@/lib/webauthn";

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { rpID } = rpInfo(req);
    const excludeCredentials = await credentialDescriptors();

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userName: "admin",
      userDisplayName: "Court manager",
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    await setRegistrationChallenge(options.challenge);
    return NextResponse.json({ options });

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
