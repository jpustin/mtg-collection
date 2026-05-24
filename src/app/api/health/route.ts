export async function POST() {
  const results: Record<string, string> = {};
  try {
    const { prisma } = await import("@/lib/prisma");

    results.dropItems = "dropping CollectionItem table...";
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "CollectionItem"');
    results.dropCollection = "dropping Collection table...";
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "Collection"');

    results.createCollection = "creating Collection table...";
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "Collection" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    results.createItems = "creating CollectionItem table...";
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "CollectionItem" (
        "id" TEXT PRIMARY KEY,
        "collectionId" TEXT NOT NULL REFERENCES "Collection"(id) ON DELETE CASCADE,
        "scryfallId" TEXT NOT NULL,
        "oracleId" TEXT NOT NULL,
        "cardName" TEXT NOT NULL,
        "setCode" TEXT NOT NULL,
        "setName" TEXT NOT NULL,
        "imageUrl" TEXT,
        "condition" TEXT DEFAULT 'NM',
        "isFoil" BOOLEAN DEFAULT false,
        "quantity" INTEGER DEFAULT 1,
        "priceUsd" DOUBLE PRECISION,
        "priceUsdFoil" DOUBLE PRECISION,
        "priceUpdatedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    results.createIndex1 = "creating index on collectionId...";
    await prisma.$executeRawUnsafe(
      'CREATE INDEX idx_collection_item_collection ON "CollectionItem"("collectionId")'
    );
    results.createIndex2 = "creating index on scryfallId...";
    await prisma.$executeRawUnsafe(
      'CREATE INDEX idx_collection_item_scryfall ON "CollectionItem"("scryfallId")'
    );

    results.done = "Schema recreated successfully";
    return Response.json(results);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e), ...results },
      { status: 500 }
    );
  }
}
