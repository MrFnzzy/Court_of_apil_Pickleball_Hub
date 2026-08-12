import { prisma } from "./prisma";

const SINGLETON_ID = "singleton";

export type PopupAdSettings = {
  enabled: boolean;
  imageUrl: string | null;
  headline: string | null;
  message: string | null;
  linkUrl: string | null;
  buttonText: string | null;
  updatedAt: Date;
};

// Reads the current popup ad, creating the singleton row (off, empty) on
// first use.
export async function getPopupAd(): Promise<PopupAdSettings> {
  const row = await prisma.popupAd.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  });
  return row;
}

export async function updatePopupAd(
  data: Partial<Omit<PopupAdSettings, "updatedAt">>
): Promise<PopupAdSettings> {
  const row = await prisma.popupAd.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });
  return row;
}
