import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const body = await request.json();
  const item = await prisma.collectionItem.update({
    where: { id: itemId },
    data: {
      ...(body.condition !== undefined && { condition: body.condition }),
      ...(body.isFoil !== undefined && { isFoil: body.isFoil }),
      ...(body.quantity !== undefined && { quantity: body.quantity }),
      ...(body.priceUsd !== undefined && { priceUsd: body.priceUsd }),
      ...(body.priceUsdFoil !== undefined && { priceUsdFoil: body.priceUsdFoil }),
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
