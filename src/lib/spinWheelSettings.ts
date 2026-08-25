import { prisma } from "./prisma";

const SINGLETON_ID = "singleton";

export type SpinWheelSettings = {
  enabled: boolean;
  startDate: Date | null;
  minHoursForSpin: number;
};

// Reads the current spin-wheel settings, creating the singleton row
// (feature off, no start date, any booking qualifies) on first use.
export async function getSpinWheelSettings(): Promise<SpinWheelSettings> {
  const row = await prisma.spinWheelSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  });
  return { enabled: row.enabled, startDate: row.startDate, minHoursForSpin: row.minHoursForSpin };
}

export async function updateSpinWheelSettings(data: Partial<SpinWheelSettings>): Promise<SpinWheelSettings> {
  const row = await prisma.spinWheelSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });
  return { enabled: row.enabled, startDate: row.startDate, minHoursForSpin: row.minHoursForSpin };
}
