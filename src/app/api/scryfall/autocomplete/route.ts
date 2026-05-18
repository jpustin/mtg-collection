import { autocompleteCards } from "@/lib/scryfall";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q || q.length < 2) {
    return Response.json({ data: [] });
  }
  const result = await autocompleteCards(q);
  return Response.json(result);
}
