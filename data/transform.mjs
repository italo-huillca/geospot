// Transforma los datos crudos de /data/raw a los esquemas del Documento 05.
// Uso: node data/transform.mjs  → escribe los 3 GeoJSON en /public/data/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = (f) => JSON.parse(readFileSync(join(ROOT, 'data/raw', f), 'utf8'));
const OUT = join(ROOT, 'public/data');
mkdirSync(OUT, { recursive: true });

// ---------- 1. todos_los_negocios.geojson ----------
const NO_NEGOCIO = new Set([
  'bench', 'toilets', 'parking', 'parking_entrance', 'parking_space',
  'motorcycle_parking', 'fountain', 'telephone', 'drinking_water',
  'waste_disposal', 'recycling', 'water_point', 'lavoir', 'compressed_air',
  'vending_machine', 'payment_terminal', 'taxi',
]);

const CATEGORIAS = {
  gastronomia: ['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'ice_cream', 'food_court', 'bakery', 'beverages', 'butcher', 'greengrocer', 'alcohol', 'confectionery', 'seafood', 'deli'],
  salud: ['pharmacy', 'clinic', 'dentist', 'doctors', 'hospital', 'veterinary', 'optician', 'chemist', 'medical_supply'],
  educacion: ['kindergarten', 'school', 'college', 'university', 'driving_school', 'language_school', 'music_school', 'library', 'dojo'],
  finanzas: ['bank', 'atm', 'bureau_de_change', 'money_lender', 'money_transfer', 'financial', 'insurance', 'payment_centre'],
  ocio: ['cinema', 'theatre', 'casino', 'nightclub', 'arts_centre', 'internet_cafe'],
};
const TAG_A_CATEGORIA = new Map();
for (const [cat, tags] of Object.entries(CATEGORIAS))
  for (const t of tags) TAG_A_CATEGORIA.set(t, cat);

// Traducción de subcategorías frecuentes (para el matching del chat en español)
const SUBCATEGORIA_ES = {
  cafe: 'cafeteria', pharmacy: 'farmacia', clothes: 'boutique', restaurant: 'restaurante',
  fast_food: 'comida_rapida', bakery: 'panaderia', supermarket: 'supermercado',
  bank: 'banco', school: 'colegio', kindergarten: 'nido', university: 'universidad',
  hairdresser: 'peluqueria', shoes: 'zapateria', bookshop: 'libreria', books: 'libreria',
  convenience: 'bodega', hardware: 'ferreteria', dentist: 'dentista', bar: 'bar',
  optician: 'optica', laundry: 'lavanderia', butcher: 'carniceria', mall: 'centro_comercial',
};

const GENERADORES = new Set([
  'supermarket', 'mall', 'department_store', 'marketplace', 'bank', 'university',
  'college', 'school', 'hospital', 'bus_station', 'place_of_worship', 'cinema', 'fuel',
]);

const osm = raw('todos_negocios.geojson');
const negocios = {
  type: 'FeatureCollection',
  features: osm.features
    .filter((f) => {
      const tag = f.properties.amenity ?? f.properties.shop ?? f.properties.office;
      return f.geometry?.type === 'Point' && tag && !NO_NEGOCIO.has(tag);
    })
    .map((f) => {
      const p = f.properties;
      const tag = p.amenity ?? p.shop ?? p.office;
      const categoria = TAG_A_CATEGORIA.get(tag) ?? (p.shop ? 'retail' : 'servicios');
      return {
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: p['@id'],
          nombre: p.name ?? p['name:es'] ?? 'Sin nombre',
          categoria_principal: categoria,
          subcategoria: SUBCATEGORIA_ES[tag] ?? tag,
          generador_trafico: GENERADORES.has(tag),
        },
      };
    }),
};

// ---------- 2. manzanas_centro.geojson ----------
const manzanas = raw('manzanas_plaza.json.json');

const puntos = negocios.features.map((f) => f.geometry.coordinates);
const centroide = (geom) => {
  const ring = geom.type === 'MultiPolygon' ? geom.coordinates[0][0] : geom.coordinates[0];
  let x = 0, y = 0;
  for (const [lng, lat] of ring) { x += lng; y += lat; }
  return [x / ring.length, y / ring.length];
};
// negocios a menos de 200 m del centroide de la manzana (aprox. planar, válida a esta escala)
const M_POR_GRADO = 111320;
const cuentaCercanos = ([clng, clat]) => {
  const cosLat = Math.cos((clat * Math.PI) / 180);
  let n = 0;
  for (const [lng, lat] of puntos) {
    const dx = (lng - clng) * M_POR_GRADO * cosLat;
    const dy = (lat - clat) * M_POR_GRADO;
    if (dx * dx + dy * dy < 200 * 200) n++;
  }
  return n;
};

