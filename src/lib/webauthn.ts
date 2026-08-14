import { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { prisma } from "./prisma";
import { secretKey } from "./auth";

export const RP_NAME = "Heide's Pickleball Hub — Admin";

const REG_CHALLENGE_COOKIE = "coa_passkey_reg_challenge";
const LOGIN_CHALLENGE_COOKIE = "coa_passkey_login_challenge";

// The relying party ID/origin are derived from the actual request rather
// than a hardcoded env var, so this works unchanged on localhost, any
// Vercel preview URL, and the production custom domain — a passkey
// registered on one host simply won't be offered as a login option on a
// different one, which is correct WebAuthn behavior, not a bug to route
// around.
export function rpInfo(req: NextRequest) {
  return { rpID: req.nextUrl.hostname, origin: req.nextUrl.origin };
}

// ---------------------------------------------------------------------
// Short-lived signed challenge cookies (registration vs. login use
// separate cookies so a mid-flight registration can't be replayed as a
// login attempt or vice versa).
// ---------------------------------------------------------------------

async function setChallengeCookie(name: string, challenge: string, maxAgeSeconds: number) {
  const token = await new SignJWT({ challenge })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secretKey());
  cookies().set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

async function consumeChallengeCookie(name: string): Promise<string | null> {
  const token = cookies().get(name)?.value;
  cookies().delete(name);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.challenge === "string" ? payload.challenge : null;
  } catch {
    return null;
  }
}

export async function setRegistrationChallenge(challenge: string) {
  await setChallengeCookie(REG_CHALLENGE_COOKIE, challenge, 5 * 60);
}
export async function consumeRegistrationChallenge(): Promise<string | null> {
  return consumeChallengeCookie(REG_CHALLENGE_COOKIE);
}
export async function setLoginChallenge(challenge: string) {
  await setChallengeCookie(LOGIN_CHALLENGE_COOKIE, challenge, 2 * 60);
}
export async function consumeLoginChallenge(): Promise<string | null> {
  return consumeChallengeCookie(LOGIN_CHALLENGE_COOKIE);
}

// ---------------------------------------------------------------------
// DB access — there's only ever one admin identity, so these operate on
// "all registered passkeys" rather than a per-user scope.
// ---------------------------------------------------------------------

export async function listPasskeys() {
  return prisma.adminPasskey.findMany({ orderBy: { createdAt: "desc" } });
}

export async function credentialDescriptors() {
  const passkeys = await listPasskeys();
  return passkeys.map((p: { credentialId: string; transports: string[] }) => ({
    id: p.credentialId,
    transports: p.transports as AuthenticatorTransportFuture[],
  }));
}

export async function findPasskeyByCredentialId(credentialId: string) {
  return prisma.adminPasskey.findUnique({ where: { credentialId } });
}

export async function savePasskey(params: {
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports: string[];
  deviceType: string;
  backedUp: boolean;
  label: string;
}) {
  return prisma.adminPasskey.create({
    data: {
      credentialId: params.credentialId,
      publicKey: Buffer.from(params.publicKey),
      counter: params.counter,
      transports: params.transports,
      deviceType: params.deviceType,
      backedUp: params.backedUp,
      label: params.label,
    },
  });
}

export async function touchPasskeyCounter(credentialId: string, newCounter: number) {
  await prisma.adminPasskey.update({
    where: { credentialId },
    data: { counter: newCounter, lastUsedAt: new Date() },
  });
}

export async function deletePasskey(id: string) {
  await prisma.adminPasskey.delete({ where: { id } });
}

export {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
};
