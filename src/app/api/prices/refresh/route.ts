import { prisma } from "@/lib/prisma";
import { getCardById } from "@/lib/scryfall";

export async function POST() {
  const items = await prisma.collectionItem.findMany({
    select: { id: true, scryfallId: true, isFoil: true },
  });

  let updated = 0;
  for (const item of items) {
    try {
      const card = await getCardById(item.scryfallId);
      if (!card?.prices) continue;
      const priceUsd = card.prices.usd ? parseFloat(card.prices.usd) : null;
      const priceUsdFoil = card.prices.usd_foil ? parseFloat(card.prices.usd_foil) : null;
      await prisma.collectionItem.update({
        where: { id: item.id },
        data: { priceUsd, priceUsdFoil, priceUpdatedAt: new Date() },
      });
      updated++;
      await new Promise((r) => setTimeout(r, 100));
    } catch {
      continue;
    }
  }

  return Response.json({ updated });
}
