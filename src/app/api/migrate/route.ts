import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "CollectionItem" ADD COLUMN IF NOT EXISTS "game" TEXT NOT NULL DEFAULT \'paper\''
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "CollectionItem" ADD COLUMN IF NOT EXISTS "priceTix" DOUBLE PRECISION'
    );
    return Response.json({ ok: true, message: "Migration complete" });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
