import { prisma } from "@/lib/prisma";
import { getCardById } from "@/lib/scryfall";
import { fallbackPrices } from "@/lib/pricing";

export async function POST() {
  const items = await prisma.collectionItem.findMany({
    select: {
      id: true,
      scryfallId: true,
      oracleId: true,
      setCode: true,
      cardName: true,
    },
  });

  let updated = 0;
  for (const item of items) {
    await new Promise((r) => setTimeout(r, 120));
    try {
      const card = await getCardById(item.scryfallId);
      const priceUsd = card?.prices?.usd ? parseFloat(card.prices.usd) : null;
      const priceUsdFoil = card?.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : null;
      const priceEur = card?.prices?.eur ? parseFloat(card.prices.eur) : null;
      const priceEurFoil = card?.prices?.eur_foil ? parseFloat(card.prices.eur_foil) : null;
      const priceTix = card?.prices?.tix ? parseFloat(card.prices.tix) : null;
      const tcgplayerUrl = card?.purchase_uris?.tcgplayer ?? null;
      const cardmarketUrl = card?.purchase_uris?.cardmarket ?? null;

      // If this exact print has no prices, fall back to another printing
      // in the same set (matched on oracleId + setCode). This typically
      // resolves foreign-language prints (e.g. Italian Legends Moat) to
      // the English same-set price.
      const resolved = await fallbackPrices({
        oracleId: item.oracleId,
        setCode: item.setCode,
        priceUsd,
        priceUsdFoil,
        priceEur,
        priceEurFoil,
        priceTix,
        tcgplayerUrl,
        cardmarketUrl,
      });

      await prisma.collectionItem.update({
        where: { id: item.id },
        data: {
          priceUsd: resolved.priceUsd,
          priceUsdFoil: resolved.priceUsdFoil,
          priceEur: resolved.priceEur,
          priceEurFoil: resolved.priceEurFoil,
          priceTix: resolved.priceTix,
          tcgplayerUrl: resolved.tcgplayerUrl,
          cardmarketUrl: resolved.cardmarketUrl,
          priceUpdatedAt: new Date(),
        },
      });
      updated++;
    } catch {
      continue;
    }
  }

  return Response.json({ updated });
}
