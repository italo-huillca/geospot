'use client';

import Image from 'next/image';
import { useState } from 'react';
import ChatPanel from '@/components/ChatPanel';
import TerminalIA from '@/components/TerminalIA';
import { RUBROS } from '@/lib/parseIntent';
import { useMounted } from '@/lib/useMounted';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/store/useToastStore';

export default function SidePanel() {
  const searchParams = useAppStore((s) => s.searchParams);
  const setSearchParams = useAppStore((s) => s.setSearchParams);
  const selectedPoint = useAppStore((s) => s.selectedPoint);
  // Bottom Sheet móvil: tocar la cabecera lo colapsa/expande (en desktop no aplica)
  const [expandido, setExpandido] = useState(true);
  // borrador local: el análisis se dispara recién al pulsar "Evaluar"
  const [rubro, setRubro] = useState('');
  const [monto, setMonto] = useState('');
  const [experiencia, setExperiencia] = useState('');
  const [capital, setCapital] = useState('');
  const [plazo, setPlazo] = useState('');
  const [ventas, setVentas] = useState('');
  const [destino, setDestino] = useState('');
  const mounted = useMounted();

  const evaluar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoint) {
      toast('warning', 'Marca la ubicación del negocio con un clic en el mapa.');
      return;
    }
    if (!rubro || !monto) {
      toast('warning', 'Completa al menos el rubro y el monto para evaluar.');
      return;
    }
    setSearchParams({
      rubro: rubro || null,
      montoSoles: monto ? Number(monto) : null,
      plazoMeses: plazo ? Number(plazo) : null,
      ventasMensuales: ventas ? Number(ventas) : null,
      destino: (destino || null) as 'apertura' | 'capital_trabajo' | 'activo_fijo' | null,
      experiencia: (experiencia || null) as 'nueva' | 'media' | 'alta' | null,
      capitalSoles: capital ? Number(capital) : null,
    });
  };

  return (
    <aside
      className={`panel absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-sm transition-[max-height] duration-300 md:inset-x-auto md:bottom-4 md:left-4 md:top-4 md:!max-h-none md:w-96 md:rounded-sm ${
        expandido ? 'max-h-[55dvh]' : 'max-h-12'
      }`}
    >
      <header
        className="flex cursor-pointer items-center gap-2 border-b border-secondary/30 p-3 md:cursor-default"
        onClick={() => setExpandido((e) => !e)}
      >
        <Image src="/logo_geospot.svg" alt="" width={22} height={24} priority />
        <h2 className="text-lg font-semibold">GeoSpot Risk</h2>
        <span className="eyebrow ml-auto">Riesgo territorial B2B</span>
        <svg
          aria-hidden
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={`text-secondary transition-transform md:hidden ${expandido ? '' : 'rotate-180'}`}
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </header>

      {mounted && (
        <form onSubmit={evaluar} className="space-y-2 border-b border-secondary/30 p-4 text-sm">
          <h3 className="eyebrow">Nueva evaluación de solicitud</h3>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Rubro del negocio">
              <select
                aria-label="Rubro del negocio"
                value={rubro}
                onChange={(e) => setRubro(e.target.value)}
                className="w-full rounded-sm border border-secondary/30 bg-black/30 px-2 py-2 focus:border-primary focus:outline-none"
              >
                <option value="">Seleccionar…</option>
                {Object.keys(RUBROS).map((r) => (
                  <option key={r} value={r}>
                    {r.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Monto solicitado (S/)">
              <input
                type="number"
                aria-label="Monto solicitado en soles"
                min={0}
                placeholder="Monto (S/)"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="w-full rounded-sm border border-secondary/30 bg-black/30 px-2 py-2 focus:border-primary focus:outline-none placeholder:text-secondary"
              />
            </Campo>
            <Campo label="Experiencia en el rubro">
              <select
                aria-label="Experiencia en el rubro"
                value={experiencia}
                onChange={(e) => setExperiencia(e.target.value)}
                className="w-full rounded-sm border border-secondary/30 bg-black/30 px-2 py-2 focus:border-primary focus:outline-none"
              >
                <option value="">Seleccionar…</option>
                <option value="nueva">Nueva (sin experiencia)</option>
                <option value="media">Media (1-3 años)</option>
                <option value="alta">Alta (3+ años)</option>
              </select>
            </Campo>
            <Campo label="Capital propio (S/)">
              <input
                type="number"
                aria-label="Capital propio en soles"
                min={0}
                placeholder="Capital propio (S/)"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                className="w-full rounded-sm border border-secondary/30 bg-black/30 px-2 py-2 focus:border-primary focus:outline-none placeholder:text-secondary"
              />
            </Campo>
            <Campo label="Plazo (meses)">
              <input
                type="number"
                aria-label="Plazo en meses"
                min={1}
                placeholder="Plazo (meses)"
                value={plazo}
                onChange={(e) => setPlazo(e.target.value)}
                className="w-full rounded-sm border border-secondary/30 bg-black/30 px-2 py-2 focus:border-primary focus:outline-none placeholder:text-secondary"
              />
            </Campo>
            <Campo label="Ventas mensuales (S/)">
              <input
                type="number"
                aria-label="Ventas mensuales en soles"
                min={0}
                placeholder="Ventas mensuales (S/)"
                value={ventas}
                onChange={(e) => setVentas(e.target.value)}
                className="w-full rounded-sm border border-secondary/30 bg-black/30 px-2 py-2 focus:border-primary focus:outline-none placeholder:text-secondary"
              />
            </Campo>
            <Campo label="Destino del crédito" className="col-span-2">
              <select
                aria-label="Destino del crédito"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                className="w-full rounded-sm border border-secondary/30 bg-black/30 px-2 py-2 focus:border-primary focus:outline-none"
              >
                <option value="">Seleccionar…</option>
                <option value="capital_trabajo">Capital de trabajo</option>
                <option value="activo_fijo">Activo fijo</option>
                <option value="apertura">Apertura de negocio</option>
              </select>
            </Campo>
          </div>
          <p className={`text-xs ${selectedPoint ? 'text-success' : 'text-secondary'}`}>
            {selectedPoint
              ? 'Ubicación del negocio marcada en el mapa.'
              : 'Haz clic en el mapa para marcar la ubicación del negocio.'}
          </p>
          <button type="submit" className="btn-primary w-full py-2">
            Evaluar riesgo territorial
          </button>
        </form>
      )}

      <TerminalIA />

      <details className="flex min-h-0 flex-col border-b border-secondary/30 open:flex-1">
        <summary className="cursor-pointer p-3 text-sm font-medium text-secondary">
          Copiloto IA (describir la solicitud en texto)
        </summary>
        <ChatPanel />
      </details>

      {searchParams.rubro || searchParams.montoSoles ? (
        <p className="p-3 text-xs text-secondary">
          Evaluando: {searchParams.rubro ?? 'sin rubro'}
          {searchParams.montoSoles ? ` · S/ ${searchParams.montoSoles.toLocaleString('es-PE')}` : ''}
        </p>
      ) : null}
    </aside>
  );
}

function Campo({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-xs text-secondary ${className}`}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
