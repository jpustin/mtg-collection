import { prisma } from "@/lib/prisma";
import { getCardById } from "@/lib/scryfall";

export async function POST() {
  const items = await prisma.collectionItem.findMany({
    select: { id: true, scryfallId: true, isFoil: true, cardName: true },
  });

  let updated = 0;
  for (const item of items) {
    await new Promise((r) => setTimeout(r, 120));
    try {
      const card = await getCardById(item.scryfallId);
      if (!card?.prices) continue;
      const priceUsd = card.prices.usd ? parseFloat(card.prices.usd) : null;
      const priceUsdFoil = card.prices.usd_foil ? parseFloat(card.prices.usd_foil) : null;
      const priceEur = card.prices.eur ? parseFloat(card.prices.eur) : null;
      const priceEurFoil = card.prices.eur_foil ? parseFloat(card.prices.eur_foil) : null;
      const priceTix = card.prices.tix ? parseFloat(card.prices.tix) : null;

      if (!priceUsd && !priceUsdFoil && !priceEur && !priceEurFoil && !priceTix) {
        const searchUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`!"${item.cardName}"`)}&unique=prints&order=usd&dir=desc`;
        const res = await fetch(searchUrl, {
          headers: { "User-Agent": "MTGCollectionApp/1.0" },
        });
        if (res.ok) {
          const data = await res.json();
          const priced = data.data?.find(
            (c: any) => c.prices?.usd || c.prices?.usd_foil || c.prices?.eur || c.prices?.tix
          );
          if (priced) {
            await prisma.collectionItem.update({
              where: { id: item.id },
              data: {
                scryfallId: priced.id,
                priceUsd: priced.prices?.usd ? parseFloat(priced.prices.usd) : null,
                priceUsdFoil: priced.prices?.usd_foil ? parseFloat(priced.prices.usd_foil) : null,
                priceEur: priced.prices?.eur ? parseFloat(priced.prices.eur) : null,
                priceEurFoil: priced.prices?.eur_foil ? parseFloat(priced.prices.eur_foil) : null,
                priceTix: priced.prices?.tix ? parseFloat(priced.prices.tix) : null,
                priceUpdatedAt: new Date(),
              },
            });
            updated++;
            continue;
          }
        }
      }

      await prisma.collectionItem.update({
        where: { id: item.id },
        data: { priceUsd, priceUsdFoil, priceEur, priceEurFoil, priceTix, priceUpdatedAt: new Date() },
      });
      updated++;
    } catch {
      continue;
    }
  }

  return Response.json({ updated });
}
