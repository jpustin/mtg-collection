export async function GET() {
  const checks: Record<string, string> = {
    status: "ok",
    env_database_url: process.env.DATABASE_URL ? "set" : "not set",
  };
  return Response.json(checks);
}
