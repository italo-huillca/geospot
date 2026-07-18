'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import Map, {
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import type { Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Leyenda from '@/components/Leyenda';
import type { LocalProps, NegocioProps } from '@/lib/types';
import { useAnalysis } from '@/lib/useAnalysis';
import { useAppStore } from '@/store/useAppStore';
import { useGeoStore } from '@/store/useGeoStore';
import { toast } from '@/store/useToastStore';

type Preview =
  | { kind: 'negocio'; props: NegocioProps }
  | { kind: 'local'; props: LocalProps };

const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
const MAP_STYLE = `https://maps.geoapify.com/v1/styles/dark-matter/style.json?apiKey=${GEOAPIFY_KEY}`;

// Plaza de Armas de Arequipa
const AREQUIPA_CENTER: [number, number] = [-71.537, -16.3989];
const AREQUIPA = {
  longitude: AREQUIPA_CENTER[0],
  latitude: AREQUIPA_CENTER[1],
  zoom: 14,
};
// Perímetro del MVP (Doc 03): clics fuera disparan el Toast rojo
const LIMITES = { minLng: -71.65, maxLng: -71.42, minLat: -16.53, maxLat: -16.29 };

// Look & feel "gemelo digital": basemap oscuro con tinte teal
const TEAL = '#17e0c3';
const tintarMapa = (map: MLMap) => {
  for (const layer of map.getStyle().layers ?? []) {
    try {
      if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#1a2b33');
      else if (layer.type === 'fill' && layer.id.includes('water'))
        map.setPaintProperty(layer.id, 'fill-color', '#245660');
      else if (layer.type === 'fill' && layer.id.includes('building'))
        map.setPaintProperty(layer.id, 'fill-color', '#2b3f49');

      // Las etiquetas viales de Geoapify varían de nombre entre estilos.
      // Reforzamos cualquier capa de texto asociada a calles o transporte.
      const sourceLayer = 'source-layer' in layer ? String(layer['source-layer']) : '';
      const esEtiquetaVial =
        layer.type === 'symbol' &&
        Boolean(layer.layout?.['text-field']) &&
        /(road|street|highway|transportation|calle|avenue)/i.test(`${layer.id} ${sourceLayer}`);

      if (esEtiquetaVial) {
        map.setLayoutProperty(layer.id, 'visibility', 'visible');
        map.setLayerZoomRange(layer.id, Math.min(layer.minzoom ?? 13, 13), layer.maxzoom ?? 24);
        map.setPaintProperty(layer.id, 'text-color', '#e6f2ee');
        map.setPaintProperty(layer.id, 'text-opacity', 1);
        map.setPaintProperty(layer.id, 'text-halo-color', '#10231f');
        map.setPaintProperty(layer.id, 'text-halo-width', 1.5);
        map.setPaintProperty(layer.id, 'text-halo-blur', 0.5);
      }
    } catch {
      /* estilos de Geoapify pueden variar; el tinte es cosmético */
    }
  }
};

export default function MapView() {
  const { negocios, locales, manzanas, loaded, loading, error, loadDatasets } = useGeoStore();
  const selectedPoint = useAppStore((s) => s.selectedPoint);
  const setSelectedPoint = useAppStore((s) => s.setSelectedPoint);
  const analysis = useAppStore((s) => s.analysis);
  const searchParams = useAppStore((s) => s.searchParams);
  const [preview, setPreview] = useState<Preview | null>(null);
  // Gemelo digital 3D: feature opcional, apagada por defecto (no altera el flujo 2D)
  const [modo3D, setModo3D] = useState(false);
  const mapRef = useRef<MapRef>(null);
  const previewAnalysis = useAnalysis(AREQUIPA_CENTER);
  const visualAnalysis = analysis ?? previewAnalysis;

  const toggle3D = () => {
    const activar = !modo3D;
    setModo3D(activar);
    mapRef.current
      ?.getMap()
      .easeTo({ pitch: activar ? 55 : 0, bearing: activar ? -15 : 0, duration: 800 });
  };

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  const onClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (f) {
      // clic sobre un pin: tarjeta de previsualización, no análisis
      setPreview({
        kind: f.layer.id === 'locales-circles' ? 'local' : 'negocio',
        props: f.properties as never,
      });
      return;
    }
    setPreview(null);
    const { lng, lat } = e.lngLat;
    if (lng < LIMITES.minLng || lng > LIMITES.maxLng || lat < LIMITES.minLat || lat > LIMITES.maxLat) {
      toast('error', 'El análisis del MVP está limitado a Arequipa. Por favor, selecciona un punto válido.');
      return;
    }
    setSelectedPoint([lng, lat]);
  };

  return (
    <div className="relative h-dvh w-full">
      <Map
        ref={mapRef}
        initialViewState={AREQUIPA}
        mapStyle={MAP_STYLE}
        onClick={onClick}
        onLoad={(e) => tintarMapa(e.target)}
        cursor={selectedPoint ? 'grab' : 'crosshair'}
        interactiveLayerIds={['negocios-circles', 'locales-circles']}
        style={{ width: '100%', height: '100%' }}
      >
        {modo3D && manzanas && (
          <Source id="manzanas-3d" type="geojson" data={manzanas}>
            {/* Manzanas extruidas: altura = población, color = tráfico peatonal */}
            <Layer
              id="manzanas-extrusion"
              type="fill-extrusion"
              paint={{
                'fill-extrusion-height': ['*', ['get', 'poblacion_total'], 2.5],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.65,
                'fill-extrusion-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'trafico_peatonal'],
                  0,
                  '#16323a',
                  40,
                  '#1f6f6f',
                  100,
                  '#17e0c3',
                ],
              }}
            />
          </Source>
        )}
        {visualAnalysis?.isochrone && (
          <Source id="isochrone" type="geojson" data={visualAnalysis.isochrone}>
            {/* Área de influencia: 10 min a pie (o buffer de 600 m) */}
            <Layer
              id="isochrone-fill"
              type="fill"
              paint={{ 'fill-color': TEAL, 'fill-opacity': 0.06 }}
            />
            <Layer
              id="isochrone-line"
              type="line"
              paint={{ 'line-color': TEAL, 'line-width': 2, 'line-opacity': 0.9 }}
            />
          </Source>
        )}
        {visualAnalysis?.voronoi && (
          <Source id="voronoi" type="geojson" data={visualAnalysis.voronoi}>
            {/* Celdas de Voronoi: la geometría del motor, expuesta */}
            <Layer
              id="voronoi-lines"
              type="line"
              paint={{ 'line-color': TEAL, 'line-width': 1, 'line-opacity': 0.55 }}
            />
          </Source>
        )}
        {/* Al entrar se muestran solo las cafeterías; las anclas aparecen durante el análisis. */}
        {negocios && searchParams.rubro && (
          <Source id="negocios" type="geojson" data={negocios}>
            <Layer
              id="negocios-circles"
              type="circle"
              filter={
                analysis
                  ? [
                      'any',
                      ['==', ['get', 'subcategoria'], searchParams.rubro],
                      ['==', ['get', 'generador_trafico'], true],
                    ]
                  : ['==', ['get', 'subcategoria'], searchParams.rubro]
              }
              paint={{
                // Competencia: naranja con borde blanco (protagonista del Voronoi).
                // Generadores de tráfico: mismos tonos, atenuados y sin borde.
                'circle-radius': ['case', ['==', ['get', 'generador_trafico'], true], 3, 5],
                'circle-color': '#ffa726',
                'circle-opacity': ['case', ['==', ['get', 'generador_trafico'], true], 0.35, 0.95],
                'circle-stroke-width': ['case', ['==', ['get', 'generador_trafico'], true], 0, 1.5],
                'circle-stroke-color': '#ffffff',
              }}
            />
          </Source>
        )}
        {/* Avisos de alquiler: referencia discreta de costos de la zona, visible con evaluación activa */}
        {locales && analysis && (
          <Source id="locales" type="geojson" data={locales}>
            <Layer
              id="locales-circles"
              type="circle"
              paint={{
                'circle-radius': 4,
                'circle-color': '#e8a33d',
                'circle-opacity': 0.85,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#0a1310',
              }}
            />
          </Source>
        )}
        {selectedPoint ? (
          <Marker longitude={selectedPoint[0]} latitude={selectedPoint[1]} anchor="bottom">
            {/* Pin rojo clásico para el punto de análisis */}
            <svg width="30" height="40" viewBox="0 0 24 32" aria-hidden>
              <path
                d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z"
                fill="#ff4444"
                stroke="#7f1d1d"
                strokeWidth="1"
              />
              <circle cx="12" cy="12" r="4.5" fill="#ffffff" />
            </svg>
          </Marker>
        ) : (
          <Marker longitude={AREQUIPA_CENTER[0]} latitude={AREQUIPA_CENTER[1]} anchor="bottom">
            <div className="flex flex-col items-center">
              <span className="mb-1 whitespace-nowrap rounded-sm border border-primary/40 bg-background/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                Ejemplo · Cafetería
              </span>
              <svg width="30" height="40" viewBox="0 0 24 32" aria-hidden>
                <path
                  d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z"
                  fill={TEAL}
                  stroke="#075e54"
                  strokeWidth="1"
                />
                <circle cx="12" cy="12" r="4.5" fill="#0a1310" />
              </svg>
            </div>
          </Marker>
        )}
        {visualAnalysis?.optimalPoint && (
          <Marker longitude={visualAnalysis.optimalPoint[0]} latitude={visualAnalysis.optimalPoint[1]}>
            {/* Mayor vacío de competencia (Voronoi): mitigante territorial */}
            <div className="flex flex-col items-center" title="Zona de menor competencia">
              <div className="h-5 w-5 rounded-full border-2 border-background bg-success ring-4 ring-success/30" />
              <span className="mt-1 rounded-lg bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                Menor competencia
              </span>
            </div>
          </Marker>
        )}
      </Map>

      {preview && <PreviewCard preview={preview} onClose={() => setPreview(null)} />}

      <button
        onClick={toggle3D}
        className={`absolute bottom-4 right-4 z-10 hidden rounded-sm border px-3 py-2 text-sm font-semibold backdrop-blur-md transition-colors md:block ${
          modo3D
            ? 'border-primary bg-primary/15 text-primary'
            : 'border-secondary/30 bg-background/80 text-secondary hover:text-foreground'
        }`}
      >
        {modo3D ? 'Vista 2D' : 'Vista 3D'}
      </button>

      {(searchParams.rubro || analysis) && (
        <div className="panel absolute bottom-4 left-[26rem] z-10 hidden max-w-[calc(100%-34rem)] rounded-sm px-4 py-2 md:block">
          <Leyenda />
        </div>
      )}

      {/* Pantalla inicial de carga (Doc 03, animada con framer-motion) */}
      <AnimatePresence>
        {(loading || !loaded) && !error && (
          <motion.div
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-background"
          >
            <motion.div
              animate={{ scale: [1, 1.12, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            >
              <Image src="/logo_geospot.svg" alt="" width={72} height={77} priority />
            </motion.div>
            <p className="eyebrow">Renderizando ciudad y datasets...</p>
          </motion.div>
        )}
      </AnimatePresence>
      {error && (
        <div className="absolute inset-x-0 top-4 mx-auto w-fit rounded-sm bg-danger px-4 py-2 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

// Tarjeta flotante de previsualización (App Flow, Recorrido 3)
function PreviewCard({ preview, onClose }: { preview: Preview; onClose: () => void }) {
  return (
    <div className="panel absolute left-1/2 top-4 z-20 w-80 -translate-x-1/2 rounded-sm p-4 md:bottom-16 md:left-auto md:right-4 md:top-auto md:translate-x-0">
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-2 top-2 p-1 text-secondary hover:text-foreground"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M2 2l8 8M10 2l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {preview.kind === 'negocio' ? (
        <>
          <h3 className="pr-6 font-semibold">{preview.props.nombre}</h3>
          <p className="text-sm capitalize text-secondary">
            {preview.props.subcategoria.replace('_', ' ')} ·{' '}
            {preview.props.categoria_principal.replace('_', ' ')}
          </p>
          <span
            className={`mt-2 inline-block rounded-lg px-2 py-0.5 text-xs font-medium ${
              preview.props.generador_trafico
                ? 'bg-success/15 text-success'
                : 'bg-danger/15 text-danger'
            }`}
          >
            {preview.props.generador_trafico ? 'Generador de tráfico' : 'Competencia'}
          </span>
        </>
      ) : (
        <>
          <h3 className="pr-6 text-sm font-semibold">{preview.props.titulo}</h3>
          <p className="mt-1 text-lg font-bold text-accent">
            S/ {preview.props.precio_soles.toLocaleString('es-PE')}
            <span className="text-sm font-normal text-secondary"> /mes</span>
          </p>
          <p className="text-xs tabular-nums text-secondary">
            {preview.props.precio_m2 ? `S/ ${preview.props.precio_m2}/m²` : 'precio/m² no disponible'}
            {preview.props.area_m2 ? ` · ${preview.props.area_m2} m²` : ''}
          </p>
          {preview.props.telefono_contacto ? (
            <a
              href={`https://wa.me/51${preview.props.telefono_contacto}?text=${encodeURIComponent(
                `Hola, vi tu aviso "${preview.props.titulo}" y me interesa el local.`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block rounded-sm bg-accent px-3 py-2 text-center text-sm font-semibold text-background"
            >
              Contactar por WhatsApp
            </a>
          ) : (
            <a
              href={preview.props.url_origen}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block rounded-sm border border-accent px-3 py-2 text-center text-sm font-semibold text-accent"
            >
              Ver aviso original
            </a>
          )}
        </>
      )}
    </div>
  );
}
