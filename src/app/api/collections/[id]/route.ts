import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collection = await prisma.collection.findUnique({ where: { id } });
  if (!collection) {
    return Response.json({ error: "Collection not found" }, { status: 404 });
  }
  return Response.json(collection);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const json = await request.json();
  const collection = await prisma.collection.update({ where: { id }, data: json });
  return Response.json(collection);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.collection.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
