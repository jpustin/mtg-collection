import { prisma } from "@/lib/prisma";

export async function GET() {
  const collections = await prisma.collection.findMany({
    include: {
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(collections);
}

export async function POST(request: Request) {
  const { name } = await request.json();
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const collection = await prisma.collection.create({
    data: { name: name.trim() },
  });
  return Response.json(collection, { status: 201 });
}
