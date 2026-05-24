import { prisma } from "@/lib/prisma";
import { fallbackPrices } from "@/lib/pricing";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const body = await request.json();

  // If any price field was supplied in this PATCH, run fallback against the
  // resulting (oracleId, setCode) so a freshly-picked print that lacks prices
  // can pick up its same-set sibling's prices instead.
  const pricesSent =
    body.priceUsd !== undefined ||
    body.priceUsdFoil !== undefined ||
    body.priceEur !== undefined ||
    body.priceEurFoil !== undefined ||
    body.priceTix !== undefined;

  let resolvedPrices: Partial<{
    priceUsd: number | null;
    priceUsdFoil: number | null;
    priceEur: number | null;
    priceEurFoil: number | null;
    priceTix: number | null;
    tcgplayerUrl: string | null;
    cardmarketUrl: string | null;
  }> = {};

  if (pricesSent) {
    let oracleId: string | null = body.oracleId ?? null;
    let setCode: string | null = body.setCode ?? null;
    if (!oracleId || !setCode) {
      const existing = await prisma.collectionItem.findUnique({
        where: { id: itemId },
        select: { oracleId: true, setCode: true },
      });
      oracleId = oracleId ?? existing?.oracleId ?? null;
      setCode = setCode ?? existing?.setCode ?? null;
    }
    const p = await fallbackPrices({
      oracleId,
      setCode,
      priceUsd: body.priceUsd,
      priceUsdFoil: body.priceUsdFoil,
      priceEur: body.priceEur,
      priceEurFoil: body.priceEurFoil,
      priceTix: body.priceTix,
      tcgplayerUrl: body.tcgplayerUrl,
      cardmarketUrl: body.cardmarketUrl,
    });
    resolvedPrices = p;
  }

  const item = await prisma.collectionItem.update({
    where: { id: itemId },
    data: {
      ...(body.condition !== undefined && { condition: body.condition }),
      ...(body.isFoil !== undefined && { isFoil: body.isFoil }),
      ...(body.quantity !== undefined && { quantity: body.quantity }),
      ...(body.game !== undefined && { game: body.game }),
      ...(body.scryfallId !== undefined && { scryfallId: body.scryfallId }),
      ...(body.oracleId !== undefined && { oracleId: body.oracleId }),
      ...(body.setCode !== undefined && { setCode: body.setCode }),
      ...(body.setName !== undefined && { setName: body.setName }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
      ...(pricesSent && {
        priceUsd: resolvedPrices.priceUsd ?? null,
        priceUsdFoil: resolvedPrices.priceUsdFoil ?? null,
        priceEur: resolvedPrices.priceEur ?? null,
        priceEurFoil: resolvedPrices.priceEurFoil ?? null,
        priceTix: resolvedPrices.priceTix ?? null,
        tcgplayerUrl: resolvedPrices.tcgplayerUrl ?? null,
        cardmarketUrl: resolvedPrices.cardmarketUrl ?? null,
      }),
      ...(body.lang !== undefined && { lang: body.lang }),
    },
  });
  return Response.json(item);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  await prisma.collectionItem.delete({ where: { id: itemId } });
  return new Response(null, { status: 204 });
}