const conteos = manzanas.features.map((f) => cuentaCercanos(centroide(f.geometry)));
const p95 = [...conteos].sort((a, b) => a - b)[Math.floor(conteos.length * 0.95)] || 1;
const orden = [...conteos].sort((a, b) => b - a);
// ponytail: NSE sintético por cuantiles de actividad comercial (el censo no lo trae);
// reemplazar por datos NSE reales de INEI/APEIM si se consiguen.
const nse = (c) => {
  const rank = orden.indexOf(c) / orden.length;
  return rank < 0.10 ? 'A' : rank < 0.35 ? 'B' : rank < 0.75 ? 'C' : 'D';
};

const manzanasOut = {
  type: 'FeatureCollection',
  features: manzanas.features.map((f, i) => ({
    type: 'Feature',
    geometry: f.geometry,
    properties: {
      id: f.properties.LLAVE_MZS ?? f.properties.Mz,
      poblacion_total: f.properties.T_TOTAL ?? 0,
      nivel_socioeconomico: nse(conteos[i]),
      trafico_peatonal: Math.min(100, Math.round((conteos[i] / p95) * 100)),
      zonificacion: conteos[i] >= 8 ? 'Comercial' : conteos[i] >= 2 ? 'Mixto' : 'Residencial',
    },
  })),
};

// ---------- 3. locales_reales.geojson ----------
const alquileres = raw('alquileres.json');
const locales = {
  type: 'FeatureCollection',
  features: alquileres
    .filter((a) => a.latitud != null && a.longitud != null)
    .map((a) => {
      const area = a.area_total_m2 ?? a.area_construida_m2 ?? null;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [a.longitud, a.latitud] },
        properties: {
          id: `${a.portal}-${a.listing_id}`,
          titulo: a.titulo,
          precio_soles: a.precio_soles,
          area_m2: area,
          precio_m2: a.precio_m2 ?? (area ? Math.round((a.precio_soles / area) * 100) / 100 : null),
          url_origen: a.url,
          telefono_contacto: a.whatsapp ?? a.telefono ?? null,
          imagen_url: a.imagen_principal ?? null,
        },
      };
    }),
};

// ---------- 4. distritos.geojson (flujo peatonal metropolitano) ----------
// Fallback demográfico: las manzanas censales solo cubren el Cercado; fuera de
// ellas el Score usa el flujo peatonal del distrito más cercano.
const flujo = raw('distritos_flujo_peatonal.json');
const maxComposite = Math.max(...flujo.districts.map((d) => d.metrics.composite_score));
const distritos = {
  type: 'FeatureCollection',
  features: flujo.districts.map((d) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
    properties: {
      nombre: d.name,
      clase: d.class, // Alto | Moderado | Bajo | Muy Bajo
      flujo_score: Math.round((d.metrics.composite_score / maxComposite) * 100), // 0-100
    },
  })),
};

// ---------- escribir y validar ----------
const salidas = {
  'todos_los_negocios.geojson': negocios,
  'manzanas_centro.geojson': manzanasOut,
  'locales_reales.geojson': locales,
  'distritos.geojson': distritos,
};
for (const [nombre, fc] of Object.entries(salidas)) {
  writeFileSync(join(OUT, nombre), JSON.stringify(fc));
  console.log(`${nombre}: ${fc.features.length} features`);
}

// autochequeo mínimo
console.assert(locales.features.length === 71, 'deben ser 71 locales');
console.assert(negocios.features.every((f) => f.properties.categoria_principal), 'categoria obligatoria');
console.assert(manzanasOut.features.every((f) => 'poblacion_total' in f.properties), 'poblacion obligatoria');
const nseDist = {};
for (const f of manzanasOut.features) nseDist[f.properties.nivel_socioeconomico] = (nseDist[f.properties.nivel_socioeconomico] || 0) + 1;
console.log('NSE:', nseDist, '| generadores:', negocios.features.filter((f) => f.properties.generador_trafico).length);
console.assert(distritos.features.length === 15, 'deben ser 15 distritos');
console.assert(distritos.features.every((f) => f.properties.flujo_score >= 0 && f.properties.flujo_score <= 100), 'flujo 0-100');
