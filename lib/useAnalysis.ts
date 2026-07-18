'use client';

import { useEffect, useRef } from 'react';
import { evaluarIndicadores } from '@/lib/geo/evaluadores';
import { useAppStore } from '@/store/useAppStore';
import { useGeoStore } from '@/store/useGeoStore';
import { toast } from '@/store/useToastStore';

// Orquesta el análisis: isócrona vía proxy (con fallback en el worker) + Turf en Web Worker.
export function useAnalysis() {
  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef(0);
  const lastKeyRef = useRef<string | null>(null);
  const { manzanas, negocios, locales, distritos, loaded } = useGeoStore();
  const selectedPoint = useAppStore((s) => s.selectedPoint);
  const searchParams = useAppStore((s) => s.searchParams);

  useEffect(() => {
    const w = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url));
    workerRef.current = w;
    w.onmessage = (e) => {
      const store = useAppStore.getState();
      if (e.data.type === 'step' && e.data.id === runIdRef.current) {
        store.pushPipeline(e.data.paso);
      }
      if (e.data.type === 'result' && e.data.id === runIdRef.current) {
        // El motor reporta cada regla; el asesor IA las consultará como herramientas.
        if (e.data.result.stats) {
          const indicadores = evaluarIndicadores(e.data.result.stats, store.searchParams);
          store.pushPipeline(`Ejecutando ${indicadores.length} evaluadores auditables...`);
          for (const indicador of indicadores)
            store.pushPipeline(
              `${indicador.nombre} → ${indicador.veredicto.toUpperCase()} · ${indicador.resumen}`,
            );
        }
        store.setAnalysis(e.data.result);
        store.setStatus('done');
      }
    };
    return () => w.terminate();
  }, []);

  useEffect(() => {
    if (loaded) workerRef.current?.postMessage({ type: 'init', manzanas, negocios, locales, distritos });
  }, [loaded, manzanas, negocios, locales, distritos]);

  useEffect(() => {
    if (!loaded || !selectedPoint) return;
    // La ubicación, el rubro y el monto son necesarios antes de ejecutar el motor.
    const hayIntencion = Boolean(searchParams.rubro && searchParams.montoSoles);
    if (!hayIntencion) return;

    const key = JSON.stringify([selectedPoint, searchParams]);
    if (key === lastKeyRef.current) return;
    if (lastKeyRef.current === null && useAppStore.getState().analysis) {
      // F5: el análisis se rehidrató de sessionStorage (Doc 05), no re-consultar APIs
      lastKeyRef.current = key;
      return;
    }
    lastKeyRef.current = key;

    const id = ++runIdRef.current;
    const point = selectedPoint;
    const store = useAppStore.getState();
    store.setStatus('analyzing');
    store.clearPipeline();
    store.pushPipeline('Solicitando isócrona peatonal a Geoapify...');
    (async () => {
      let isochrone = null;
      try {
        const res = await fetch(`/api/isochrone?lng=${point[0]}&lat=${point[1]}&minutes=10`, {
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) isochrone = (await res.json()).features?.[0] ?? null;
      } catch {
        /* sin isócrona: el worker aplica el buffer de 600 m */
      }
      if (id !== runIdRef.current) return; // el usuario ya pidió otro análisis
      if (!isochrone) toast('warning', 'Calculando área aproximada.'); // Doc 03: fallo de isócronas
      workerRef.current?.postMessage({ type: 'analyze', id, point, params: searchParams, isochrone });
    })();
  }, [loaded, selectedPoint, searchParams]);
}
