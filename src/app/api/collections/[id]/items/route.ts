import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const items = await prisma.collectionItem.findMany({
    where: { collectionId: id },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(items);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const item = await prisma.collectionItem.create({
    data: {
      collectionId: id,
      scryfallId: body.scryfallId,
      oracleId: body.oracleId,
      cardName: body.cardName,
      setCode: body.setCode,
      setName: body.setName,
      imageUrl: body.imageUrl,
      condition: body.condition || "NM",
      isFoil: body.isFoil || false,
      quantity: body.quantity || 1,
      game: body.game || "paper",
      priceUsd: body.priceUsd ?? null,
      priceUsdFoil: body.priceUsdFoil ?? null,
      priceTix: body.priceTix ?? null,
    },
  });
  return Response.json(item, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { ids } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "ids array is required" }, { status: 400 });
  }
  await prisma.collectionItem.deleteMany({
    where: { collectionId: id, id: { in: ids } },
  });
  return new Response(null, { status: 204 });
}
