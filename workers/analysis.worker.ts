/// <reference lib="webworker" />
import { analyzeArea, type Datasets } from '@/lib/geo/analysis';

// Aísla Turf (Voronoi, intersecciones) del hilo principal: la UI nunca se bloquea.
let data: Datasets | null = null;

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'init') {
    data = { manzanas: msg.manzanas, negocios: msg.negocios, locales: msg.locales, distritos: msg.distritos };
    return;
  }
  if (msg.type === 'analyze' && data) {
    // Cerebro expuesto: cada paso real del pipeline se emite a la UI
    const result = analyzeArea(msg.point, msg.params, msg.isochrone, data, {
      onStep: (paso) => self.postMessage({ type: 'step', id: msg.id, paso }),
    });
    self.postMessage({ type: 'result', id: msg.id, result });
    return;
  }
  if (msg.type === 'preview' && data) {
    // Vista previa territorial: no altera la solicitud ni activa al asesor IA.
    const result = analyzeArea(msg.point, msg.params, null, data);
    self.postMessage({ type: 'preview-result', id: msg.id, result });
  }
};
