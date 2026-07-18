import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson';

// Esquemas del Documento 05 (properties de cada Feature)

export interface ManzanaProps {
  id: string;
  poblacion_total: number;
  nivel_socioeconomico: 'A' | 'B' | 'C' | 'D';
  trafico_peatonal: number; // 0-100
  zonificacion: 'Comercial' | 'Mixto' | 'Residencial';
}

export interface NegocioProps {
  id: string;
  nombre: string;
  categoria_principal: string;
  subcategoria: string;
  generador_trafico: boolean;
}

export interface LocalProps {
  id: string;
  titulo: string;
  precio_soles: number;
  area_m2: number | null;
  precio_m2: number | null;
  url_origen: string;
  telefono_contacto: string | null;
  imagen_url: string | null;
}

export interface DistritoProps {
  nombre: string;
  clase: 'Alto' | 'Moderado' | 'Bajo' | 'Muy Bajo';
  flujo_score: number; // 0-100, normalizado del composite_score OSM
}

export type ManzanasFC = FeatureCollection<Polygon | MultiPolygon, ManzanaProps>;
export type NegociosFC = FeatureCollection<Point, NegocioProps>;
export type LocalesFC = FeatureCollection<Point, LocalProps>;
export type DistritosFC = FeatureCollection<Point, DistritoProps>;

// Estado de la evaluación de riesgo (B2B)

export interface SearchParams {
  rubro: string | null;
  montoSoles: number | null; // monto del crédito solicitado
  plazoMeses: number | null; // plazo del crédito
  ventasMensuales: number | null; // ventas mensuales declaradas del negocio
  destino: 'apertura' | 'capital_trabajo' | 'activo_fijo' | null; // destino del crédito
  experiencia: 'nueva' | 'media' | 'alta' | null; // experiencia del solicitante en el rubro
  capitalSoles: number | null; // capital propio declarado
}

// Veredicto de un agente del sistema de evaluación
export interface AgenteResultado {
  nombre: string;
  veredicto: 'ok' | 'alerta' | 'critico';
  resumen: string;
}

// Métricas del Panel de Información Profesional
export interface AreaStats {
  poblacion: number;
  nseDominante: 'A' | 'B' | 'C' | 'D' | null;
  traficoPromedio: number; // 0-100
  competidores: number;
  generadores: number;
  precioM2Promedio: number | null; // estimación de precios de la zona
  localesMatchIds: string[]; // locales en alquiler dentro del área (y bajo el precio máx.)
  distrito: DistritoProps | null; // distrito más cercano y su flujo peatonal
  usedDistritoFallback: boolean; // true si el tráfico salió del distrito (sin manzanas censales)
  zonas: { comercial: number; mixto: number; residencial: number }; // manzanas por zonificación
  paraderos: number; // paraderos/terminales de bus en el área
}

export interface AnalysisResult {
  isochrone: Feature<Polygon | MultiPolygon> | null;
  usedIsochroneFallback: boolean; // true si se usó el buffer de 600m
  optimalPoint: [number, number] | null; // [lng, lat] del Punto Óptimo (Voronoi)
  voronoi: FeatureCollection<Polygon | MultiPolygon> | null; // celdas recortadas al área (capa visual)
  score: number | null; // Score de Viabilidad 0-100
  stats: AreaStats | null;
}
