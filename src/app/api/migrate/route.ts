import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const statements = [
      'ALTER TABLE "CollectionItem" ADD COLUMN IF NOT EXISTS "game" TEXT NOT NULL DEFAULT \'paper\'',
      'ALTER TABLE "CollectionItem" ADD COLUMN IF NOT EXISTS "priceTix" DOUBLE PRECISION',
      'ALTER TABLE "CollectionItem" ADD COLUMN IF NOT EXISTS "priceEur" DOUBLE PRECISION',
      'ALTER TABLE "CollectionItem" ADD COLUMN IF NOT EXISTS "priceEurFoil" DOUBLE PRECISION',
      'ALTER TABLE "CollectionItem" ADD COLUMN IF NOT EXISTS "lang" TEXT NOT NULL DEFAULT \'en\'',
      'ALTER TABLE "CollectionItem" ADD COLUMN IF NOT EXISTS "tcgplayerUrl" TEXT',
      'ALTER TABLE "CollectionItem" ADD COLUMN IF NOT EXISTS "cardmarketUrl" TEXT',
      'UPDATE "CollectionItem" SET "game" = \'paper\' WHERE "game" = \'mtgo\'',
    ];
    for (const sql of statements) {
      await prisma.$executeRawUnsafe(sql);
    }
    return Response.json({ ok: true, message: "Migration complete" });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
