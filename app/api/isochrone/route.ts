import type { NextRequest } from 'next/server';

// Proxy a Geoapify Isoline API: polígono de X minutos a pie desde un punto.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lng = Number(sp.get('lng'));
  const lat = Number(sp.get('lat'));
  const minutes = Number(sp.get('minutes') ?? 10);

  if (!Number.isFinite(lng) || !Number.isFinite(lat) || !sp.get('lng') || !sp.get('lat')) {
    return Response.json({ error: 'Parámetros "lng" y "lat" numéricos requeridos' }, { status: 400 });
  }

  const url =
    `https://api.geoapify.com/v1/isoline?lat=${lat}&lon=${lng}` +
    `&type=time&mode=walk&range=${minutes * 60}` +
    `&apiKey=${process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return Response.json({ error: `Geoapify respondió ${res.status}` }, { status: 502 });
    }
    // GeoJSON FeatureCollection con el polígono de la isócrona
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: 'Timeout o fallo de red con Geoapify' }, { status: 502 });
  }
}
