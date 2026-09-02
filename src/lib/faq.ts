import { prisma } from "./prisma";
import { FAQ_ENTRIES } from "./faqData";

export type Faq = {
  id: string;
  question: string;
  answer: string;
  link: string | null;
  linkLabel: string | null;
  active: boolean;
  order: number;
};

// Reads every FAQ (active and inactive), seeding the table with the
// original hardcoded FAQ_ENTRIES the very first time it's read (e.g. right
// after this feature is deployed) so existing content carries over instead
// of the site suddenly showing an empty FAQ section.
export async function getFaqs(): Promise<Faq[]> {
  const count = await prisma.faq.count();
  if (count === 0) {
    await prisma.faq.createMany({
      data: FAQ_ENTRIES.map((e, i) => ({
        question: e.q,
        answer: e.a,
        link: e.link ?? null,
        linkLabel: e.linkLabel ?? null,
        order: i,
      })),
    });
  }
  return prisma.faq.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
}

// Same as above but filtered to what customers should actually see — used
// by the public FAQ endpoint and the Ask AI assistant.
export async function getActiveFaqs(): Promise<Faq[]> {
  const all = await getFaqs();
  return all.filter((f) => f.active);
}

export async function createFaq(data: {
  question: string;
  answer: string;
  link?: string | null;
  linkLabel?: string | null;
  active?: boolean;
  order?: number;
}): Promise<Faq> {
  // New entries default to sorting after whatever already exists, so a
  // freshly-added FAQ doesn't jump ahead of the admin's existing order.
  let order = data.order;
  if (order === undefined) {
    const last = await prisma.faq.findFirst({ orderBy: { order: "desc" } });
    order = (last?.order ?? -1) + 1;
  }
  return prisma.faq.create({
    data: {
      question: data.question.trim(),
      answer: data.answer.trim(),
      link: data.link?.trim() || null,
      linkLabel: data.linkLabel?.trim() || null,
      active: data.active ?? true,
      order,
    },
  });
}

export async function updateFaq(
  id: string,
  data: Partial<{
    question: string;
    answer: string;
    link: string | null;
    linkLabel: string | null;
    active: boolean;
    order: number;
  }>
): Promise<Faq> {
  const update: Record<string, unknown> = { ...data };
  if ("question" in update) update.question = (update.question as string).toString().trim();
  if ("answer" in update) update.answer = (update.answer as string).toString().trim();
  if ("link" in update) update.link = (update.link as string | null)?.toString().trim() || null;
  if ("linkLabel" in update) update.linkLabel = (update.linkLabel as string | null)?.toString().trim() || null;
  return prisma.faq.update({ where: { id }, data: update });
}

export async function deleteFaq(id: string): Promise<void> {
  await prisma.faq.delete({ where: { id } });
}
