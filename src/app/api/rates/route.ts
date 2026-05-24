let cached: { rate: number; timestamp: number } | null = null;

export async function GET() {
  const now = Date.now();
  if (cached && now - cached.timestamp < 3600000) {
    return Response.json({ aud: cached.rate });
  }

  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    if (res.ok) {
      const data = await res.json();
      const aud = data.rates?.AUD;
      if (aud) {
        cached = { rate: aud, timestamp: now };
        return Response.json({ aud });
      }
    }
  } catch {}

  if (cached) return Response.json({ aud: cached.rate });
  return Response.json({ aud: 0.72 });
}
