import {
  area as turfArea,
  bbox,
  booleanPointInPolygon,
  centroid,
  circle,
  featureCollection,
  intersect,
  point as turfPoint,
  pointOnFeature,
  voronoi,
} from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type {
  AnalysisResult,
  DistritosFC,
  LocalesFC,
  ManzanasFC,
  NegociosFC,
  SearchParams,
} from '../types';

export interface Datasets {
  manzanas: ManzanasFC;
  negocios: NegociosFC;
  locales: LocalesFC;
  distritos: DistritosFC;
}

type Area = Feature<Polygon | MultiPolygon>;

const NSE_PESO = { A: 1, B: 0.85, C: 0.6, D: 0.35 } as const;

// Pesos del Score de Viabilidad (no definidos en los docs; ajustables aquí).
// Suman 1: la competencia entra invertida (menos competencia = más puntos).
const W = {
  demanda: 0.3, // densidad poblacional del área
  trafico: 0.2, // tráfico peatonal promedio
  nse: 0.15, // poder adquisitivo (NSE ponderado por población)
  sinergia: 0.15, // generadores de tráfico (anclas)
  competencia: 0.2, // vacío de competencia
};
// Techos de normalización calibrados al centro de Arequipa
const MAX_DENSIDAD = 15000; // hab/km²
const MAX_GENERADORES = 30;
const MAX_COMPETIDORES_RUBRO = 15;
const MAX_COMPETIDORES_TOTAL = 300;

