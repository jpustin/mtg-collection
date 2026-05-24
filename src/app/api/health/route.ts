export async function GET() {
  const checks: Record<string, string | object> = {
    status: "ok",
    env_database_url: process.env.DATABASE_URL ? "set" : "not set",
  };
  try {
    const { prisma } = await import("@/lib/prisma");
    const count = await prisma.collection.count();
    checks.db = { connected: true, collectionCount: count };
  } catch (e) {
    checks.db = {
      connected: false,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5).join("\n") : undefined,
    };
  }
  return Response.json(checks);
}
