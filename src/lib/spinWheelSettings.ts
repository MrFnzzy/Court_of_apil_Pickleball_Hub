import { prisma } from "./prisma";

const SINGLETON_ID = "singleton";

export type SpinWheelSettings = {
  enabled: boolean;
  startDate: Date | null;
  minHoursForSpin: number;
  inviteExpiryDays: number | null;
};

// Reads the current spin-wheel settings, creating the singleton row
// (feature off, no start date, any booking qualifies) on first use.
export async function getSpinWheelSettings(): Promise<SpinWheelSettings> {
  const row = await prisma.spinWheelSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  });
  return {
    enabled: row.enabled,
    startDate: row.startDate,
    minHoursForSpin: row.minHoursForSpin,
    inviteExpiryDays: row.inviteExpiryDays,
  };
}

export async function updateSpinWheelSettings(data: Partial<SpinWheelSettings>): Promise<SpinWheelSettings> {
  const row = await prisma.spinWheelSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });
  return {
    enabled: row.enabled,
    startDate: row.startDate,
    minHoursForSpin: row.minHoursForSpin,
    inviteExpiryDays: row.inviteExpiryDays,
  };
}

// Computes the expiresAt to stamp on a newly created SpinInvite, given the
// admin's current inviteExpiryDays setting. Kept in one place so the
// automatic post-booking sweep (spinWheelEmail.ts) and the admin's manual
// "send an invite" route stay in sync.
export function computeInviteExpiresAt(inviteExpiryDays: number | null, from: Date = new Date()): Date | null {
  if (inviteExpiryDays == null) return null;
  return new Date(from.getTime() + inviteExpiryDays * 24 * 60 * 60 * 1000);
}
