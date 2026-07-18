'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';

// "Cerebro expuesto": muestra los pasos REALES emitidos por el worker.
// El motor corre en ~100 ms; la revelación se dosifica (~350 ms/línea)
// solo para que sea legible — los datos de cada línea son reales.
export default function TerminalIA() {
  const log = useAppStore((s) => s.pipelineLog);
  const [visibles, setVisibles] = useState(0);
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
    <div
      ref={cajaRef}
      className="max-h-40 overflow-y-auto border-b border-secondary/30 bg-black/50 p-3 font-mono text-xs leading-relaxed"
    >
      {log.slice(0, visibles).map((paso, i) => (
        <p key={i} className={i === log.length - 1 ? 'text-[#2ee6d6]' : 'text-secondary'}>
          <span className="text-[#2ee6d6]">&gt;</span> {paso}
        </p>
      ))}
      {visibles < log.length && <p className="animate-pulse text-[#2ee6d6]">▋</p>}
    </div>
  );
}
