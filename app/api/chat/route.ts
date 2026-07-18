const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

export async function POST(request: Request) {
  let messages: unknown;
  try {
    ({ messages } = await request.json());
  } catch {
    return Response.json({ error: 'Body JSON inválido' }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'Se requiere un array "messages" no vacío' }, { status: 400 });
  }

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
      // timeout corto: el cliente debe caer al parser Regex sin esperar demasiado
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return Response.json({ error: `Deepseek respondió ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    return Response.json({ content: data.choices?.[0]?.message?.content ?? null });
  } catch {
    return Response.json({ error: 'Timeout o fallo de red con Deepseek' }, { status: 502 });
  }
}
