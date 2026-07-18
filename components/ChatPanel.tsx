'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { crearRespuestaLocal } from '@/lib/asesor';
import { parseIntentRegex } from '@/lib/parseIntent';
import type {
  AdvisorContext,
  AdvisorMessage,
  AdvisorReply,
  AdvisorToolEvent,
  SearchParams,
} from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/store/useToastStore';

interface Msg extends AdvisorMessage {
  warning?: boolean;
  tools?: AdvisorToolEvent[];
}

const BIENVENIDA: Msg = {
  role: 'assistant',
  content:
    'Soy Ayni, el asesor de GeoSpot. Cuéntame la solicitud en una frase —por ejemplo, “bodega, S/ 15,000 a 18 meses”— y te ayudaré a revisar el riesgo y las alternativas.',
};

const SUGERENCIAS = [
  '¿Cuál es el principal riesgo?',
  'Compara cuotas por plazo',
  '¿Qué dato falta para decidir?',
];

export default function ChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([BIENVENIDA]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<'ready' | 'online' | 'local'>('ready');
  const analysis = useAppStore((s) => s.analysis);
  const status = useAppStore((s) => s.status);
  const searchParams = useAppStore((s) => s.searchParams);
  const selectedPoint = useAppStore((s) => s.selectedPoint);
  const setSearchParams = useAppStore((s) => s.setSearchParams);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  const lastAdvisedRef = useRef<string | null>(null);
  const fallbackNotifiedRef = useRef(false);

  const contexto = useMemo<AdvisorContext>(
    () => ({
      searchParams,
      selectedPoint,
      score: analysis?.score ?? null,
      stats: analysis?.stats ?? null,
      usedIsochroneFallback: analysis?.usedIsochroneFallback ?? false,
    }),
    [analysis, searchParams, selectedPoint],
  );
  const analysisKey = useMemo(
    () =>
      contexto.stats && contexto.score != null
        ? JSON.stringify([selectedPoint, contexto.score, contexto.stats, searchParams])
        : null,
    [contexto.score, contexto.stats, searchParams, selectedPoint],
  );

  useEffect(() => {
    messagesRef.current = messages;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const consultarAsesor = useCallback(
    async (
      historial: Msg[],
      event: 'message' | 'analysis_completed',
      textoFallback = '',
    ) => {
      setSending(true);
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: historial.map(({ role, content }) => ({ role, content })),
            context: contexto,
            event,
          }),
          signal: AbortSignal.timeout(28000),
        });
        if (!res.ok) throw new Error(`asesor ${res.status}`);

        const reply = (await res.json()) as AdvisorReply;
        if (typeof reply.message !== 'string') throw new Error('Respuesta de asesor inválida');
        setMode('online');
        if (reply.updates && Object.keys(reply.updates).length) {
          setSearchParams(reply.updates);
        }
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content: reply.message,
            tools: Array.isArray(reply.tools) ? reply.tools : [],
          },
        ]);
      } catch {
        const extracted = textoFallback ? parseIntentRegex(textoFallback) : null;
        const updates: Partial<SearchParams> = {};
        if (!contexto.searchParams.rubro && extracted?.rubro) updates.rubro = extracted.rubro;
        if (!contexto.searchParams.montoSoles && extracted?.montoSoles)
          updates.montoSoles = extracted.montoSoles;
        if (Object.keys(updates).length) setSearchParams(updates);

        setMode('local');
        if (!fallbackNotifiedRef.current) {
          fallbackNotifiedRef.current = true;
          toast('warning', 'Asesor IA sin conexión. Continuando con evaluación local.');
        }
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content: crearRespuestaLocal({
              ...contexto,
              searchParams: { ...contexto.searchParams, ...updates },
              score: Object.keys(updates).length ? null : contexto.score,
              stats: Object.keys(updates).length ? null : contexto.stats,
            }),
            warning: true,
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [contexto, setSearchParams],
  );

  useEffect(() => {
    if (
      status !== 'done' ||
      !analysisKey ||
      sending ||
      lastAdvisedRef.current === analysisKey
    )
      return;
    lastAdvisedRef.current = analysisKey;
    void consultarAsesor(messagesRef.current, 'analysis_completed');
  }, [analysisKey, consultarAsesor, sending, status]);

  const enviar = (value = input) => {
    const texto = value.trim();
    if (!texto || sending) return;
    if (value === input) setInput('');
    setSending(true);
    const historial = [...messagesRef.current, { role: 'user', content: texto } satisfies Msg];
    setMessages(historial);
    void consultarAsesor(historial, 'message', texto);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black/10">
      <div className="flex items-center gap-3 border-b border-secondary/20 px-4 py-3">
        <span className="relative grid h-9 w-9 place-items-center rounded-full border border-primary/40 bg-primary/10 font-mono text-xs font-bold text-primary">
          AI
          <span
            aria-hidden
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${
              mode === 'local' ? 'bg-warning' : mode === 'online' ? 'bg-success' : 'bg-secondary'
            }`}
          />
        </span>
        <div>
          <p className="text-sm font-semibold">Ayni · Asesor financiero</p>
          <p className="text-xs text-secondary">
            {mode === 'local'
              ? 'Modo local · motor territorial disponible'
              : mode === 'online'
                ? 'IA conectada · herramientas verificables'
                : 'Motor territorial y simulador listos'}
          </p>
        </div>
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-label="Conversación con el asesor"
        className="flex-1 space-y-3 overflow-y-auto p-4"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] rounded-sm border px-3 py-2.5 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'ml-auto border-primary/35 bg-primary/10 text-foreground'
                : m.warning
                  ? 'border-warning/40 bg-warning/10 text-foreground'
                  : 'border-secondary/20 bg-surface/80 text-foreground'
            }`}
          >
            {m.role === 'assistant' ? (
              <RespuestaFormateada contenido={m.content} />
            ) : (
              <p className="whitespace-pre-wrap">{m.content}</p>
            )}
            {m.tools?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-secondary/15 pt-2">
                {m.tools.map((tool, toolIndex) => (
                  <span
                    key={`${tool.nombre}-${toolIndex}`}
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                      tool.estado === 'ok'
                        ? 'border-primary/25 text-primary'
                        : 'border-warning/30 text-warning'
                    }`}
                  >
                    {tool.estado === 'ok' ? '✓' : '!'} {tool.etiqueta}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {sending && (
          <div role="status" className="flex items-center gap-2 text-xs text-secondary">
            <span className="flex gap-1" aria-hidden>
              <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
              <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
            </span>
            Ayni está consultando sus herramientas…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {analysis?.stats && !sending ? (
        <div className="flex gap-2 overflow-x-auto border-t border-secondary/20 px-3 py-2">
          {SUGERENCIAS.map((sugerencia) => (
            <button
              key={sugerencia}
              type="button"
              onClick={() => enviar(sugerencia)}
              className="shrink-0 rounded-full border border-secondary/25 px-2.5 py-1 text-xs text-secondary transition-colors hover:border-primary/50 hover:text-primary"
            >
              {sugerencia}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="border-t border-secondary/30 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            rows={2}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder="Pregunta, corrige un dato o pide una simulación…"
            className="min-h-11 flex-1 resize-none rounded-sm border border-secondary/30 bg-black/30 px-3 py-2 text-sm placeholder:text-secondary focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Enviar al asesor"
            className="btn-primary grid h-11 w-11 shrink-0 place-items-center"
          >
            <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden>
              <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-[10px] text-secondary">
          Apoyo analítico · la decisión final sigue la política crediticia de la entidad.
        </p>
      </form>
    </div>
  );
}

function RespuestaFormateada({ contenido }: { contenido: string }) {
  return (
    <div className="space-y-1.5">
      {contenido.split('\n').map((linea, indice) => {
        if (!linea.trim()) return <span key={indice} aria-hidden className="block h-1" />;

        const itemNumerado = linea.match(/^\s*(\d+)\.\s+(.+)$/);
        if (itemNumerado) {
          return (
            <p key={indice} className="grid grid-cols-[1.25rem_1fr] gap-1">
              <span className="text-secondary">{itemNumerado[1]}.</span>
              <span>{formatearNegritas(itemNumerado[2])}</span>
            </p>
          );
        }

        return <p key={indice}>{formatearNegritas(linea)}</p>;
      })}
    </div>
  );
}

function formatearNegritas(texto: string) {
  return texto.split(/(\*\*.+?\*\*)/g).map((parte, indice) =>
    parte.startsWith('**') && parte.endsWith('**') ? (
      <strong key={indice} className="font-semibold text-primary">
        {parte.slice(2, -2)}
      </strong>
    ) : (
      parte
    ),
  );
}
