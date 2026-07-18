'use client';

import { useEffect, useRef } from 'react';
import { evaluarAgentes } from '@/lib/geo/agentes';
import { useAppStore } from '@/store/useAppStore';
import { useGeoStore } from '@/store/useGeoStore';
import { toast } from '@/store/useToastStore';

const PLAZA: [number, number] = [-71.537, -16.3989]; // origen por defecto si el chat llega antes que un clic

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
        // el orquestador reporta el veredicto de cada agente en la consola
        if (e.data.result.stats) {
          const agentes = evaluarAgentes(e.data.result.stats, store.searchParams);
          store.pushPipeline(`Orquestando ${agentes.length} agentes de evaluación...`);
          for (const a of agentes)
            store.pushPipeline(`Agente ${a.nombre} → ${a.veredicto.toUpperCase()} · ${a.resumen}`);
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
    if (!loaded) return;
    // Un clic solo no basta (Doc 03): recién se analiza con rubro + monto declarados
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
    const point = selectedPoint ?? PLAZA;
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
