import { prisma } from "./prisma";
import { DEFAULT_RENTAL_PRODUCTS, RentalProduct, RentalProductType } from "./pricing";

// Reads every rental product (both types, active and inactive), seeding the
// table with the original 4 default tiers the very first time it's read
// (e.g. right after this feature is deployed) so existing pricing carries
// over instead of suddenly showing "no rentals available".
export async function getRentalProducts(): Promise<RentalProduct[]> {
  const count = await prisma.rentalProduct.count();
  if (count === 0) {
    await prisma.rentalProduct.createMany({
      data: DEFAULT_RENTAL_PRODUCTS.map(({ id, ...rest }) => rest),
      skipDuplicates: true,
    });
  }
  const rows = await prisma.rentalProduct.findMany({
    orderBy: [{ type: "asc" }, { order: "asc" }, { quantity: "asc" }],
  });
  return rows;
}

// Same as above but filtered to what customers/admins should be able to
// pick right now — used by the public pricing endpoint and the booking
// flows. Kept as a thin wrapper so callers don't have to repeat the filter.
export async function getActiveRentalProducts(): Promise<RentalProduct[]> {
  const all = await getRentalProducts();
  return all.filter((p) => p.active);
}

export async function createRentalProduct(data: {
  type: RentalProductType;
  quantity: number;
  price: number;
  label?: string | null;
  active?: boolean;
  order?: number;
}): Promise<RentalProduct> {
  // New tiers default to sorting after whatever already exists for that
  // type, so a freshly-added product doesn't jump ahead of the admin's
  // existing order.
  let order = data.order;
  if (order === undefined) {
    const last = await prisma.rentalProduct.findFirst({
      where: { type: data.type },
      orderBy: { order: "desc" },
    });
    order = (last?.order ?? -1) + 1;
  }
  return prisma.rentalProduct.create({
    data: {
      type: data.type,
      quantity: data.quantity,
      price: data.price,
      label: data.label?.trim() || null,
      active: data.active ?? true,
      order,
    },
  });
}

export async function updateRentalProduct(
  id: string,
  data: Partial<{ quantity: number; price: number; label: string | null; active: boolean; order: number }>
): Promise<RentalProduct> {
  const update: Record<string, unknown> = { ...data };
  if ("label" in update) update.label = (update.label as string | null)?.toString().trim() || null;
  return prisma.rentalProduct.update({ where: { id }, data: update });
}

export async function deleteRentalProduct(id: string): Promise<void> {
  await prisma.rentalProduct.delete({ where: { id } });
}
