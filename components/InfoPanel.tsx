'use client';

import { AnimatePresence, motion, useMotionValueEvent, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';
import Leyenda from '@/components/Leyenda';
import { evaluarIndicadores } from '@/lib/geo/evaluadores';
import { useMounted } from '@/lib/useMounted';
import { useAppStore } from '@/store/useAppStore';

// Informe de Riesgo Territorial (pivot B2B).
// IRG = 100 - Score de Viabilidad: a peor zona comercial, mayor riesgo del crédito.
export default function InfoPanel() {
  const analysis = useAppStore((s) => s.analysis);
  const [abierto, setAbierto] = useState(false);
  const mounted = useMounted();
  if (!mounted) return null;

  const irg = analysis?.score != null ? 100 - analysis.score : null;
  const pill = `IRG ${irg != null ? `${irg}%` : '—'}`;

  return (
    <>
      {/* Desktop */}
      {/* max-h deja libre la franja inferior derecha para el botón de Vista 3D */}
      <section className="panel absolute right-4 top-4 z-10 hidden max-h-[calc(100dvh-7rem)] w-80 flex-col gap-4 overflow-y-auto rounded-sm p-4 md:flex">
        <Contenido />
      </section>

      {/* Móvil: pestaña con el IRG */}
      <button
        onClick={() => setAbierto(true)}
        className="panel absolute bottom-16 right-3 z-20 rounded-sm px-3 py-2 text-sm font-semibold md:hidden"
      >
        <span className="tabular-nums text-warning">{pill}</span>
      </button>

      {/* Móvil: Bottom Sheet superpuesto */}
      <AnimatePresence>
        {abierto && (
          <motion.section
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="panel absolute inset-x-0 bottom-0 z-30 flex max-h-[75dvh] flex-col gap-4 overflow-y-auto rounded-t-sm p-4 md:hidden"
          >
            <button
              onClick={() => setAbierto(false)}
              aria-label="Minimizar panel"
              className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-secondary/50"
            />
            <Contenido />
            <Leyenda className="border-t border-secondary/30 pt-3" />
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

const VEREDICTO_CSS = {
  ok: 'bg-success',
  alerta: 'bg-warning',
  critico: 'bg-danger',
} as const;

function Contenido() {
  const analysis = useAppStore((s) => s.analysis);
  const status = useAppStore((s) => s.status);
  const searchParams = useAppStore((s) => s.searchParams);
  const stats = analysis?.stats ?? null;
  const irg = analysis?.score != null ? 100 - analysis.score : null;

  return (
    <>
      <h2 className="eyebrow text-primary">Informe de Riesgo Territorial</h2>

      <ScoreGauge irg={irg} analyzing={status === 'analyzing'} />

      {stats && irg != null ? (
        <>
          <div>
            <h3 className="eyebrow mb-1.5">Señales verificables</h3>
            <ul className="space-y-1.5 text-sm">
              {evaluarIndicadores(stats, searchParams).map((indicador) => (
                <li key={indicador.nombre} className="flex items-baseline gap-2">
                  <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 self-center rounded-full ${VEREDICTO_CSS[indicador.veredicto]}`}
                  />
                  <span>
                    <span className="font-medium">{indicador.nombre}:</span>{' '}
                    <span className="text-secondary">{indicador.resumen}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <Stat label="Población (10 min a pie)" value={stats.poblacion.toLocaleString('es-PE')} />
            <Stat label="NSE dominante" value={stats.nseDominante ?? '—'} />
            <Stat label="Tráfico peatonal" value={`${stats.traficoPromedio}/100`} />
            <Stat label="Competidores" value={String(stats.competidores)} />
            <Stat label="Anclas comerciales" value={String(stats.generadores)} />
            <Stat
              label="Alquiler ref. de la zona"
              value={stats.precioM2Promedio ? `S/ ${stats.precioM2Promedio}/m²` : 'sin referencia'}
            />
            {stats.distrito && (
              <Stat
                label="Distrito · flujo peatonal"
                value={`${stats.distrito.nombre} · ${stats.distrito.clase}`}
              />
            )}
          </dl>
          {analysis?.usedIsochroneFallback && (
            <p className="text-xs text-warning">Área aproximada (radio de 600 m)</p>
          )}
          {stats.usedDistritoFallback && (
            <p className="text-xs text-secondary">
              Sin censo por manzana aquí: tráfico estimado a nivel distrito.
            </p>
          )}
        </>
      ) : (
        // Estado Vacío
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <svg width="72" height="44" viewBox="0 0 72 44" aria-hidden className="opacity-30">
            <rect x="2" y="24" width="10" height="18" rx="1" fill="#7d938e" />
            <rect x="18" y="14" width="10" height="28" rx="1" fill="#7d938e" />
            <rect x="34" y="30" width="10" height="12" rx="1" fill="#7d938e" />
            <rect x="50" y="6" width="10" height="36" rx="1" fill="#7d938e" />
          </svg>
          <p className="text-sm text-secondary">
            Ingresa una solicitud o haz clic en el mapa para evaluar el riesgo territorial de la zona.
          </p>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function ScoreGauge({ irg, analyzing }: { irg: number | null; analyzing: boolean }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const spring = useSpring(0, { stiffness: 60, damping: 16 });
  const offset = useTransform(spring, (v) => c * (1 - v / 100));
  const [texto, setTexto] = useState('0%');
  useMotionValueEvent(spring, 'change', (v) => setTexto(`${Math.round(v)}%`));
  useEffect(() => {
    spring.set(irg ?? 0);
  }, [irg, spring]);

  // Semáforo de riesgo: verde = seguro, rojo = riesgoso
  const color = irg == null ? '#7d938e' : irg >= 65 ? '#ff4d4d' : irg >= 35 ? '#ff8800' : '#3ddc84';
  return (
    <div className="flex items-center gap-4">
      <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label="Índice de Riesgo Geo-comercial">
        <circle cx="52" cy="52" r={r} fill="none" stroke="#7d938e" strokeOpacity="0.25" strokeWidth="8" />
        <motion.circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ strokeDashoffset: offset }}
          transform="rotate(-90 52 52)"
        />
        <text x="52" y="58" textAnchor="middle" fill={color} fontSize="24" fontWeight="700">
          {irg == null ? '—' : texto}
        </text>
      </svg>
      <div>
        <p className="font-semibold">Índice de Riesgo Geo-comercial</p>
        <p className="text-xs text-secondary">
          {analyzing ? 'Evaluando zona...' : irg == null ? 'Esperando evaluación...' : 'Evaluación completada'}
        </p>
      </div>
    </div>
  );
}
