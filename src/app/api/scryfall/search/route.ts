import { searchCards } from "@/lib/scryfall";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const set = searchParams.get("set");
  if (!q) {
    return Response.json({ data: [] });
  }
  let query = `!"${q}"`;
  if (set) query += ` set:${set}`;
  query += " unique:prints";
  const result = await searchCards(query);
  return Response.json(result);
}
