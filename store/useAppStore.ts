import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AnalysisResult, SearchParams } from '@/lib/types';

// Estado global de la exploración. Los filtros, el punto seleccionado y el
// último análisis se persisten en sessionStorage (Doc 05): un F5 en /explore
// recupera el estado sin re-consultar APIs.

type Status = 'idle' | 'analyzing' | 'done' | 'error';

interface AppState {
  selectedPoint: [number, number] | null; // [lng, lat] del clic en el mapa
  searchParams: SearchParams;
  status: Status;
  analysis: AnalysisResult | null;
  pipelineLog: string[]; // pasos reales del worker ("cerebro expuesto"), efímero
  pushPipeline: (paso: string) => void;
  clearPipeline: () => void;
  setSelectedPoint: (p: [number, number] | null) => void;
  setSearchParams: (p: Partial<SearchParams>) => void;
  setStatus: (s: Status) => void;
  setAnalysis: (a: AnalysisResult | null) => void;
  reset: () => void;
}

const initialSearchParams: SearchParams = {
  rubro: null,
  montoSoles: null,
  plazoMeses: null,
  ventasMensuales: null,
  destino: null,
  experiencia: null,
  capitalSoles: null,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedPoint: null,
      searchParams: initialSearchParams,
      status: 'idle',
      analysis: null,
      pipelineLog: [],
      pushPipeline: (paso) => set((s) => ({ pipelineLog: [...s.pipelineLog, paso] })),
      clearPipeline: () => set({ pipelineLog: [] }),
      setSelectedPoint: (selectedPoint) =>
        set((s) =>
          selectedPoint?.[0] === s.selectedPoint?.[0] && selectedPoint?.[1] === s.selectedPoint?.[1]
            ? s
            : { selectedPoint, analysis: null, status: 'idle', pipelineLog: [] },
        ),
      setSearchParams: (p) =>
        set((s) => {
          const searchParams = { ...s.searchParams, ...p };
          const changed = (Object.keys(p) as Array<keyof SearchParams>).some(
            (key) => searchParams[key] !== s.searchParams[key],
          );
          return changed
            ? {
                searchParams,
                // Nunca mostrar un dictamen calculado con datos anteriores.
                analysis: null,
                status: 'idle',
                pipelineLog: [],
              }
            : s;
        }),
      setStatus: (status) => set({ status }),
      setAnalysis: (analysis) => set({ analysis }),
      reset: () =>
        set({
          selectedPoint: null,
          searchParams: initialSearchParams,
          status: 'idle',
          analysis: null,
          pipelineLog: [],
        }),
    }),
    {
      name: 'geospot-exploracion',
      version: 4, // nuevos campos de solicitud (plazo/ventas/destino); descarta estados previos
      migrate: () => ({ selectedPoint: null, searchParams: initialSearchParams, analysis: null }),
      storage: createJSONStorage(() => sessionStorage),
      // status es efímero: tras un F5 vuelve a 'idle'
      partialize: ({ selectedPoint, searchParams, analysis }) => ({
        selectedPoint,
        searchParams,
        analysis,
      }),
    },
  ),
);
