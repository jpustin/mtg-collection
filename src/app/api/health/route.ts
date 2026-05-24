export async function GET() {
  const checks: Record<string, unknown> = {
    status: "ok",
    env_database_url: process.env.DATABASE_URL ? "set" : "not set",
  };
  try {
    const { prisma } = await import("@/lib/prisma");
    const count = await prisma.collection.count();
    checks.db = { connected: true, collectionCount: count };
    const tables = await prisma.$queryRawUnsafe(
      "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position"
    );
    checks.columns = tables;
  } catch (e) {
    checks.db = {
      connected: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
  return Response.json(checks);
}
