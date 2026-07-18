'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';

// "Cerebro expuesto": muestra los pasos REALES emitidos por el worker.
// El motor corre en ~100 ms; la revelación se dosifica (~350 ms/línea)
// solo para que sea legible — los datos de cada línea son reales.
export default function TerminalIA() {
  const log = useAppStore((s) => s.pipelineLog);
  const [visibles, setVisibles] = useState(0);
  const [minimizado, setMinimizado] = useState(false);
  const cajaRef = useRef<HTMLDivElement>(null);

  // auto-scroll al fondo cuando aparece una línea nueva
  useEffect(() => {
    const caja = cajaRef.current;
    if (caja) caja.scrollTop = caja.scrollHeight;
  }, [visibles]);

  useEffect(() => {
    // reset (log limpiado) o avance de una línea, siempre asíncrono
    const t = setTimeout(
      () => setVisibles((v) => (v > log.length ? 0 : Math.min(v + 1, log.length))),
      visibles > log.length ? 0 : 350,
    );
    return () => clearTimeout(t);
  }, [log, visibles]);

  if (log.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-secondary/30 bg-black/50">
      <button
        type="button"
        aria-expanded={!minimizado}
        aria-controls="pensamiento-ia"
        onClick={() => setMinimizado((valor) => !valor)}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 text-left text-xs text-secondary transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
      >
        <span className="font-mono font-semibold uppercase tracking-wider">Pensamiento de la IA</span>
        <span className="ml-auto">{minimizado ? 'Mostrar' : 'Ocultar'}</span>
        <svg
          aria-hidden
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={`transition-transform ${minimizado ? 'rotate-180' : ''}`}
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {!minimizado && (
        <div
          id="pensamiento-ia"
          ref={cajaRef}
          className="h-28 min-h-16 max-h-[40dvh] resize-y overflow-y-auto px-3 pb-3 font-mono text-xs leading-relaxed"
        >
          {log.slice(0, visibles).map((paso, i) => (
            <p key={i} className={i === log.length - 1 ? 'text-primary' : 'text-secondary'}>
              <span className="text-primary">&gt;</span> {paso}
            </p>
          ))}
          {visibles < log.length && (
            <span
              aria-hidden
              className="inline-block h-3.5 w-2 animate-pulse bg-primary align-text-bottom"
            />
          )}
        </div>
      )}
    </div>
  );
}
