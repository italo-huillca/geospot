import { create } from 'zustand';
import type { DistritosFC, LocalesFC, ManzanasFC, NegociosFC } from '@/lib/types';

// Datasets estáticos en memoria (Doc 05: se cargan al montar /explore).
// No se persisten: son grandes y siempre están disponibles en /public/data.

interface GeoState {
  manzanas: ManzanasFC | null;
  negocios: NegociosFC | null;
  locales: LocalesFC | null;
  distritos: DistritosFC | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  loadDatasets: () => Promise<void>;
}

export const useGeoStore = create<GeoState>((set, get) => ({
  manzanas: null,
  negocios: null,
  locales: null,
  distritos: null,
  loading: false,
  loaded: false,
  error: null,

  loadDatasets: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true, error: null });
    try {
      const [manzanas, negocios, locales, distritos] = await Promise.all(
        ['manzanas_centro', 'todos_los_negocios', 'locales_reales', 'distritos'].map(async (name) => {
          const res = await fetch(`/data/${name}.geojson`);
          if (!res.ok) throw new Error(`No se pudo cargar ${name} (${res.status})`);
          return res.json();
        }),
      );
      set({ manzanas, negocios, locales, distritos, loaded: true, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Error cargando datasets' });
    }
  },
}));
