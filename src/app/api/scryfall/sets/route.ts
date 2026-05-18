import { getAllSets } from "@/lib/scryfall";

export async function GET() {
  const result = await getAllSets();
  const sorted = result.data.sort(
    (a, b) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime()
  );
  return Response.json({ data: sorted });
}
