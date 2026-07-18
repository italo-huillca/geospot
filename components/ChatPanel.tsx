'use client';

import { useEffect, useRef, useState } from 'react';
import { parseIntentRegex, parseLlmContent, SYSTEM_PROMPT, type IntentParams } from '@/lib/parseIntent';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/store/useToastStore';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  warning?: boolean; // aviso de fallback (naranja)
  mono?: boolean; // parámetros extraídos (fuente mono, Brief UI/UX)
}

const BIENVENIDA: Msg = {
  role: 'assistant',
  content:
    'Describe la solicitud a evaluar. Ej: "Bodega en el centro, piden S/ 15,000". La ubicación se marca con clic en el mapa.',
};

const resumen = (p: IntentParams) =>
  JSON.stringify({ rubro: p.rubro, monto_solicitado_soles: p.montoSoles }, null, 2);

export default function ChatPanel() {
  // Doc 05: el historial vive en estado local del componente, no se persiste.
  const [messages, setMessages] = useState<Msg[]>([BIENVENIDA]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const setSearchParams = useAppStore((s) => s.setSearchParams);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const enviar = async () => {
    const texto = input.trim();
    if (!texto || sending) return;
    setInput('');
    setSending(true);
    const historial = [...messages, { role: 'user', content: texto } as Msg];
    setMessages(historial);

    const { clearPipeline, pushPipeline } = useAppStore.getState();
    clearPipeline();
    pushPipeline('Ejecutando NLP (Deepseek) para extraer intención...');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...historial.filter((m) => !m.warning && !m.mono).map(({ role, content }) => ({ role, content })),
          ],
        }),
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) throw new Error(`proxy ${res.status}`);
      const { content } = await res.json();
      const { params, respuesta } = parseLlmContent(content);
      pushPipeline(`Intención extraída [rubro: ${params.rubro ?? '—'} · monto: ${params.montoSoles ?? '—'}]`);
      setSearchParams(params);
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: respuesta ?? 'Parámetros de búsqueda actualizados.' },
        { role: 'assistant', content: resumen(params), mono: true },
      ]);
    } catch {
      // Fallback de Lenguaje (Doc 03): el parser Regex local toma el control.
      toast('warning', 'Conexión lenta con IA. Activando modo de filtros básicos.');
      pushPipeline('LLM sin respuesta — parser Regex local toma el control');
      const params = parseIntentRegex(texto);
      setSearchParams(params);
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Modo básico activo. Esto fue lo que entendí:', warning: true },
        { role: 'assistant', content: resumen(params), mono: true },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'ml-auto bg-primary text-foreground'
                : m.warning
                  ? 'border border-warning/50 bg-warning/10 text-warning'
                  : m.mono
                    ? 'bg-black/40 font-mono text-xs text-accent'
                    : 'bg-accent/10 text-foreground'
            }`}
          >
            <pre className="whitespace-pre-wrap font-[inherit]">{m.content}</pre>
          </div>
        ))}
        {sending && <p className="text-sm text-secondary">Analizando solicitud...</p>}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex gap-2 border-t border-secondary/30 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe la solicitud de crédito..."
          className="flex-1 rounded-lg border border-secondary/30 bg-black/30 px-3 py-2 text-sm placeholder:text-secondary focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
