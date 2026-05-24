let cached: { aud: number; eurAud: number; timestamp: number } | null = null;

export async function GET() {
  const now = Date.now();
  if (cached && now - cached.timestamp < 3600000) {
    return Response.json({ aud: cached.aud, eurAud: cached.eurAud });
  }

  let aud: number | null = null;
  let eurAud: number | null = null;

  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    if (res.ok) {
      const data = await res.json();
      if (typeof data.rates?.AUD === "number") aud = data.rates.AUD;
    }
  } catch {}

  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
    if (res.ok) {
      const data = await res.json();
      if (typeof data.rates?.AUD === "number") eurAud = data.rates.AUD;
    }
  } catch {}

  if (aud != null && eurAud != null) {
    cached = { aud, eurAud, timestamp: now };
    return Response.json({ aud, eurAud });
  }

  if (cached) return Response.json({ aud: cached.aud, eurAud: cached.eurAud });
  return Response.json({ aud: aud ?? 1.5, eurAud: eurAud ?? 1.65 });
}
