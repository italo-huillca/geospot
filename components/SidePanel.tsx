'use client';

import { driver, type Driver } from 'driver.js';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import ChatPanel from '@/components/ChatPanel';
import TerminalIA from '@/components/TerminalIA';
import { RUBROS } from '@/lib/parseIntent';
import { useMounted } from '@/lib/useMounted';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/store/useToastStore';

const GUIA_FORMULARIO_KEY = 'geospot:guia-formulario-v1';

export default function SidePanel() {
  const searchParams = useAppStore((s) => s.searchParams);
  const setSearchParams = useAppStore((s) => s.setSearchParams);
  const selectedPoint = useAppStore((s) => s.selectedPoint);
  // Bottom Sheet móvil: tocar la cabecera lo colapsa/expande (en desktop no aplica)
  const [expandido, setExpandido] = useState(true);
  const [vista, setVista] = useState<'solicitud' | 'asesor'>('solicitud');
  const mounted = useMounted();
  const guiaRef = useRef<Driver | null>(null);

  const iniciarGuia = useCallback(() => {
    setExpandido(true);
    setVista('solicitud');

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        guiaRef.current?.destroy();

        const guia = driver({
          animate: true,
          allowClose: true,
          smoothScroll: true,
          showProgress: true,
          overlayColor: '#020807',
          overlayOpacity: 0.76,
          stagePadding: 6,
          stageRadius: 3,
          popoverClass: 'geospot-tour',
          progressText: '{{current}} de {{total}}',
          nextBtnText: 'Siguiente',
          prevBtnText: 'Atrás',
          doneBtnText: 'Entendido',
          onDestroyed: () => {
            if (guiaRef.current === guia) guiaRef.current = null;
            try {
              window.localStorage.setItem(GUIA_FORMULARIO_KEY, '1');
            } catch {
              // La guía sigue funcionando si el navegador bloquea localStorage.
            }
          },
          steps: [
            {
              popover: {
                title: 'Evalúa una solicitud',
                description:
                  'Completa el perfil del negocio y marca su ubicación para calcular el riesgo territorial.',
              },
            },
            {
              element: '[data-tour="datos-clave"]',
              popover: {
                title: 'Datos esenciales',
                description:
                  'Selecciona el rubro e ingresa el monto solicitado. Ambos datos son necesarios para evaluar.',
                side: 'right',
                align: 'start',
              },
            },
            {
              element: '[data-tour="perfil-financiero"]',
              popover: {
                title: 'Perfil financiero',
                description:
                  'La experiencia, el capital, el plazo y las ventas afinan el análisis de capacidad.',
                side: 'right',
                align: 'start',
              },
            },
            {
              element: '[data-tour="destino-credito"]',
              popover: {
                title: 'Destino del crédito',
                description:
                  'Indica para qué se usará el financiamiento; este dato ayuda a interpretar el nivel de riesgo.',
                side: 'right',
                align: 'start',
              },
            },
            {
              element: '[data-tour="ubicacion-negocio"]',
              popover: {
                title: 'Ubica el negocio',
                description:
                  'Haz clic en el mapa para marcar el punto exacto antes de ejecutar la evaluación.',
                side: 'right',
                align: 'center',
              },
            },
            {
              element: '[data-tour="evaluar-riesgo"]',
              popover: {
                title: 'Ejecuta el análisis',
                description:
                  'GeoSpot combinará la solicitud con los datos territoriales de la zona seleccionada.',
                side: 'right',
                align: 'end',
              },
            },
          ],
        });

        guiaRef.current = guia;
        guia.drive();
      });
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;

    try {
      if (window.localStorage.getItem(GUIA_FORMULARIO_KEY)) return;
    } catch {
      return;
    }

    const timeout = window.setTimeout(iniciarGuia, 700);
    return () => window.clearTimeout(timeout);
  }, [iniciarGuia, mounted]);

  useEffect(
    () => () => {
      guiaRef.current?.destroy();
    },
    [],
  );

  const evaluar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const rubro = String(form.get('rubro') ?? '');
    const monto = String(form.get('monto') ?? '');
    const experiencia = String(form.get('experiencia') ?? '');
    const capital = String(form.get('capital') ?? '');
    const plazo = String(form.get('plazo') ?? '');
    const ventas = String(form.get('ventas') ?? '');
    const destino = String(form.get('destino') ?? '');
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
    setVista('asesor');
  };

  return (
    <aside
      className={`panel absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-sm transition-[max-height] duration-300 md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-2rem)] md:min-h-80 md:w-96 md:min-w-80 md:max-w-[calc(100vw-2rem)] md:resize md:rounded-sm ${
        expandido ? 'max-h-[82dvh]' : 'max-h-12'
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

      <nav
        role="tablist"
        aria-label="Flujo de evaluación"
        className="grid grid-cols-2 border-b border-secondary/30 p-1.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'solicitud'}
          onClick={() => setVista('solicitud')}
          className={`px-3 py-2 text-xs font-semibold transition-colors ${
            vista === 'solicitud' ? 'bg-primary/10 text-primary' : 'text-secondary hover:text-foreground'
          }`}
        >
          01 · Solicitud
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'asesor'}
          onClick={() => setVista('asesor')}
          className={`px-3 py-2 text-xs font-semibold transition-colors ${
            vista === 'asesor' ? 'bg-primary/10 text-primary' : 'text-secondary hover:text-foreground'
          }`}
        >
          02 · Asesor IA
        </button>
      </nav>

      {mounted && (
        <form
          key={JSON.stringify(searchParams)}
          onSubmit={evaluar}
          role="tabpanel"
          aria-hidden={vista !== 'solicitud'}
          className={`min-h-0 flex-1 space-y-2 overflow-y-auto p-4 text-sm ${
            vista === 'solicitud' ? 'block' : 'hidden'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="eyebrow">Nueva evaluación de solicitud</h3>
            <button
              type="button"
              onClick={iniciarGuia}
              className="flex items-center gap-1 text-[11px] font-semibold text-secondary transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label="Ver guía del formulario"
            >
              <span
                aria-hidden
                className="grid h-4 w-4 place-items-center rounded-full border border-current font-mono text-[10px]"
              >
                ?
              </span>
              Guía
            </button>
          </div>
          <div data-tour="datos-clave" className="grid grid-cols-2 gap-2">
            <Campo label="Rubro del negocio">
              <select
                aria-label="Rubro del negocio"
                name="rubro"
                defaultValue={searchParams.rubro ?? ''}
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
                name="monto"
                min={0}
                placeholder="Monto (S/)"
                defaultValue={searchParams.montoSoles ?? ''}
                className="w-full rounded-sm border border-secondary/30 bg-black/30 px-2 py-2 focus:border-primary focus:outline-none placeholder:text-secondary"
              />
            </Campo>
          </div>
          <div data-tour="perfil-financiero" className="grid grid-cols-2 gap-2">
            <Campo label="Experiencia en el rubro">
              <select
                aria-label="Experiencia en el rubro"
                name="experiencia"
                defaultValue={searchParams.experiencia ?? ''}
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
                name="capital"
                min={0}
                placeholder="Capital propio (S/)"
                defaultValue={searchParams.capitalSoles ?? ''}
                className="w-full rounded-sm border border-secondary/30 bg-black/30 px-2 py-2 focus:border-primary focus:outline-none placeholder:text-secondary"
              />
            </Campo>
            <Campo label="Plazo (meses)">
              <input
                type="number"
                aria-label="Plazo en meses"
                name="plazo"
                min={1}
                placeholder="Plazo (meses)"
                defaultValue={searchParams.plazoMeses ?? ''}
                className="w-full rounded-sm border border-secondary/30 bg-black/30 px-2 py-2 focus:border-primary focus:outline-none placeholder:text-secondary"
              />
            </Campo>
            <Campo label="Ventas mensuales (S/)">
              <input
                type="number"
                aria-label="Ventas mensuales en soles"
                name="ventas"
                min={0}
                placeholder="Ventas mensuales (S/)"
                defaultValue={searchParams.ventasMensuales ?? ''}
                className="w-full rounded-sm border border-secondary/30 bg-black/30 px-2 py-2 focus:border-primary focus:outline-none placeholder:text-secondary"
              />
            </Campo>
          </div>
          <Campo label="Destino del crédito" dataTour="destino-credito">
            <select
              aria-label="Destino del crédito"
              name="destino"
              defaultValue={searchParams.destino ?? ''}
              className="w-full rounded-sm border border-secondary/30 bg-black/30 px-2 py-2 focus:border-primary focus:outline-none"
            >
              <option value="">Seleccionar…</option>
              <option value="capital_trabajo">Capital de trabajo</option>
              <option value="activo_fijo">Activo fijo</option>
              <option value="apertura">Apertura de negocio</option>
            </select>
          </Campo>
          <p
            data-tour="ubicacion-negocio"
            className={`text-xs ${selectedPoint ? 'text-success' : 'text-secondary'}`}
          >
            {selectedPoint
              ? 'Ubicación del negocio marcada en el mapa.'
              : 'Marca en el mapa la ubicación del negocio.'}
          </p>
          <button
            type="submit"
            data-tour="evaluar-riesgo"
            className="btn-primary w-full py-2"
          >
            Evaluar riesgo territorial
          </button>
        </form>
      )}

      <div
        role="tabpanel"
        aria-hidden={vista !== 'asesor'}
        className={`min-h-0 flex-1 flex-col ${vista === 'asesor' ? 'flex' : 'hidden'}`}
      >
        <TerminalIA />
        <ChatPanel />
      </div>

      {searchParams.rubro || searchParams.montoSoles ? (
        <p className="border-t border-secondary/20 px-3 py-2 text-xs text-secondary">
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
  dataTour,
  children,
}: {
  label: string;
  className?: string;
  dataTour?: string;
  children: React.ReactNode;
}) {
  return (
    <label data-tour={dataTour} className={`block text-xs text-secondary ${className}`}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
