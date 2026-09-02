import { randomBytes } from "crypto";
import type { Prisma as PrismaNS } from "@prisma/client";

// Alphabet deliberately excludes visually-ambiguous characters (0/O, 1/I/L)
// since this code gets read off a phone screen and typed back in by hand.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

function randomCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `HPH-${out}`;
}

// Generates a bookingRef guaranteed not to collide with an existing one.
// Not DB-unique-constrained (a multi-day booking's several rows share one
// ref on purpose — see the schema comment), so the collision check queries
// for any existing row already using a candidate code. Collisions are rare
// (32^6 ≈ 1 billion possibilities) so this virtually always succeeds on the
// first try; the retry loop is just a safety net.
export async function generateBookingRef(tx: PrismaNS.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomCode();
    const existing = await tx.booking.findFirst({ where: { bookingRef: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  // Astronomically unlikely to ever reach here — fall back to a longer,
  // effectively-collision-proof code.
  return `HPH-${randomCode().slice(4)}${randomCode().slice(4)}`;
}