export function analyzeArea(
  point: [number, number],
  params: SearchParams,
  isochrone: Area | null,
  data: Datasets,
  opts: { onStep?: (paso: string) => void } = {}, // pipeline expuesto
): AnalysisResult {
  const paso = opts.onStep ?? (() => {});
  // Fallback de resiliencia (TRD): sin isócrona, buffer circular de 600 m
  const area: Area = isochrone ?? circle(point, 0.6, { units: 'kilometers', steps: 48 });
  paso(`Delimitando área de influencia... [${isochrone ? 'isócrona 10 min a pie' : 'buffer 600 m'}]`);

  const dentro = data.negocios.features.filter((f) =>
    booleanPointInPolygon(f.geometry.coordinates, area),
  );
  const generadores = dentro.filter((f) => f.properties.generador_trafico);
  const competidores = dentro.filter(
    (f) =>
      !f.properties.generador_trafico &&
      (params.rubro ? f.properties.subcategoria === params.rubro : true),
  );
  paso(
    `Triangulando ${data.negocios.features.length} negocios... [${competidores.length} competidores · ${generadores.length} anclas]`,
  );

  // ponytail: manzana "dentro" si su centroide cae en el área; intersección
  // real de polígonos si algún día hace falta precisión de borde.
  const manzanasIn = data.manzanas.features.filter((f) =>
    booleanPointInPolygon(centroid(f).geometry.coordinates, area),
  );
  const poblacion = manzanasIn.reduce((s, f) => s + f.properties.poblacion_total, 0);

  // Distrito más cercano al punto de análisis (contexto + fallback fuera del Cercado)
  const distrito =
    data.distritos.features.reduce(
      (mejor, f) => {
        const [dx, dy] = [f.geometry.coordinates[0] - point[0], f.geometry.coordinates[1] - point[1]];
        const d2 = dx * dx + dy * dy;
        return !mejor || d2 < mejor.d2 ? { d2, props: f.properties } : mejor;
      },
      null as { d2: number; props: DistritosFC['features'][number]['properties'] } | null,
    )?.props ?? null;

  // Sin manzanas censales (fuera del Cercado): el flujo peatonal del distrito
  // reemplaza al tráfico por manzana como señal gruesa.
  const usedDistritoFallback = manzanasIn.length === 0 && distrito != null;
  const traficoPromedio = manzanasIn.length
    ? Math.round(manzanasIn.reduce((s, f) => s + f.properties.trafico_peatonal, 0) / manzanasIn.length)
    : (distrito?.flujo_score ?? 0);

  const porNse: Record<string, number> = {};
  for (const f of manzanasIn)
    porNse[f.properties.nivel_socioeconomico] =
      (porNse[f.properties.nivel_socioeconomico] ?? 0) + f.properties.poblacion_total;
  const nseDominante = (Object.entries(porNse).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as
    | 'A'
    | 'B'
    | 'C'
    | 'D'
    | null;

  // Referencia de costos de la zona: todos los avisos de alquiler dentro del área
  paso(
    `Cruzando censo por manzana... [${manzanasIn.length} manzanas · ${poblacion.toLocaleString('es-PE')} hab.]`,
  );

  const localesIn = data.locales.features.filter((f) =>
    booleanPointInPolygon(f.geometry.coordinates, area),
  );
  paso(`Intersectando avisos de alquiler... [${localesIn.length} referencias de costo]`);
  const preciosM2 = localesIn
    .map((f) => f.properties.precio_m2)
    .filter((p): p is number => p != null);
  const precioM2Promedio = preciosM2.length
    ? Math.round((preciosM2.reduce((a, b) => a + b, 0) / preciosM2.length) * 100) / 100
    : null;

  // --- Score de Viabilidad (0-100) ---
  const areaKm2 = turfArea(area) / 1e6;
  const demanda = Math.min(1, poblacion / areaKm2 / MAX_DENSIDAD);
  const nse = poblacion
    ? manzanasIn.reduce(
        (s, f) => s + NSE_PESO[f.properties.nivel_socioeconomico] * f.properties.poblacion_total,
        0,
      ) / poblacion
    : 0;
  const sinergia = Math.min(1, generadores.length / MAX_GENERADORES);
  const maxComp = params.rubro ? MAX_COMPETIDORES_RUBRO : MAX_COMPETIDORES_TOTAL;
  const vacio = 1 - Math.min(1, competidores.length / maxComp);
  const score = Math.round(
    100 *
      (W.demanda * demanda +
        W.trafico * (traficoPromedio / 100) +
        W.nse * nse +
        W.sinergia * sinergia +
        W.competencia * vacio),
  );

  // --- Punto Óptimo: celda de Voronoi más grande dentro del área ---
  // Las celdas recortadas también se devuelven como capa visual (look "gemelo digital").
  let optimalPoint: [number, number] = point;
  const celdas: Feature<Polygon | MultiPolygon>[] = [];
  if (competidores.length >= 3)
    paso(`Calculando diagrama de Voronoi... [${competidores.length} semillas]`);
  if (competidores.length >= 3) {
    const cells = voronoi(
      featureCollection(competidores.map((f) => turfPoint(f.geometry.coordinates))),
      { bbox: bbox(area) },
    );
    let mejorArea = 0;
    for (const cell of cells.features) {
      if (!cell) continue;
      const clip = intersect(featureCollection([cell, area] as Feature<Polygon>[]));
      if (!clip) continue;
      celdas.push(clip);
      const a = turfArea(clip);
      if (a > mejorArea) {
        mejorArea = a;
        optimalPoint = pointOnFeature(clip).geometry.coordinates as [number, number];
      }
    }
  }
  // ponytail: con <3 competidores el vacío es todo el área; el punto elegido es el origen.

  const zonas = { comercial: 0, mixto: 0, residencial: 0 };
  for (const f of manzanasIn) {
    if (f.properties.zonificacion === 'Comercial') zonas.comercial++;
    else if (f.properties.zonificacion === 'Mixto') zonas.mixto++;
    else zonas.residencial++;
  }
  const paraderos = dentro.filter((f) => f.properties.subcategoria === 'bus_station').length;

  paso(`IRG calculado: ${100 - score}%`);

  return {
    isochrone: area,
    usedIsochroneFallback: !isochrone,
    optimalPoint,
    voronoi: celdas.length ? featureCollection(celdas) : null,
    score,
    stats: {
      poblacion,
      nseDominante,
      traficoPromedio,
      competidores: competidores.length,
      generadores: generadores.length,
      precioM2Promedio,
      localesMatchIds: localesIn.map((f) => f.properties.id),
      distrito,
      usedDistritoFallback,
      zonas,
      paraderos,
    },
  };
}
